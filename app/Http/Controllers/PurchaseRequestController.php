<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePurchaseRequestRequest;
use App\Models\AuditLog;
use App\Models\Departments;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use App\Services\ProcurementCancellation;
use App\Services\ProcurementStatusChange;
use App\Services\PrTableParser;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PurchaseRequestController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    /**
     * The tabs of the Purchase Requests page and the statuses each one holds.
     * A tab only shows to someone who works on at least one of its statuses.
     */
    private const TABS = [
        'pending' => ['label' => 'Waiting for verification', 'statuses' => [1]],
        'drafts' => ['label' => 'Drafts', 'statuses' => [0]],
        'verified' => ['label' => 'Verified', 'statuses' => [100, 110, 120, 130, 200, 205]],
        'declined' => ['label' => 'Declined', 'statuses' => [700]],
    ];

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        // Each permission adds the stages that person works on; someone holding
        // several (a Section Head) sees all of them together. Anyone with only
        // pr.view sees every early stage.
        $allowed = array_values(array_unique(array_merge(
            $user?->hasPermission('pr.verify') ? [0, 1, 700] : [],
            $user?->hasPermission('pr.canvass') ? [100, 110, 120, 130, 200, 205] : [],
            $user?->hasPermission('pr.po') ? [200, 205] : [],
        ))) ?: array_merge(...array_column(self::TABS, 'statuses'));

        $tabs = collect(self::TABS)
            ->map(fn ($tab) => $tab + ['statuses' => array_values(array_intersect($tab['statuses'], $allowed))])
            ->filter(fn ($tab) => $tab['statuses'] !== []);

        $filters = $request->validate([
            'view' => ['nullable', 'string', 'in:'.implode(',', array_keys(self::TABS))],
            'search' => ['nullable', 'string', 'max:100'],
            'order' => ['nullable', 'integer'],
        ]);
        $view = $tabs->has($filters['view'] ?? '') ? $filters['view'] : $tabs->keys()->first();
        $search = trim($filters['search'] ?? '');
        $with = ['items', 'verifiedBy:emp_id,emp_fname,emp_lname', 'encoder:emp_id,emp_fname,emp_lname', 'declinedBy:emp_id,emp_fname,emp_lname'];

        $purchaseRequests = PurchaseRequest::with($with)
            ->whereIn('status', $tabs[$view]['statuses'] ?? [])
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('pr_number', 'like', "%{$search}%")
                ->orWhere('requester_department', 'like', "%{$search}%")
                ->orWhere('remarks_or_notes', 'like', "%{$search}%")))
            // Waiting longest first where something is waiting; newest first otherwise.
            ->when(in_array($view, ['pending', 'drafts'], true), fn ($q) => $q->oldest(), fn ($q) => $q->latest())
            ->paginate(15)
            ->withQueryString();

        // A page view is logged once, not on every partial reload of the list.
        if (! $request->header('X-Inertia-Partial-Data')) {
            AuditLog::create([
                'user_id' => Auth::id(),
                'action' => 'viewed_index',
                'auditable_type' => null, // Omit type when target is null to appease SQLite FK constraints
                'auditable_id' => null,
                'description' => "Navigated to Purchase Request IncomingIndex page",
                'old_values' => null,
                'new_values' => null,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);
        }

        return Inertia::render('Procurement/PurchaseRequest/Index', [
            'purchaseRequests' => $purchaseRequests,
            'focusOrder' => isset($filters['order']) ? PurchaseRequest::with($with)->find($filters['order']) : null,
            'filters' => ['view' => $view, 'search' => $search, 'order' => $filters['order'] ?? null],
            'tabs' => $tabs->map(fn ($tab, $key) => [
                'key' => $key,
                'label' => $tab['label'],
                'count' => PurchaseRequest::whereIn('status', $tab['statuses'])->count(),
            ])->values(),
            // Active offices from the Requesting Offices screen.
            'departments' => collect(Departments::options())->pluck('name'),
        ]);
    }


    /**
     * @throws \Throwable
     */
    public function store(StorePurchaseRequestRequest $request)
    {
        $purchaseRequest = DB::transaction(function () use ($request) {
            return PurchaseRequest::create([
                ...$request->validated(),
                'pr_number' => $this->generatePrNumber(),
                'status'    => 0,
            ]);
        });

        // A new request is a draft, so land on the Drafts tab with it open.
        return redirect()
            ->route('purchase-requests.index', ['view' => 'drafts', 'order' => $purchaseRequest->id])
            ->with('success', "Purchase request {$purchaseRequest->pr_number} created.")
            ->with('created_pr', [
                'id'        => $purchaseRequest->id,
                'pr_number' => $purchaseRequest->pr_number,
            ]);
    }


    /**
     * Display the specified resource.
     */
    public function show(PurchaseRequest $purchaseRequest)
    {

        // 2. Log the audit trail only if they passed the check above
        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'viewed',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $purchaseRequest->pr_number,
            'description' => "Viewed Purchase Request #{$purchaseRequest->pr_number}",
            'old_values' => null,
            'new_values' => null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        // 3. Eager load the items so the Inertia view gets the complete data structure
        $purchaseRequest->load('items');

        // 4. Safely render the Inertia view
        return Inertia::render('Procurement/PurchaseRequest/Show', [
            'purchaseRequest' => $purchaseRequest
        ]);
    }

    /**
     * Generate a PDF file of a Purchase Request.
     */
    public function exportPdf(string $id)
    {
        $purchaseRequest = PurchaseRequest::with('items')->findOrFail($id);
        $grandTotal = $purchaseRequest->items->sum(function ($item) {
            return $item->quantity * $item->estimated_unit_cost;
        });

        $pdf = Pdf::loadView('pdf.purchase-request', compact('purchaseRequest', 'grandTotal'));
        $pdf->setOptions(['defaultFont' => 'DejaVu Sans']);

        return $pdf->stream("PR-{$purchaseRequest->pr_number}.pdf");
    }

    /**
     * Verify a Purchase Request using the user object.
     */
    public function verify(Request $request, PurchaseRequest $purchaseRequest)
    {
        $pr = $purchaseRequest;

        // Without this, a request at any stage — a completed one included —
        // could be sent back to Verified.
        if ((int) $pr->status !== 1) {
            return back()->with('error', "{$pr->pr_number} is not waiting for verification.");
        }

        // Capture baseline data before alteration
        $oldValues = [
            'status' => $pr->status,
            'verify_by_emp_id' => $pr->verify_by_emp_id,
            'verified_At' => $pr->verified_At,
        ];

        $pr->update([
            'status' => 100,
            'verify_by_emp_id' => auth()->id(),
            'verified_At' => now(),
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'verified',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $pr->pr_number,
            'description' => "Verified Purchase Request #{$pr->pr_number}",
            'old_values' => $oldValues,
            'new_values' => $pr->only(array_keys($oldValues)),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return redirect()->route('purchase-requests.index', ['view' => 'verified', 'order' => $pr->id])
            ->with('success', "{$pr->pr_number} verified. It moves on to canvassing.");
    }

    /**
     * Decline a Purchase Request.
     */
    public function decline(Request $request, string $id)
    {
        $validated = $request->validate([
            'reason_to_decline' => 'required|string|max:1000',
        ]);

        $pr = PurchaseRequest::findOrFail($id);

        // Only a request waiting for verification can be declined.
        if ((int) $pr->status !== 1) {
            return back()->with('error', "{$pr->pr_number} is not waiting for verification.");
        }

        // Capture baseline data before alteration
        $oldValues = [
            'status' => $pr->status,
            'decline_by_emp_id' => $pr->decline_by_emp_id,
            'declined_At' => $pr->declined_At,
            'reason_to_decline' => $pr->reason_to_decline,
        ];

        $pr->update([
            'status' => 700,
            'decline_by_emp_id' => auth()->id(),
            'declined_At' => now(),
            'reason_to_decline' => $validated['reason_to_decline'],
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'declined',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $pr->pr_number,
            'description' => "Declined Purchase Request #{$pr->pr_number}: {$validated['reason_to_decline']}",
            'old_values' => $oldValues,
            'new_values' => [
                'status' => 700,   // was recorded as 400, which is not what declining sets
                'decline_by_emp_id' => auth()->id(),
                'declined_At' => $pr->declined_At,
                'reason_to_decline' => $pr->reason_to_decline,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return redirect()->route('purchase-requests.index', ['view' => 'declined', 'order' => $pr->id])
            ->with('success', "{$pr->pr_number} declined.");
    }

    /**
     * Cancel a request and its purchase order (administrators only).
     *
     * What may be cancelled is decided by ProcurementCancellation, so the route
     * refuses exactly what the screen refuses. Guarded by permission:procurement.override.
     */
    public function cancel(Request $request, PurchaseRequest $purchaseRequest, ProcurementCancellation $cancellation)
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        if ($refusal = $cancellation->requestRefusal($purchaseRequest)) {
            return back()->with('error', $refusal);
        }

        $cancellation->cancelRequest($purchaseRequest, $validated['reason']);

        return back()->with('success', "Purchase request {$purchaseRequest->pr_number} has been cancelled.");
    }

    /**
     * Move a request to another status (administrators only).
     *
     * Guarded by permission:procurement.override; what may be moved where is
     * decided by ProcurementStatusChange, the same rules the screen offers.
     */
    public function changeStatus(Request $request, PurchaseRequest $purchaseRequest, ProcurementStatusChange $statuses)
    {
        $validated = $request->validate([
            'status' => ['required', 'integer'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $code = (int) $validated['status'];

        if ($code === (int) $purchaseRequest->status) {
            return back()->with('error', 'That is already this request\'s status.');
        }

        $po = $purchaseRequest->purchaseOrder()->first();

        if ($blocker = $statuses->requestBlocker($code, $po)) {
            return back()->with('error', $blocker);
        }

        $statuses->moveRequest($purchaseRequest, $code, $validated['reason']);

        return back()->with('success', "Purchase request {$purchaseRequest->pr_number} moved to {$this->statusLabel($code)}.");
    }

    private function statusLabel(int $code): string
    {
        return DB::table('status')->where('status_code', $code)->value('status_desc') ?? "status {$code}";
    }

    /**
     * Verify a PO.
     */
    public function verifyPO(string $id)
    {
        $pr = PurchaseRequest::findOrFail($id);

        // Capture baseline data before alteration
        $oldValues = ['status' => $pr->status];

        // Only the status moves. This used to stamp decline_by_emp_id and declined_At
        // as well, which put a "Declined" stage on the timeline of every request that
        // had merely proceeded to the purchase order stage.
        $pr->update(['status' => 210]);

        // One order row per request (PR_Number is unique), so a request whose order
        // was cancelled and went back to canvassing reuses that row instead of
        // failing on the duplicate key. Cancelling an order leaves it unnumbered
        // (see ProcurementCancellation::orderRefusal), so nothing is overwritten.
        PurchaseOrder::updateOrCreate(
            ['PR_Number' => $pr->pr_number],
            [
                'status' => 210,
                'cancelled_by_emp_id' => null,
                'cancelled_at' => null,
                'cancellation_reason' => null,
            ],
        );

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'PO Proceeding',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $pr->pr_number,
            'description' => "Proceed Purchase Request #{$pr->pr_number} to Purchase Order Proceeding",
            'old_values' => $oldValues,
            'new_values' => ['status' => 200, 'start_canvas_by' => auth()->id()],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return redirect()->route('purchase-orders.index')->with('success', 'Purchase Request has been proceed to canvassing.');
    }

    /**
     * Generate a PO Number.
     */
    public function generatePONumber(Request $request, PurchaseRequest $purchaseRequest)
    {
        $validated = $request->validate([
            'supplier' => ['required', 'string', 'max:255'],
            'po_number_mode' => ['required', 'in:auto,manual'],
            'po_number' => ['required_if:po_number_mode,manual', 'nullable', 'integer', 'min:1', 'max:99999'],
        ]);

        // The PO row was already created upstream (verifyPO / status 200 → 220).
        // Fetch it rather than making a second one.
        $purchaseOrder = PurchaseOrder::where('PR_Number', $purchaseRequest->pr_number)->firstOrFail();

        if ($validated['po_number_mode'] === 'manual') {
            $poNumber = sprintf('PO-%d-%05d', now()->year, (int)$validated['po_number']);

            if (PurchaseOrder::where('PO_Number', $poNumber)->whereKeyNot($purchaseOrder->id)->exists()) {
                throw ValidationException::withMessages([
                    'po_number' => "PO number {$poNumber} already exists.",
                ]);
            }
        } else {
            $poNumber = $this->nextPoNumber((string)now()->year);
        }

        $purchaseOrder->update([
            'PO_Number' => $poNumber,
            'PO_Supplier' => $validated['supplier'],
            'PO_Date' => now()->format('Y-m-d'), //current date,
            'poNumbered_by' => auth()->id(),
            'status' => 230,    // whatever follows 220 in your flow
        ]);

        $purchaseRequest->update(['status' => 230]);

        return back()->with('po_number', $poNumber);
    }


    private function generatePrNumber(): string
    {
        $year = now()->year;

        $latest = PurchaseRequest::whereYear('created_at', $year)
            ->lockForUpdate()
            ->orderByDesc('id')
            ->value('pr_number');

        $sequence = $latest ? ((int)substr($latest, -4)) + 1 : 1;

        return sprintf('PR-%d-%04d', $year, $sequence);
    }

    private function nextPoNumber(string $year): string
    {
        // Column is PO_Number. MySQL is case-insensitive about column names in SQL,
        // but Eloquent attribute access is not — `$last->po_number` returns null.
        $usedSequences = PurchaseOrder::where('PO_Number', 'like', "PO-{$year}-%")
            ->pluck('PO_Number')
            ->map(fn(string $number) => (int)preg_replace('/^.*-/', '', $number))
            ->flip();

        $next = 1;
        while ($usedSequences->has($next)) {
            $next++;
        }

        return 'PO-' . $year . '-' . str_pad($next, 5, '0', STR_PAD_LEFT);
    }

    /**
     * @throws ConnectionException
     */
    public function ocr(Request $request, PrTableParser $parser)
    {
        $request->validate([
            'document' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:1024'],
        ], [
            'document.max' => 'That file is over 1 MB. Scan at a lower resolution or save as JPG.',
        ]);

        $file = $request->file('document');

        $response = Http::timeout(120)
            ->asMultipart()
            ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName())
            ->post('https://api.ocr.space/parse/image', [
                ['name' => 'apikey', 'contents' => config('services.ocrspace.key')],
                ['name' => 'OCREngine', 'contents' => '2'],
                ['name' => 'isTable', 'contents' => 'false'],
                ['name' => 'language', 'contents' => 'eng'],
            ]);

        if ($response->failed() || $response->json('IsErroredOnProcessing')) {
            Log::warning('OCR failed', ['body' => $response->body()]);

            return response()->json([
                'rows' => [],
                'conditions' => [],
                'message' => 'The scanning service could not read that file. Add the items by hand, or try a clearer scan.',
            ], 422);
        }

        $parsed = $parser->parse($response->json('ParsedResults.0.ParsedText') ?? '');

        return response()->json([
            'rows' => $parsed['items'],
            'conditions' => $parsed['conditions'],
        ]);
    }

}

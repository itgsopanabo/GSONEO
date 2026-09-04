<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePurchaseRequestRequest;
use App\Models\AuditLog;
use App\Models\Departments;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
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
    public function index()
    {
        $user = Auth::user();

        $query = PurchaseRequest::with(['items'])
            ->whereNotIn('status', [400, 210])
            ->orderBy('status', 'desc')
            ->latest();

        // PR Verifier
        if ($user && in_array($user->role_id, [3, 4])) {
            $query->whereIn('status', [0,1]);
        }

        // Canvas Officer
        if ($user && in_array($user->role_id, [3, 6])) {
            $query->whereIn('status', [200, 100]);
        }

        // PO Officer
        if ($user && in_array($user->role_id, [3, 5])) {
            $query->whereIn('status', [210, 200]);
        }

        $purchaseRequests = $query->paginate(10);

        // Audit Logging IncomingIndex View (Fixed morph tracking payload)
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
//
//        dd($purchaseRequests->all());
        return Inertia::render('Procurement/PurchaseRequest/Index', [
            'purchaseRequests' => $purchaseRequests,
            'departments' => Departments::pluck('Department_Name'),
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

        return back()
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

        return redirect()->route('purchase-requests.index')
            ->with('success', 'Purchase Request verified successfully.');
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
                'status' => 400,
                'decline_by_emp_id' => auth()->id(),
                'declined_At' => $pr->declined_At,
                'reason_to_decline' => $pr->reason_to_decline,
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return redirect()->route('purchase-requests.index')->with('success', 'Purchase Request has been declined.');
    }

    /**
     * Verify a PO.
     */
    public function verifyPO(string $id)
    {
        $pr = PurchaseRequest::findOrFail($id);

        // Capture baseline data before alteration
        $oldValues = ['status' => $pr->status, 'decline_by_emp_id' => $pr->decline_by_emp_id, 'declined_At' => $pr->declined_At];

        $pr->update([
            'status' => 210,
            'decline_by_emp_id' => auth()->id(),
            'declined_At' => now(),
        ]);

        PurchaseOrder::create([
            'PR_Number' => $pr->pr_number,
            'status' => 210,
        ]);

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
            'date_received' => ['required', 'date'],
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
            'supplier_receive_date' => $validated['date_received'],
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

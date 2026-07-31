<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Departments;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Gate;
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
            $query->where('status', 0);
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

        return Inertia::render('PurchaseRequest/Index', [
            'purchaseRequests' => $purchaseRequests
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $departments = Departments::select('Department_Code', 'Department_Name')
            ->orderBy('Department_Code', 'asc')->get();

        return Inertia::render('PurchaseRequest/Create', [
            'departments' => $departments
        ]);
    }

    /**
     * Store a newly created resource in storage.
     * @throws \Throwable
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'requester_name' => 'required|string|max:255',
            'requester_department' => 'required|string|max:255',
            'needed_by_date' => 'nullable|date|after_or_equal:today',
            'remarks_or_notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.item_name' => 'required|string|max:255',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit' => 'required|string|max:50',
            'items.*.estimated_unit_price' => 'required|numeric|min:0',
        ]);

        $purchaseRequest = DB::transaction(function () use ($validated) {
            $prNumber = 'EPR-' . date('Y') . '-' . str_pad(PurchaseRequest::count() + 1, 4, '0', STR_PAD_LEFT);

            $purchaseRequest = PurchaseRequest::create([
                'pr_number' => $prNumber,
                'requester_name' => $validated['requester_name'],
                'requester_department' => $validated['requester_department'],
                'needed_by_date' => $validated['needed_by_date'],
                'remarks_or_notes' => $validated['remarks_or_notes'],
                'status' => 0,
                'verify_by_emp_id' => null,
            ]);

            $itemsData = array_map(function ($item) use ($prNumber) {
                return [
                    'purchase_request_id' => $prNumber,
                    'item_name' => $item['item_name'],
                    'item_desc' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit' => $item['unit'],
                    'estimated_unit_cost' => $item['estimated_unit_price'],
                    'total_estimated_cost' => $item['quantity'] * $item['estimated_unit_price'],
                ];
            }, $validated['items']);

            $purchaseRequest->items()->createMany($itemsData);

            return $purchaseRequest;
        });

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $purchaseRequest->pr_number,
            'description' => "Created Purchase Request {$purchaseRequest->pr_number} for {$purchaseRequest->requester_name}",
            'old_values' => null,
            'new_values' => $purchaseRequest->load('items')->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return redirect()->route('purchase-requests.index')
            ->with('success', 'Purchase Request created successfully.');
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
        return Inertia::render('PurchaseRequest/Show', [
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
    public function verify(string $id)
    {
        $pr = PurchaseRequest::findOrFail($id);

        // Capture baseline data before alteration
        $oldValues = ['status' => $pr->status, 'verify_by_emp_id' => $pr->verify_by_emp_id, 'verified_At' => $pr->verified_At];

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
            'new_values' => ['status' => 100, 'verify_by_emp_id' => auth()->id(), 'verified_At' => $pr->verified_At],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return redirect()->route('purchase-requests.index')->with('success', 'Purchase Request verified successfully.');
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
     * Decline a Proceed to canvassing.
     */
    public function canvasing(string $id)
    {
        $pr = PurchaseRequest::findOrFail($id);

        // Capture baseline data before alteration
        $oldValues = ['status' => $pr->status, 'verify_by_emp_id' => $pr->verify_by_emp_id, 'verified_At' => $pr->verified_At];

        $pr->update([
            'status' => 200,
            'verify_by_emp_id' => auth()->id(),
            'verified_At' => now(),
        ]);


        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'Canvassing',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $pr->pr_number,
            'description' => "Proceed Purchase Request #{$pr->pr_number} to canvassing",
            'old_values' => $oldValues,
            'new_values' => ['status' => 200, 'start_canvas_by' => auth()->id()],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);


        return redirect()->route('purchase-requests.index')->with('success', 'Purchase Request has been proceed to canvassing.');
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
            'status' => 220,
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

        return redirect()->route('purchase-requests.index')->with('success', 'Purchase Request has been proceed to canvassing.');
    }

    /**
     * Generate a PO Number.
     */
    public function generatePONumber(Request $request, string $id)
    {
        $pr = PurchaseRequest::findOrFail($id);
        $year = now()->format('Y');

        $baseRules = [
            'supplier' => 'required|string|max:255',
            'date_received' => 'required|date',
            'po_number_mode' => 'required|in:auto,manual',
        ];

        if ($request->input('po_number_mode') === 'manual') {
            $validated = $request->validate(array_merge($baseRules, [
                'po_number_input' => 'required|string|max:100|unique:purchase_orders,PO_Number',
            ]));
        } else {
            $validated = $request->validate($baseRules);
        }

        $poNumber = $validated['po_number_mode'] === 'manual'
            ? $validated['po_number_input']
            : DB::transaction(function () use ($year) {
                $last = PurchaseOrder::where('po_number', 'like', "PO-{$year}-%")
                    ->lockForUpdate()
                    ->orderByDesc('po_number')
                    ->first();

                $nextNumber = $last
                    ? ((int)substr($last->po_number, -5)) + 1
                    : 1;

                return 'PO-' . $year . '-' . str_pad($nextNumber, 5, '0', STR_PAD_LEFT);
            });


        // Capture baseline data before alteration
        $oldValues = [
            'status' => $pr->status,
        ];

        // Create the PO record
        $purchaseOrder = PurchaseOrder::create([
            'PO_Number' => $poNumber,
            'PO_Supplier' => $validated['supplier'],
            'PO_Date' => now()->format('Y-m-d'),
            'PR_Number' => $pr->pr_number,
            'supplier_receive_date' => $validated['date_received'],
            'poNumbered_by' => auth()->id(),
            'status' => 220,
        ]);

        // Keep PR status in sync
        $pr->update([
            'status' => 220,
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'PO Generated',
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $purchaseOrder->id,
            'description' => "Generated PO number {$poNumber} for Purchase Request #{$pr->pr_number} "
                . "(Supplier: {$validated['supplier']}, Received: {$validated['date_received']})",
            'old_values' => $oldValues,
            'new_values' => [
                'status' => 210,
                'po_number' => $poNumber,
                'supplier' => $validated['supplier'],
                'date_received_by_supplier' => $validated['date_received'],
            ],
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return redirect()
            ->route('purchase-requests.show', ['purchase_request' => $pr->id])
            ->with('success', "PO number {$poNumber} has been generated.")
            ->with('po_number', $poNumber)
            ->with('supplier', $validated['supplier'])
            ->with('date_received', $validated['date_received']);
    }

}

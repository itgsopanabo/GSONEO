<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use App\Models\User;
use App\Services\ProcurementCancellation;
use App\Services\ProcurementStatusChange;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use function Pest\Laravel\json;
use function Termwind\render;

class PurchaseOrderController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // Real purchase orders already created.
        $purchaseOrders = PurchaseOrder::with(['purchaseRequest.items'])
            ->whereIn('status', [200, 210])
            ->latest()
            ->get();

        // PRs still in Canvassing that haven't produced a PurchaseOrder yet —
        // these need to show up in the list too, just without PO-specific
        // fields (po_number, etc.) since that record doesn't exist yet.
        $canvassingPRs = PurchaseRequest::with('items')
            ->whereIn('status', [100, 110, 120, 130, 205])
            ->where(function ($q) {
                $q->where('mode_of_procurement', '!=', 'small_value')
                    ->orWhereNull('mode_of_procurement')
                    ->orWhere('status', 205);
            })
            // A cancelled order doesn't count as having one: the request was sent
            // back to canvassing precisely so a new PO can be raised here.
            ->whereDoesntHave('purchaseOrder', fn ($q) => $q->where('status', '!=', ProcurementCancellation::CANCELLED))
            ->get()
            ->map(fn($pr) => (object)[
                'id' => null,
                'po_number' => null,
                'status' => $pr->status,
                'purchase_request' => $pr,
                'is_canvassing_only' => true,
                'created_at' => $pr->created_at,
            ]);


        // Merge and sort by recency across both sources.
        $merged = $purchaseOrders
            ->concat($canvassingPRs)
            ->sortByDesc(fn($item) => $item->created_at)
            ->values();

        // Manual pagination since this is now a merged collection,
        // not a single Eloquent query we can call ->paginate() on.
        $perPage = 15;
        $page = request()->integer('page', 1);

        $purchaseOrders = new \Illuminate\Pagination\LengthAwarePaginator(
            $merged->forPage($page, $perPage)->values(),
            $merged->count(),
            $perPage,
            $page,
            ['path' => request()->url(), 'query' => request()->query()]
        );

        return Inertia::render('Procurement/PurchaseOrder/Index', compact('purchaseOrders'));
    }


    /**
     * Cancel this order only, leaving the request alive (administrators only).
     *
     * The request returns to canvassing so a new PO can be issued — for a supplier
     * who backed out, or an order raised against the wrong request. To void the
     * request as well, cancel the request instead. Guarded by
     * permission:procurement.override; the rules live in ProcurementCancellation.
     */
    public function cancel(Request $request, PurchaseOrder $purchase_order, ProcurementCancellation $cancellation)
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        if ($refusal = $cancellation->orderRefusal($purchase_order)) {
            return back()->with('error', $refusal);
        }

        $cancellation->cancelOrder($purchase_order, $validated['reason']);

        $label = $purchase_order->PO_Number ?: "for {$purchase_order->PR_Number}";

        return back()->with('success', "Purchase order {$label} has been cancelled; the request is back in canvassing.");
    }

    /**
     * Move an order to another status (administrators only).
     *
     * This is how a delivery that went the wrong way — sent to SSMI when it
     * belonged in Incoming — is put back. Moving below a stage voids that stage's
     * document number so it can be issued again; ProcurementStatusChange says
     * which moves are possible and what each one voids.
     */
    public function changeStatus(Request $request, PurchaseOrder $purchase_order, ProcurementStatusChange $statuses)
    {
        $validated = $request->validate([
            'status' => ['required', 'integer'],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $code = (int) $validated['status'];

        if ($code === (int) $purchase_order->status) {
            return back()->with('error', 'That is already this order\'s status.');
        }

        if ($blocker = $statuses->orderBlocker($code, $purchase_order)) {
            return back()->with('error', $blocker);
        }

        $voided = $statuses->voided($purchase_order, $code);

        $statuses->moveOrder($purchase_order, $code, $validated['reason']);

        $label = DB::table('status')->where('status_code', $code)->value('status_desc') ?? "status {$code}";
        $note = $voided ? ' Voided: '.implode(', ', $voided).'.' : '';

        return back()->with('success', "Purchase order moved to {$label}.{$note}");
    }

    /**
     * Display the specified resource.
     */
    public function store(PurchaseOrder $purchaseOrder, Request $request)
    {
        $validated = $request->validate([
            'prnumber' => 'required',
            'supplier_name' => 'required|exists:suppliers,id',
            'poDate' => 'nullable|date',
            'poNumbered_by' => 'nullable|string',
            'status' => 'nullable|string',
            'ponumber' => 'nullable|string',

        ]);

        $purchaseRequest = PurchaseRequest::with('items')->findOrFail($validated['purchase_request_id']);

        $purchaseOrder = PurchaseOrder::create([
            'PO_Number' => $validated['ponumber'],
            'PO_Supplier' => $validated['supplier_name'],
            'PO_Date' => $validated['poDate']->toDateString(),
            'PR_Number' => $purchaseRequest->id,
            'poNumbered_by' => auth()->id(),
            'status' => $purchaseRequest->status,
        ]);

        return redirect()
            ->route('purchase-orders.index', $purchaseOrder)
            ->with('success', 'Purchase Order created from Purchase Request.');
    }

    public function generatePONumber(Request $request, PurchaseOrder $purchase_order)
    {
        $validated = $request->validate([
            'po_number_mode' => 'required|in:auto,manual',
            'po_number' => 'required_if:po_number_mode,manual|nullable|integer|min:1|max:99999',
            'supplier' => 'required|string|max:255',
        ]);

        $poNumber = DB::transaction(function () use ($validated) {
            $year = now()->year;

            if ($validated['po_number_mode'] === 'manual') {
                $seq = (int)$validated['po_number'];
                $poNumber = sprintf('PO-%d-%05d', $year, $seq);

                if (PurchaseOrder::where('PO_Number', $poNumber)->exists()) {
                    throw ValidationException::withMessages([
                        'po_number' => "PO number {$poNumber} already exists.",
                    ]);
                }

                return $poNumber;
            }

            // Use the first available sequence so manual numbers do not cause
            // skipped automatic numbers (e.g. 1 and 4 means the next is 2).
            $usedSequences = PurchaseOrder::where('PO_Number', 'like', "PO-{$year}-%")
                ->lockForUpdate()
                ->pluck('PO_Number')
                ->map(fn(string $number) => (int)preg_replace('/^.*-/', '', $number))
                ->flip();

            $nextSeq = 1;
            while ($usedSequences->has($nextSeq)) {
                $nextSeq++;
            }

            return sprintf('PO-%d-%05d', $year, $nextSeq);
        });

        $oldValues = $purchase_order->only(['PO_Number', 'PO_Supplier', 'supplier_receive_date', 'status']);

        $purchase_order->update([
            'PO_Number' => $poNumber,
            'PO_Supplier' => $validated['supplier'],
            'PO_Date' => now()->toDateTimeString(),
            'poNumbered_by' => auth()->id(),
            'status' => 230, // PO Generated
        ]);

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'Generate PO Number',
            'auditable_type' => get_class($purchase_order),
            'auditable_id' => $purchase_order->id,
            'description' => "Generated PO number {$poNumber} for Purchase Order #{$purchase_order->id}",
            'old_values' => $oldValues,
            'new_values' => $purchase_order->only(['PO_Number', 'PO_Supplier', 'supplier_receive_date', 'status']),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return redirect()
            ->route('purchase-orders.index')
            ->with('success', 'PO number generated successfully.')
            ->with('po_number', $purchase_order->PO_Number)
            ->with('supplier', $purchase_order->PO_Supplier);
    }
}

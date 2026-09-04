<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use App\Models\User;
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
            ->whereDoesntHave('purchaseOrder')
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
            'PO_Date' => $validated['poDate'],
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
            'date_received' => 'required|date',
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
            'PO_Date' => now()->format('Y-m-d'),
            'supplier_receive_date' => $validated['date_received'],
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
            ->with('supplier', $purchase_order->PO_Supplier)
            ->with('date_received', $purchase_order->supplier_receive_date);
    }
}

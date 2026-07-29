<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
        $purchaseOrders = PurchaseOrder::with(['purchaseRequest.items'])
            ->whereIn('status', [200, 210, 220])
            ->latest()
            ->paginate(15);

//        return response()->json($purchaseOrders);

        return Inertia::render('PurchaseOrder/Index', compact('purchaseOrders'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {

    }


    /**
     * Show the form for creating a new resource.
     */
    public function show(PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->load(['purchaseRequest.items']);

        return Inertia::render('PurchaseOrder/show', compact('purchaseOrder'));
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
            ->route('', $purchaseOrder)
            ->with('success', 'Purchase Order created from Purchase Request.');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(PurchaseOrder $purchaseOrder)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, PurchaseOrder $purchaseOrder)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(PurchaseOrder $purchaseOrder)
    {
        //
    }

    public function generatePONumber(Request $request, PurchaseOrder $purchase_order)
    {
        $validated = $request->validate([
            'po_number_mode' => 'required|in:auto,manual',
            'po_number_input' => 'required_if:po_number_mode,manual|nullable|string|max:50',
            'supplier' => 'required|string|max:255',
            'date_received' => 'required|date',
        ]);

        if ($validated['po_number_mode'] === 'manual') {
            $poNumber = $validated['po_number_input'];
        } else {
            $year = now()->year;
            $lastPO = PurchaseOrder::where('PO_Number', 'like', "PO-{$year}-%")
                ->orderByDesc('id')
                ->first();

            $nextSeq = $lastPO ? ((int)substr($lastPO->PO_Number, -4)) + 1 : 1;
            $poNumber = sprintf('PO-%d-%04d', $year, $nextSeq);
        }

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

<?php

namespace App\Http\Controllers;

use App\Models\IAR;
use App\Models\PurchaseOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class IARController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $purchaseOrders = PurchaseOrder::with(['purchaseRequest.items'])
            ->where('status', 300)
            ->latest()
            ->paginate(15);

        return Inertia::render('IAR/Index', compact('purchaseOrders'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function store(Request $request)
    {
        // Validate strictly against the iar schema
        $validated = $request->validate([
            'PO_Number' => ['required', 'string', 'max:255'],
            'invoice_number' => ['required', 'string', 'max:255'],
        ]);

        try {
            DB::beginTransaction();

            // Auto-generate IAR Number (e.g., IAR-2026-0001)
            $year = now()->year;
            $count = IAR::whereYear('created_at', $year)->count() + 1;
            $iarNumber = sprintf('IAR-%d-%04d', $year, $count);

            // Insert into 'iar' table
            $iar = IAR::create([
                'iar_number' => $iarNumber,
                'invoice_number' => $validated['invoice_number'],
                'PO_Number' => $validated['PO_Number'],
            ]);

            // Update Purchase Order status to "Inspected" / status code 300
            PurchaseOrder::where('PO_Number', $validated['PO_Number'])->update([
                'status' => 300,
            ]);

            DB::commit();

            return redirect()
                ->route('iar.index')
                ->with('success', "IAR #{$iarNumber} successfully created.");

        } catch (\Exception $e) {
            DB::rollBack();

            return back()->withErrors([
                'error' => 'Failed to save IAR: ' . $e->getMessage(),
            ]);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(PurchaseOrder $purchase_order)
    {
        $purchase_order->load(['purchaseRequest.items']);

        return Inertia::render('IAR/Show', [
            'purchaseOrder' => $purchase_order,
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(IAR $iAR)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, IAR $iAR)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(IAR $iAR)
    {
        //
    }

    public function generatePdf(Request $request, PurchaseOrder $purchaseOrder)
    {
        $invoiceNumber = $request->query('invoice_number');
        $invoiceDate = $request->query('invoice_date');
        $itemIdsString = $request->query('item_ids');
        // Ensure IDs are integers so they match database primary keys cleanly
        $selectedItemIds = $itemIdsString ? array_map('intval', explode(',', $itemIdsString)) : [];

        $iarNumber = $purchaseOrder->iar_number ?? 'IAR-' . date('Y') . '-' . $purchaseOrder->id;

        // Explicitly query the purchase request and its items manually using the PR_Number string
        $items = [];
        if ($purchaseOrder->PR_Number) {
            $purchaseRequest = \App\Models\PurchaseRequest::where('pr_number', $purchaseOrder->PR_Number)->first();

            if ($purchaseRequest) {
                $items = $purchaseRequest->items()
                    ->whereIn('id', $selectedItemIds)
                    ->get();
            }
        }

        $pdf = PDF::loadView('pdf.inspection-acceptance-report', [
            'purchaseOrder' => $purchaseOrder,
            'invoiceNumber' => $invoiceNumber,
            'invoiceDate' => $invoiceDate,
            'iarNumber' => $iarNumber,
            'items' => $items,
        ]);

//        Update to status 400
        {/*TODO Uncomment when we want to proceed to RIS Numbering*/}
//        $purchaseOrder->update(['status' => 400]);

        return $pdf->stream("IAR-{$purchaseOrder->id}.pdf");
    }
}

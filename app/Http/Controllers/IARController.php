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
            ->whereIn('status', [300, 400, 500])
            ->latest()
            ->paginate(15);

        return Inertia::render('Inventory/IAR/Index', compact('purchaseOrders'));
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
                ->route('inspection-acceptance-reports.index')
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


    public function generatePdf(Request $request, PurchaseOrder $purchaseOrder)
    {
        $invoiceNumber = $request->query('invoice_number');
        $invoiceDate = $request->query('invoice_date');
        $itemIdsString = $request->query('item_ids');
        // Ensure IDs are integers so they match database primary keys cleanly
        $selectedItemIds = $itemIdsString ? array_map('intval', explode(',', $itemIdsString)) : [];

        $year = date('Y');

        // Find the latest record created this year from the IAR model/table
        $lastRecord = IAR::whereYear('created_at', $year)
            ->latest('id')
            ->first();

        if ($lastRecord) {
            // Extract the numeric portion from the last IAR number (e.g., "IAR-2026-005" -> 5)
            $parts = explode('-', $lastRecord->iar_number);
            $nextSequence = intval(end($parts)) + 1;
        } else {
            // Fallback if no records exist for this year yet
            $nextSequence = 1;
        }

        $iarNumber = 'IAR-' . $year . '-' . str_pad($nextSequence, 3, '0', STR_PAD_LEFT);

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


        IAR::create([
            'iar_number' => $iarNumber,
            'invoice_number' => $invoiceNumber,
            'PO_Number' => $purchaseOrder->PO_Number,
        ]);
        PurchaseOrder::where('PO_Number', $purchaseOrder->PO_Number)->update([
            'status' => 400,
        ]);

        $iar = IAR::where('PO_Number', $purchaseOrder->PO_Number)
            ->latest()
            ->first();

        $pdf = PDF::loadView('pdf.inspection-acceptance-report', [
            'purchaseOrder' => $purchaseOrder,
            'invoiceNumber' => $invoiceNumber,
            'invoiceDate' => $invoiceDate,
            'iarNumber' => $iar->iar_number,
            'items' => $items,
        ]);


        return $pdf->stream("IAR-{$purchaseOrder->id}.pdf");
    }
}

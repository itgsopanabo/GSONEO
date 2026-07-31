<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\IAR;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use JetBrains\PhpStorm\NoReturn;

class InventoryController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $purchaseOrders = PurchaseOrder::with(['purchaseRequest.items'])
            ->where('status', 230)
            ->latest()
            ->paginate(15);

        return Inertia::render('Inventory/incomingIndex', compact('purchaseOrders'));
    }

    // Change 'PurchaseOrder $purchase_order' to raw ID parameter '$id'
    public function show($id)
    {
        // 1. Check what value actually arrived from the URL
        // dd($id);


        // 2. Query manually (supports either ID or PO number)
        $purchase_order = PurchaseOrder::where('PO_Number', $id)
            ->orWhere('po_number', $id)
            ->with(['purchaseRequest.items'])
            ->firstOrFail();


        return Inertia::render('Inventory/incomingShow', [
            'purchaseOrder' => $purchase_order,
        ]);
    }

    public function toIAR(Request $request)
    {
        $validated = $request->validate([
            'PO_Number' => ['required', 'string', 'exists:purchase_order,PO_Number'],
        ]);

        // Find PO and update its status
        $purchaseOrder = PurchaseOrder::where('PO_Number', $validated['PO_Number'])->firstOrFail();

        $purchaseOrder->update([
            'status' => 300, // Updated status code for IAR stage
        ]);

        return redirect()
            ->route('inspection-acceptance-reports.index')
            ->with('success', "PO #{$purchaseOrder->PO_Number} status updated successfully.");
    }
}

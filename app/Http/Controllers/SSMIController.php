<?php

namespace App\Http\Controllers;

use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SSMIController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $purchaseOrders = PurchaseOrder::with(['purchaseRequest.items'])
            ->where('status', 500)
            ->latest()
            ->paginate(15);

//        dd($purchaseOrders);
        return Inertia::render('SSMI/Index', compact('purchaseOrders'));
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $purchaseOrder = PurchaseOrder::with(['purchaseRequest.items'])->findOrFail($id);

        return Inertia::render('SSMI/Show', compact('purchaseOrder'));
    }



    /**
     * Proceed to Outgoing
     * </br>
     * TODO Needs to rework the logic to ongoing proceedings
     */
    public function toOutgoing(string $id)
    {
        $purchaseOrder = PurchaseOrder::with(['purchaseRequest.items'])->findOrFail($id);

    }

}

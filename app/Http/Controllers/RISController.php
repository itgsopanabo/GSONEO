<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\PurchaseOrder;

use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class RISController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $purchaseOrders = PurchaseOrder::with(['purchaseRequest.items'])
            ->whereIn('status', [300, 400])
            ->latest()
            ->paginate(15);

//        dd($purchaseOrders);
        return Inertia::render('Inventory/RIS/Index', compact('purchaseOrders'));
    }


    /**
     * Generate a RIS Number
     */
    public function generateRISNumber(PurchaseOrder $purchaseOrder)
    {

        if ($purchaseOrder->RIS_Number) {
            return redirect()
                ->route('ris.show', $purchaseOrder->id)
                ->with('error', 'RIS number has already been generated for this Purchase Order.');
        }

        $risNumber = DB::transaction(function () {
            $year = now()->year;

            $lastRIS = PurchaseOrder::where('RIS_Number', 'like', "RIS-{$year}-%")
                ->lockForUpdate()
                ->orderByRaw("CAST(SUBSTRING(RIS_Number, -4) AS UNSIGNED) DESC")
                ->first();

            $nextSeq = $lastRIS ? ((int)substr($lastRIS->RIS_Number, -4)) + 1 : 1;

            do {
                $candidate = sprintf('RIS-%d-%04d', $year, $nextSeq);
                $exists = PurchaseOrder::where('RIS_Number', $candidate)->exists();
                $nextSeq++;
            } while ($exists);

            return $candidate;
        });

        $oldValues = $purchaseOrder->only(['RIS_Number']);

        $purchaseOrder->update([
            'RIS_Number' => $risNumber,
            'RIS_Date' => now()->format('Y-m-d'), // remove this line if you don't have this column
            'risNumbered_by' => auth()->id(),      // remove this line if you don't have this column
             'status' => 500,
            // {/*TODO Uncomment if we want to proceed to SSMI*/}
        ]);


        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'Generate RIS Number',
            'auditable_type' => get_class($purchaseOrder),
            'auditable_id' => $purchaseOrder->id,
            'description' => "Generated RIS number {$risNumber} for Purchase Order #{$purchaseOrder->id}",
            'old_values' => $oldValues,
            'new_values' => $purchaseOrder->only(['RIS_Number']),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);


        return redirect()
            ->route('ris.show', $purchaseOrder->id)
            ->with('success', 'RIS number generated successfully.')
            ->with('ris_number', $purchaseOrder->RIS_Number);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $purchaseOrder = PurchaseOrder::with(['purchaseRequest.items'])->findOrFail($id);

        return Inertia::render('Inventory/RIS/Show', compact('purchaseOrder'));
    }


}

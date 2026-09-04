<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SSMIController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $purchaseOrders = PurchaseOrder::with(['purchaseRequest.items', 'IARs'])
            ->whereIn('status', [500,550])
            ->latest()
            ->paginate(15);

        return Inertia::render('Inventory/SSMI/Index', compact('purchaseOrders'));
    }

    public function generateNumber(PurchaseOrder $purchaseOrder)
    {
        if ($purchaseOrder->SSMI_Number) {
            return redirect()
                ->route('ssmi.index')
                ->with('error', 'SSMI number has already been generated for this Purchase Order.');
        }

        $ssmiNumber = DB::transaction(function () {
            $year = now()->year;

            $lastSSMI = PurchaseOrder::where('SSMI_Number', 'like', "SSMI-{$year}-%")
                ->lockForUpdate()
                ->orderByRaw("CAST(SUBSTRING(SSMI_Number, -4) AS UNSIGNED) DESC")
                ->first();

            $nextSeq = $lastSSMI ? ((int) substr($lastSSMI->SSMI_Number, -4)) + 1 : 1;

            do {
                $candidate = sprintf('SSMI-%d-%04d', $year, $nextSeq);
                $exists = PurchaseOrder::where('SSMI_Number', $candidate)->exists();
                $nextSeq++;
            } while ($exists);

            return $candidate;
        });

        $oldValues = $purchaseOrder->only(['SSMI_Number']);

        $purchaseOrder->update([
            'SSMI_Number' => $ssmiNumber,
            'SSMI_Date' => now()->format('Y-m-d'), // remove this line if you don't have this column
            'ssmiNumbered_by' => auth()->id(),      // remove this line if you don't have this column, or fix casing
        ]);

        AuditLog::create([
            'user_id' => auth()->id(),
            'action' => 'Generate SSMI Number',
            'auditable_type' => get_class($purchaseOrder),
            'auditable_id' => $purchaseOrder->id,
            'description' => "Generated SSMI number {$ssmiNumber} for Purchase Order #{$purchaseOrder->id}",
            'old_values' => $oldValues,
            'new_values' => $purchaseOrder->only(['SSMI_Number']),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return redirect()
            ->route('ssmi.index')
            ->with('success', 'SSMI number generated successfully.')
            ->with('ssmi_number', $purchaseOrder->SSMI_Number);
    }

    public function toOutgoing(PurchaseOrder $purchaseOrder)
    {
        if ($purchaseOrder->status !== 500) {
            return back()->with('error', 'This order is not in the SSMI stage.');
        }

        if (! $purchaseOrder->SSMI_Number) {
            return back()->with('error', 'Generate an SSMI number before moving this order to outgoing.');
        }

        $oldValues = $purchaseOrder->only(['status']);

        $purchaseOrder->update(['status' => 550]);

        AuditLog::create([
            'user_id'        => auth()->id(),
            'action'         => 'Proceed to Outgoing',
            'auditable_type' => $purchaseOrder->getMorphClass(),
            'auditable_id'   => $purchaseOrder->id,
            'description'    => "Moved PO #{$purchaseOrder->id} ({$purchaseOrder->SSMI_Number}) to outgoing",
            'old_values'     => $oldValues,
            'new_values'     => $purchaseOrder->only(['status']),
            'ip_address'     => request()->ip(),
            'user_agent'     => request()->userAgent(),
        ]);

        return redirect()->route('ssmi.index')
            ->with('success', 'Order moved to outgoing.');
    }
}

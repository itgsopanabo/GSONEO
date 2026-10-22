<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\IAR;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class RISController extends Controller
{
    /** Every item received and inspected; see IARController. */
    private const STATUS_FOR_RIS = 400;

    /** What the page shows for each order: items, the IARs that received them, and open tags. */
    private const WITH = ['purchaseRequest.items', 'iars.items', 'openTags.tag', 'openTags.taggedBy'];

    /**
     * The RIS screen, in two tabs.
     *
     *   pending  orders waiting for an issue slip. Only fully delivered orders:
     *            a partially delivered one stays at 300 (For Inspection) until
     *            the balance arrives, so nothing is issued against goods that
     *            have not come in.
     *   issued   every order that has an RIS number, newest first, so a slip
     *            can still be found after the order has moved on to SSMI.
     *
     * `order` selects one order in the detail panel. It is also sent on its own
     * as `focusOrder`, so a link to an order on a later page still opens it.
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'view' => ['nullable', 'in:pending,issued'],
            'search' => ['nullable', 'string', 'max:100'],
            'order' => ['nullable', 'integer'],
        ]);
        $view = $filters['view'] ?? 'pending';
        $search = trim($filters['search'] ?? '');

        $purchaseOrders = PurchaseOrder::with(self::WITH)
            ->when(
                $view === 'issued',
                fn ($q) => $q->whereNotNull('RIS_Number')->orderByDesc('RIS_Date')->orderByDesc('id'),
                fn ($q) => $q->where('status', self::STATUS_FOR_RIS)->latest(),
            )
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('PO_Number', 'like', "%{$search}%")
                ->orWhere('PR_Number', 'like', "%{$search}%")
                ->orWhere('PO_Supplier', 'like', "%{$search}%")
                ->orWhere('RIS_Number', 'like', "%{$search}%")
                ->orWhereHas('purchaseRequest', fn ($pr) => $pr->where('requester_department', 'like', "%{$search}%"))))
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Inventory/RIS/Index', [
            'purchaseOrders' => $purchaseOrders,
            'focusOrder' => isset($filters['order']) ? PurchaseOrder::with(self::WITH)->find($filters['order']) : null,
            'filters' => ['view' => $view, 'search' => $search, 'order' => $filters['order'] ?? null],
            'counts' => [
                'pending' => PurchaseOrder::where('status', self::STATUS_FOR_RIS)->count(),
                'issued' => PurchaseOrder::whereNotNull('RIS_Number')->count(),
            ],
        ]);
    }

    /**
     * Generate a RIS Number
     */
    public function generateRISNumber(PurchaseOrder $purchaseOrder)
    {
        if ($purchaseOrder->RIS_Number) {
            return redirect()
                ->route('ris.index', ['view' => 'issued', 'order' => $purchaseOrder->id])
                ->with('error', "PO #{$purchaseOrder->PO_Number} already has {$purchaseOrder->RIS_Number}.");
        }

        // Without this, any order could be issued from any stage, including one
        // still waiting on inspection or on the rest of a partial delivery. The
        // status is what decides: an administrator who accepts a short delivery
        // moves it to 400 with Change status, and that is allowed through.
        if ((int) $purchaseOrder->status !== self::STATUS_FOR_RIS) {
            return back()->with('error', $purchaseOrder->delivery_status === IAR::DELIVERY_PARTIAL
                ? "PO #{$purchaseOrder->PO_Number} is only partially delivered. Items can be issued once the rest has been delivered and inspected."
                : "PO #{$purchaseOrder->PO_Number} is not ready for RIS.");
        }

        if ($blocker = $purchaseOrder->missingBlocker()) {
            return back()->with('error', $blocker);
        }

        $oldValues = $purchaseOrder->only(['RIS_Number']);

        $risNumber = DB::transaction(function () use ($purchaseOrder) {
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

            // Saved inside the transaction, so the lock above still covers it and
            // two people issuing at once cannot be handed the same number.
            $purchaseOrder->update([
                'RIS_Number' => $candidate,
                'RIS_Date' => now()->toDateTimeString(),
                'risNumbered_by' => auth()->id(),
                'status' => 500,
            ]);

            return $candidate;
        });

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

        // Land on the slip just issued, so the number is in front of the user.
        return redirect()
            ->route('ris.index', ['view' => 'issued', 'order' => $purchaseOrder->id])
            ->with('success', "{$risNumber} issued for PO #{$purchaseOrder->PO_Number}. The order is now with SSMI.");
    }

    /**
     * One order. Kept for links from elsewhere (the Missing Tracker, older
     * bookmarks): opens it in the RIS screen, on whichever tab it belongs to.
     */
    public function show(string $id)
    {
        $purchaseOrder = PurchaseOrder::findOrFail($id);

        return redirect()->route('ris.index', [
            'view' => $purchaseOrder->RIS_Number ? 'issued' : 'pending',
            'order' => $purchaseOrder->id,
        ]);
    }
}

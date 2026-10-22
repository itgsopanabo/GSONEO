<?php

namespace App\Http\Controllers;

use App\LogsAudit;
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
    use LogsAudit;

    /** Delivered, waiting to be received into inspection. */
    private const STATUS_INCOMING = 230;

    /** SSMI issued, waiting to be handed to the requesting department. */
    private const STATUS_FOR_RELEASE = 550;

    private const STATUS_FOR_INSPECTION = 300;

    private const STATUS_COMPLETED = 600;

    /** Every stage an accepted order can have reached, for the Accepted tab. */
    private const PAST_INCOMING = [300, 400, 500, 550, 600];

    /**
     * The Incoming screen, in two tabs.
     *
     *   awaiting  orders with a PO number whose delivery has not been accepted
     *   accepted  every order that has moved past incoming, most recently
     *             accepted first. Orders accepted before acceptance was recorded
     *             have no date and sort last.
     *
     * `order` selects one order in the detail panel, and is also sent on its own
     * as `focusOrder` so a link to an order on a later page still opens it.
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'view' => ['nullable', 'in:awaiting,accepted'],
            'search' => ['nullable', 'string', 'max:100'],
            'order' => ['nullable', 'integer'],
        ]);
        $view = $filters['view'] ?? 'awaiting';
        $search = trim($filters['search'] ?? '');
        $with = ['purchaseRequest.items', 'openTags.tag', 'openTags.taggedBy', 'receivedBy'];

        $purchaseOrders = PurchaseOrder::with($with)
            ->when(
                $view === 'accepted',
                fn ($q) => $q->whereIn('status', self::PAST_INCOMING)
                    ->orderByRaw('received_at IS NULL')
                    ->orderByDesc('received_at')
                    ->orderByDesc('id'),
                fn ($q) => $q->where('status', self::STATUS_INCOMING)->orderBy('PO_Date'),
            )
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('PO_Number', 'like', "%{$search}%")
                ->orWhere('PR_Number', 'like', "%{$search}%")
                ->orWhere('PO_Supplier', 'like', "%{$search}%")
                ->orWhereHas('purchaseRequest', fn ($pr) => $pr->where('requester_department', 'like', "%{$search}%"))))
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Inventory/incomingIndex', [
            'purchaseOrders' => $purchaseOrders,
            'focusOrder' => isset($filters['order']) ? PurchaseOrder::with($with)->find($filters['order']) : null,
            'filters' => ['view' => $view, 'search' => $search, 'order' => $filters['order'] ?? null],
            'counts' => [
                'awaiting' => PurchaseOrder::where('status', self::STATUS_INCOMING)->count(),
                'accepted' => PurchaseOrder::whereIn('status', self::PAST_INCOMING)->count(),
            ],
        ]);
    }

    /**
     * The Outgoing screen, in two tabs.
     *
     *   ready     orders with an SSMI, waiting to be handed over
     *   released  every order handed over, newest first, with who collected it
     *             and who released it. An order put back with Change status has
     *             its released_at cleared, so it drops off this tab.
     *
     * `order` selects one order in the detail panel, and is also sent on its own
     * as `focusOrder` so a link to an order on a later page still opens it.
     */
    public function outgoing(Request $request)
    {
        $filters = $request->validate([
            'view' => ['nullable', 'in:ready,released'],
            'search' => ['nullable', 'string', 'max:100'],
            'order' => ['nullable', 'integer'],
        ]);
        $view = $filters['view'] ?? 'ready';
        $search = trim($filters['search'] ?? '');
        $with = ['purchaseRequest.items', 'iars.items', 'openTags.tag', 'openTags.taggedBy', 'releasedBy'];

        $purchaseOrders = PurchaseOrder::with($with)
            ->when(
                $view === 'released',
                fn ($q) => $q->whereNotNull('released_at')->orderByDesc('released_at')->orderByDesc('id'),
                fn ($q) => $q->where('status', self::STATUS_FOR_RELEASE)->latest('updated_at'),
            )
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('PO_Number', 'like', "%{$search}%")
                ->orWhere('PR_Number', 'like', "%{$search}%")
                ->orWhere('PO_Supplier', 'like', "%{$search}%")
                ->orWhere('SSMI_Number', 'like', "%{$search}%")
                ->orWhere('released_to', 'like', "%{$search}%")
                ->orWhereHas('purchaseRequest', fn ($pr) => $pr->where('requester_department', 'like', "%{$search}%"))))
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Inventory/outgoingIndex', [
            'purchaseOrders' => $purchaseOrders,
            'focusOrder' => isset($filters['order']) ? PurchaseOrder::with($with)->find($filters['order']) : null,
            'filters' => ['view' => $view, 'search' => $search, 'order' => $filters['order'] ?? null],
            'counts' => [
                'ready' => PurchaseOrder::where('status', self::STATUS_FOR_RELEASE)->count(),
                'released' => PurchaseOrder::whereNotNull('released_at')->count(),
            ],
        ]);
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

    /**
     * Accept a delivery: the items are in, and go to Inspection & Acceptance.
     *
     * Records when and by whom, which is the order's "date received".
     */
    public function toIAR(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'PO_Number' => ['required', 'string', 'exists:purchase_order,PO_Number'],
        ], [
            'PO_Number.required' => 'No purchase order was given.',
            'PO_Number.exists' => 'That purchase order does not exist.',
        ]);

        $purchaseOrder = PurchaseOrder::where('PO_Number', $validated['PO_Number'])->firstOrFail();

        // Without this, any PO number could be posted from any stage — a completed
        // order included — and be sent back to inspection.
        if ((int) $purchaseOrder->status !== self::STATUS_INCOMING) {
            return back()->with('error', "PO #{$purchaseOrder->PO_Number} is not waiting for delivery.");
        }

        if ($blocker = $purchaseOrder->missingBlocker()) {
            return back()->with('error', $blocker);
        }

        $before = $purchaseOrder->only(['status', 'received_at', 'received_by_emp_id']);

        $purchaseOrder->update([
            'status' => self::STATUS_FOR_INSPECTION,
            'received_at' => now(),
            'received_by_emp_id' => Auth::id(),
        ]);

        $this->audit(
            'delivery_accepted',
            $purchaseOrder,
            "Accepted the delivery for PO #{$purchaseOrder->PO_Number}"
                .($purchaseOrder->PO_Supplier ? " from {$purchaseOrder->PO_Supplier}" : '')
                .'. Sent to inspection.',
            $before,
            $purchaseOrder->only(['status', 'received_at', 'received_by_emp_id']),
        );

        // Land on the acceptance just recorded.
        return redirect()
            ->route('inventory.index', ['view' => 'accepted', 'order' => $purchaseOrder->id])
            ->with('success', "Delivery for PO #{$purchaseOrder->PO_Number} accepted. It is now waiting for inspection.");
    }


    /**
     * Hand the items over and complete the order.
     *
     * The last step of the pipeline, and the only one that leaves the building:
     * it records who released the goods, who collected them, and when. Nothing
     * here is reversible from the module — an order released by mistake is put
     * back with Change status on Request Monitoring, which clears `released_at`.
     */
    public function toRelease(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'PO_Number' => ['required', 'string', 'exists:purchase_order,PO_Number'],
            'released_to' => ['required', 'string', 'max:255'],
            'released_to_department' => ['nullable', 'string', 'max:255'],
            'release_remarks' => ['nullable', 'string', 'max:1000'],
        ], [
            'released_to.required' => 'Record who is collecting the items.',
            // Left to itself, Laravel renders PO_Number as "p o  number".
            'PO_Number.required' => 'No purchase order was given.',
            'PO_Number.exists' => 'That purchase order does not exist.',
        ]);

        $purchaseOrder = PurchaseOrder::where('PO_Number', $validated['PO_Number'])->firstOrFail();

        // Without this, any PO number could be posted from any stage straight to
        // completed, skipping inspection, the issue slip and the stock card.
        if ((int) $purchaseOrder->status !== self::STATUS_FOR_RELEASE) {
            return back()->with('error', "PO #{$purchaseOrder->PO_Number} is not waiting for release.");
        }

        if ($blocker = $purchaseOrder->missingBlocker()) {
            return back()->with('error', $blocker);
        }

        if (! $purchaseOrder->SSMI_Number) {
            return back()->with('error', "PO #{$purchaseOrder->PO_Number} has no SSMI number, so it cannot be released yet.");
        }

        $before = $purchaseOrder->only(['status', 'released_at', 'released_by_emp_id', 'released_to']);

        $purchaseOrder->update([
            'status' => self::STATUS_COMPLETED,
            'released_at' => now(),
            'released_by_emp_id' => Auth::id(),
            'released_to' => $validated['released_to'],
            'released_to_department' => $validated['released_to_department'] ?? null,
            'release_remarks' => $validated['release_remarks'] ?? null,
        ]);

        $this->audit(
            'released',
            $purchaseOrder,
            "Released PO #{$purchaseOrder->PO_Number} to {$purchaseOrder->released_to}"
                .($purchaseOrder->released_to_department ? " ({$purchaseOrder->released_to_department})" : '')
                .'. The order is complete.',
            $before,
            $purchaseOrder->only(['status', 'released_at', 'released_by_emp_id', 'released_to']),
        );

        // Land on the release just recorded, so the hand-over is in front of the user.
        return redirect()
            ->route('inventory.outgoings', ['view' => 'released', 'order' => $purchaseOrder->id])
            ->with('success', "PO #{$purchaseOrder->PO_Number} released to {$purchaseOrder->released_to}. The order is complete.");
    }
}

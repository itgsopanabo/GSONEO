<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\IAR;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class IARController extends Controller
{
    use LogsAudit;

    /**
     * Status codes this module cares about.
     *
     * 300 — delivered, awaiting inspection (appears in the queue). A partially
     *       delivered order stays here until the balance arrives.
     * 400 — every item received in full; on to RIS
     */
    private const STATUS_FOR_INSPECTION = 300;
    private const STATUS_IAR_GENERATED = 400;

    /** Every stage a fully inspected order can have reached, for the Inspected tab. */
    private const PAST_INSPECTION = [400, 500, 550, 600];

    /** What the page shows for each order. */
    private const WITH = ['purchaseRequest.items', 'iars.items', 'openTags.tag', 'openTags.taggedBy', 'receivedBy'];

    /**
     * The IAR screen, in two tabs.
     *
     *   pending    orders waiting for inspection, partial deliveries included:
     *              they stay here until the balance arrives
     *   inspected  orders whose delivery was inspected in full, most recent
     *              report first, so their IARs can still be found and reprinted
     *
     * `order` selects one order in the detail panel, and is also sent on its own
     * as `focusOrder` so a link to an order on a later page still opens it.
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'view' => ['nullable', 'in:pending,inspected'],
            'search' => ['nullable', 'string', 'max:100'],
            'order' => ['nullable', 'integer'],
        ]);
        $view = $filters['view'] ?? 'pending';
        $search = trim($filters['search'] ?? '');

        $purchaseOrders = PurchaseOrder::with(self::WITH)
            ->when(
                $view === 'inspected',
                fn ($q) => $q->whereIn('status', self::PAST_INSPECTION)
                    ->whereHas('iars')
                    ->orderByDesc(IAR::select('id')->whereColumn('iar.PO_Number', 'purchase_order.PO_Number')->latest('id')->limit(1)),
                // Oldest delivery first: it has been waiting longest.
                fn ($q) => $q->where('status', self::STATUS_FOR_INSPECTION)
                    ->orderByRaw('received_at IS NULL')
                    ->orderBy('received_at')
                    ->orderBy('id'),
            )
            ->when($search !== '', fn ($q) => $q->where(fn ($q) => $q
                ->where('PO_Number', 'like', "%{$search}%")
                ->orWhere('PR_Number', 'like', "%{$search}%")
                ->orWhere('PO_Supplier', 'like', "%{$search}%")
                ->orWhereHas('purchaseRequest', fn ($pr) => $pr->where('requester_department', 'like', "%{$search}%"))
                ->orWhereHas('iars', fn ($iar) => $iar->where('iar_number', 'like', "%{$search}%")
                    ->orWhere('invoice_number', 'like', "%{$search}%"))))
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Inventory/IAR/Index', [
            'purchaseOrders' => $purchaseOrders,
            'focusOrder' => isset($filters['order']) ? PurchaseOrder::with(self::WITH)->find($filters['order']) : null,
            'filters' => ['view' => $view, 'search' => $search, 'order' => $filters['order'] ?? null],
            'counts' => [
                'pending' => PurchaseOrder::where('status', self::STATUS_FOR_INSPECTION)->count(),
                'inspected' => PurchaseOrder::whereIn('status', self::PAST_INSPECTION)->whereHas('iars')->count(),
            ],
        ]);
    }

    /**
     * Create an IAR record for one delivery against a purchase order. Does NOT
     * render a PDF — the response is an Inertia redirect, so the queue
     * re-renders with the new report listed. The user prints it via view().
     *
     * Each report records how many of each line arrived. Once every line has
     * been received in full the order is tagged complete and moves to For RIS;
     * until then it is tagged partial and stays For Inspection, so nothing can
     * be issued against goods that have not come in.
     */
    public function generate(Request $request, PurchaseOrder $purchaseOrder)
    {
        $validated = $request->validate([
            'invoice_number'   => ['required', 'string', 'max:255'],
            'invoice_date'     => ['nullable', 'date'],
            'items'            => ['required', 'array', 'min:1'],
            'items.*.id'       => ['required', 'integer', 'distinct'],
            'items.*.quantity' => ['required', 'integer', 'min:0'],
        ], [
            'items.required' => 'Enter the quantity received for at least one item.',
            'items.*.quantity.min' => 'A received quantity cannot be negative.',
        ]);

        try {
            [$iar, $remaining] = DB::transaction(fn () => $this->record($purchaseOrder, $validated));
        } catch (DomainException $e) {
            return back()->with('error', $e->getMessage());
        }

        // Stay on the order: a complete one has moved to the Inspected tab, a
        // partial one is still waiting here for the rest.
        if ($iar->delivery_status === IAR::DELIVERY_COMPLETE) {
            return redirect()
                ->route('inspection-acceptance-reports.index', ['view' => 'inspected', 'order' => $purchaseOrder->id])
                ->with('success', "IAR #{$iar->iar_number} generated. All items are delivered; the order is now For RIS.");
        }

        $lines = $remaining === 1 ? '1 item still has' : "{$remaining} items still have";

        return redirect()
            ->route('inspection-acceptance-reports.index', ['order' => $purchaseOrder->id])
            ->with('success', "IAR #{$iar->iar_number} generated as a partial delivery. {$lines} a balance; the order stays For Inspection until the rest arrives.");
    }

    /**
     * Stream the PDF for an IAR that already exists. Safe to call repeatedly —
     * it creates nothing and changes no status.
     */
    public function view(IAR $iar)
    {
        $purchaseOrder = PurchaseOrder::where('PO_Number', $iar->PO_Number)->firstOrFail();

        $pdf = Pdf::loadView('pdf.inspection-acceptance-report', [
            'purchaseOrder'  => $purchaseOrder,
            'invoiceNumber'  => $iar->invoice_number,
            'invoiceDate'    => $iar->invoice_date ? \Carbon\Carbon::parse($iar->invoice_date)->format('F d, Y') : null,
            'iarNumber'      => $iar->iar_number,
            'deliveryStatus' => $iar->delivery_status,
            'items'          => $this->linesOn($iar, $purchaseOrder),
        ]);

        return $pdf->stream("{$iar->iar_number}.pdf");
    }

    /**
     * One order. It rendered an IAR/Show page that was never written; it now
     * opens the order in the IAR screen, on whichever tab it belongs to.
     */
    public function show(PurchaseOrder $purchase_order)
    {
        return redirect()->route('inspection-acceptance-reports.index', [
            'view' => in_array((int) $purchase_order->status, self::PAST_INSPECTION, true) ? 'inspected' : 'pending',
            'order' => $purchase_order->id,
        ]);
    }

    /* ------------------------------------------------------------------ *
     * Helpers
     * ------------------------------------------------------------------ */

    /**
     * Check the delivery against what is still outstanding and save it.
     *
     * Runs inside a transaction with the order row locked, so two people
     * receiving the same order at once cannot both accept the last balance.
     *
     * @return array{0: IAR, 1: int}  the new report, and how many lines still have a balance
     */
    private function record(PurchaseOrder $purchaseOrder, array $validated): array
    {
        $purchaseOrder = PurchaseOrder::whereKey($purchaseOrder->getKey())->lockForUpdate()->firstOrFail();

        if ((int) $purchaseOrder->status !== self::STATUS_FOR_INSPECTION) {
            throw new DomainException($purchaseOrder->delivery_status === IAR::DELIVERY_COMPLETE
                ? "Every item on PO #{$purchaseOrder->PO_Number} has already been received."
                : "PO #{$purchaseOrder->PO_Number} is not awaiting inspection.");
        }

        if ($blocker = $purchaseOrder->missingBlocker()) {
            throw new DomainException($blocker);
        }

        // The same invoice twice on one order is a duplicate whatever the intent.
        // The unique index added in 2026_09_16_000300 is the real guard; this is
        // the readable version of it.
        if ($purchaseOrder->iars()->where('invoice_number', $validated['invoice_number'])->exists()) {
            throw new DomainException("Invoice {$validated['invoice_number']} is already on an IAR for this purchase order.");
        }

        $lines = $this->itemsFor($purchaseOrder)->keyBy('id');
        $received = $purchaseOrder->receivedQuantities();

        $delivered = [];
        foreach ($validated['items'] as $row) {
            $line = $lines->get($row['id']);

            if (! $line) {
                throw new DomainException('An item on this report is not on the purchase request.');
            }

            $quantity = (int) $row['quantity'];
            if ($quantity === 0) {
                continue;
            }

            $balance = $line->quantity - ($received[$line->id] ?? 0);
            if ($quantity > $balance) {
                throw new DomainException("{$line->item_desc}: {$quantity} {$line->unit} entered, but only {$balance} still to be delivered.");
            }

            $delivered[$line->id] = $quantity;
        }

        if (! $delivered) {
            throw new DomainException('Enter the quantity received for at least one item.');
        }

        $remaining = $lines
            ->filter(fn ($line) => ($received[$line->id] ?? 0) + ($delivered[$line->id] ?? 0) < $line->quantity)
            ->count();

        $deliveryStatus = $remaining === 0 ? IAR::DELIVERY_COMPLETE : IAR::DELIVERY_PARTIAL;

        $iar = IAR::create([
            'iar_number'      => $this->nextIarNumber(),
            'invoice_number'  => $validated['invoice_number'],
            'invoice_date'    => $validated['invoice_date'] ?? null,
            'delivery_status' => $deliveryStatus,
            'PO_Number'       => $purchaseOrder->PO_Number,
        ]);

        $iar->items()->createMany(collect($delivered)->map(fn ($quantity, $lineId) => [
            'purchase_request_item_id' => $lineId,
            'quantity_received'        => $quantity,
        ])->values()->all());

        $before = $purchaseOrder->only(['status', 'delivery_status']);

        $purchaseOrder->update([
            'delivery_status' => $deliveryStatus,
            'status'          => $remaining === 0 ? self::STATUS_IAR_GENERATED : self::STATUS_FOR_INSPECTION,
        ]);

        $this->audit(
            'Generate IAR',
            $purchaseOrder,
            "Generated {$iar->iar_number} (invoice {$iar->invoice_number}) for PO #{$purchaseOrder->PO_Number}: "
                .($remaining === 0 ? 'delivery complete.' : "partial delivery, {$remaining} item(s) with a balance."),
            $before,
            $purchaseOrder->only(['status', 'delivery_status']) + ['iar_number' => $iar->iar_number, 'received' => $delivered],
        );

        return [$iar, $remaining];
    }

    /**
     * Next IAR number for the current year, e.g. IAR-2026-0007.
     *
     * Derived from the last record's number rather than a row count, so
     * deleting a report can't cause the next one to collide with an
     * existing number.
     */
    private function nextIarNumber(): string
    {
        $year = now()->year;

        $last = IAR::whereYear('created_at', $year)
            ->latest('id')
            ->first();

        $sequence = 1;
        if ($last) {
            $parts = explode('-', $last->iar_number);
            $sequence = intval(end($parts)) + 1;
        }

        return sprintf('IAR-%d-%04d', $year, $sequence);
    }

    /**
     * Line items behind a purchase order.
     *
     * PurchaseOrder stores PR_Number as a string rather than a foreign key,
     * so this looks the request up by that column.
     */
    private function itemsFor(PurchaseOrder $purchaseOrder): Collection
    {
        if (! $purchaseOrder->PR_Number) {
            return collect();
        }

        $purchaseRequest = PurchaseRequest::where('pr_number', $purchaseOrder->PR_Number)->first();

        return $purchaseRequest ? $purchaseRequest->items : collect();
    }

    /**
     * The lines printed on one report, with the quantity that report received.
     *
     * Reports made before quantities were recorded have no item rows; they
     * print every line at its ordered quantity, as they always did.
     */
    private function linesOn(IAR $iar, PurchaseOrder $purchaseOrder): Collection
    {
        $iar->load('items.purchaseRequestItem');

        if ($iar->items->isEmpty()) {
            return $this->itemsFor($purchaseOrder);
        }

        return $iar->items
            ->filter(fn ($row) => $row->purchaseRequestItem)
            ->map(fn ($row) => tap(clone $row->purchaseRequestItem, function ($line) use ($row) {
                $line->quantity_ordered = $line->quantity;
                $line->quantity = $row->quantity_received;
            }))
            ->values();
    }
}

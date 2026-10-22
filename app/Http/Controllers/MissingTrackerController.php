<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderTag;
use App\Models\TrackerTag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Tagging orders with what they are missing, and the page that lists them.
 *
 * An open tag whose tag is set to hold the order keeps it at its stage: every
 * forward action refuses it until the tag is resolved (see
 * PurchaseOrder::missingBlocker). Tags set not to hold are reminders only. Tags are raised
 * and resolved from the detail panel of any inventory page, and listed together
 * on the Missing Tracker page.
 */
class MissingTrackerController extends Controller
{
    use LogsAudit;

    /** Anyone working any inventory stage may tag and resolve. */
    public const PERMISSIONS = ['inventory.incoming', 'inventory.iar', 'inventory.ris', 'inventory.ssmi', 'inventory.outgoing'];

    /** The stages an order can be tagged at, in pipeline order, for the stage filter. */
    private const STAGES = [230, 300, 400, 500, 550, 600];

    /**
     * Every tag raised on an order, open or resolved.
     *
     * Open tags list oldest first by default: the one waiting longest is the
     * one most likely to be forgotten. Resolved ones list most recent first.
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'tag' => ['nullable', 'integer'],
            'state' => ['nullable', Rule::in(['open', 'resolved'])],
            'stage' => ['nullable', 'integer', Rule::in(self::STAGES)],
            'sort' => ['nullable', Rule::in(['oldest', 'newest'])],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        $state = $filters['state'] ?? 'open';
        $sort = $filters['sort'] ?? ($state === 'open' ? 'oldest' : 'newest');
        $dateColumn = $state === 'open' ? 'created_at' : 'resolved_at';

        $entries = PurchaseOrderTag::query()
            ->with(['tag', 'taggedBy', 'resolvedBy', 'purchaseOrder.purchaseRequest:id,pr_number,requester_department'])
            ->when($state === 'open', fn ($q) => $q->open(), fn ($q) => $q->whereNotNull('resolved_at'))
            ->when($filters['tag'] ?? null, fn ($q, $tag) => $q->where('tracker_tag_id', $tag))
            ->when($filters['stage'] ?? null, fn ($q, $stage) => $q->whereHas('purchaseOrder', fn ($po) => $po->where('status', $stage)))
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->where(fn ($q) => $q
                ->where('note', 'like', "%{$search}%")
                ->orWhereHas('purchaseOrder', fn ($po) => $po->where('PO_Number', 'like', "%{$search}%")
                    ->orWhere('PR_Number', 'like', "%{$search}%")
                    ->orWhere('PO_Supplier', 'like', "%{$search}%")
                    ->orWhereHas('purchaseRequest', fn ($pr) => $pr->where('requester_department', 'like', "%{$search}%")))))
            ->orderBy($dateColumn, $sort === 'oldest' ? 'asc' : 'desc')
            ->orderBy('id', $sort === 'oldest' ? 'asc' : 'desc')
            ->paginate(25)
            ->withQueryString();

        $open = PurchaseOrderTag::open();

        return Inertia::render('Inventory/MissingTracker', [
            'entries' => $entries,
            // Open count per tag, for the filter chips.
            'tags' => TrackerTag::query()
                ->withCount(['uses as open_count' => fn ($q) => $q->open()])
                ->orderBy('name')
                ->get(['id', 'name', 'color', 'holds_order', 'is_active']),
            // Open count per stage the tagged order is at, for the stage filter.
            'stages' => (clone $open)
                ->join('purchase_order', 'purchase_order.id', '=', 'purchase_order_tags.purchase_order_id')
                ->groupBy('purchase_order.status')
                ->selectRaw('purchase_order.status as code, COUNT(*) as open_count')
                ->pluck('open_count', 'code'),
            'stats' => [
                'open' => (clone $open)->count(),
                // Orders, not tags: one order held by two tags is one order held.
                'held_orders' => (clone $open)
                    ->whereHas('tag', fn ($tag) => $tag->where('holds_order', true))
                    ->distinct()
                    ->count('purchase_order_id'),
                'oldest_open_at' => (clone $open)->min('created_at'),
                'resolved_30d' => PurchaseOrderTag::where('resolved_at', '>=', now()->subDays(30))->count(),
                'resolved' => PurchaseOrderTag::whereNotNull('resolved_at')->count(),
            ],
            'filters' => ['state' => $state, 'sort' => $sort] + $filters,
        ]);
    }

    public function store(Request $request, PurchaseOrder $purchaseOrder): RedirectResponse
    {
        $validated = $request->validate([
            'tracker_tag_id' => ['required', 'integer', Rule::exists('tracker_tags', 'id')->where('is_active', true)],
            'note' => ['nullable', 'string', 'max:1000'],
        ], [
            'tracker_tag_id.required' => 'Choose what is missing.',
            'tracker_tag_id.exists' => 'That tag is no longer offered.',
        ]);

        $tag = TrackerTag::findOrFail($validated['tracker_tag_id']);
        $label = $purchaseOrder->PO_Number ?? $purchaseOrder->PR_Number;

        // The same thing cannot be missing twice at once; add to the note instead.
        if ($purchaseOrder->openTags()->where('tracker_tag_id', $tag->id)->exists()) {
            return back()->with('error', "{$label} is already tagged \"{$tag->name}\".");
        }

        $entry = $purchaseOrder->trackerTags()->create([
            'tracker_tag_id' => $tag->id,
            'note' => $validated['note'] ?? null,
            'tagged_by_emp_id' => Auth::id(),
        ]);

        $this->audit(
            'Tagged as missing',
            $purchaseOrder,
            "Tagged {$label} \"{$tag->name}\"".($entry->note ? ": {$entry->note}" : '.'),
            null,
            ['tag' => $tag->name, 'note' => $entry->note],
        );

        return back()->with('success', "{$label} tagged \"{$tag->name}\".");
    }

    public function resolve(Request $request, PurchaseOrderTag $purchaseOrderTag): RedirectResponse
    {
        $validated = $request->validate([
            'resolution_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $purchaseOrderTag->load(['tag', 'purchaseOrder']);
        $order = $purchaseOrderTag->purchaseOrder;
        $label = $order->PO_Number ?? $order->PR_Number;

        if ($purchaseOrderTag->resolved_at) {
            return back()->with('error', "\"{$purchaseOrderTag->tag->name}\" on {$label} was already resolved.");
        }

        $purchaseOrderTag->update([
            'resolved_at' => now(),
            'resolved_by_emp_id' => Auth::id(),
            'resolution_note' => $validated['resolution_note'] ?? null,
        ]);

        $this->audit(
            'Missing tag resolved',
            $order,
            "Resolved \"{$purchaseOrderTag->tag->name}\" on {$label}"
                .($purchaseOrderTag->resolution_note ? ": {$purchaseOrderTag->resolution_note}" : '.'),
            ['tag' => $purchaseOrderTag->tag->name, 'resolved_at' => null],
            ['tag' => $purchaseOrderTag->tag->name, 'resolved_at' => $purchaseOrderTag->resolved_at->toDateTimeString()],
        );

        return back()->with('success', "\"{$purchaseOrderTag->tag->name}\" on {$label} resolved.");
    }
}

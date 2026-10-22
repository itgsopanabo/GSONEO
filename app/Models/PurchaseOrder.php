<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @method static create(array $array)
 * @method static where(string $string, string $string1, string $string2)
 */
class PurchaseOrder extends Model
{
    protected $table = 'purchase_order';

    /**
     * TODO add the SSMI_Number, SSMI_Date, ssmiNumbered_by for SSMI Integration
     */
    protected $fillable = [
        'PO_Number', 'PO_Supplier', 'PO_Date', 'PR_Number', 'supplier_receive_date', 'poNumbered_by', 'status', 'RIS_Number', 'RIS_Date', 'risNumbered_by',
        // IAR::DELIVERY_PARTIAL / DELIVERY_COMPLETE, null until the first IAR.
        'delivery_status',
        // When the delivery was accepted on the Incoming page, and by whom.
        'received_at',
        'received_by_emp_id',
        'SSMI_Number',
        'SSMI_Date',
        'ssmiNumbered_by',
        // A key of config('documents.fund_sources'), chosen with the SSMI number.
        'fund_source',
        'cancelled_by_emp_id',
        'cancelled_at',
        'cancellation_reason',
        'released_at',
        'released_by_emp_id',
        'released_to',
        'released_to_department',
        'release_remarks',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }


    /** Who accepted the delivery, shown on the Incoming page's Accepted tab. */
    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by_emp_id', 'emp_id');
    }

    /** Who generated the SSMI number, shown on the SSMI page. */
    public function ssmiNumberedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ssmiNumbered_by', 'emp_id');
    }

    /** Who handed the items over, shown on the Outgoing page's Released tab. */
    public function releasedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by_emp_id', 'emp_id');
    }

    public function purchaseRequest(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequest::class, 'PR_Number', 'pr_number');
    }


    public function iars()
    {
        return $this->hasMany(IAR::class, 'PO_Number', 'PO_Number')->latest('id');
    }

    /** Every tracker tag the order has had, resolved ones included. */
    public function trackerTags()
    {
        return $this->hasMany(PurchaseOrderTag::class)->latest('id');
    }

    /**
     * What the order is still missing. The inventory pages load this as
     * `openTags.tag` so each row can show its tags.
     */
    public function openTags()
    {
        return $this->trackerTags()->open();
    }

    /**
     * Why the order cannot move to its next stage yet, or null when it can.
     *
     * An open tag whose tag holds the order keeps it where it is: every forward
     * action in the inventory pipeline (to IAR, IAR, RIS, SSMI, outgoing,
     * release) checks this, and the pages disable their buttons to match. Tags
     * set not to hold are reminders only. Administrators can still move an order
     * with Change status on Request Monitoring.
     */
    public function missingBlocker(): ?string
    {
        $missing = $this->openTags()
            ->whereHas('tag', fn ($tag) => $tag->where('holds_order', true))
            ->with('tag')
            ->get()
            ->pluck('tag.name')
            ->filter()
            ->unique();

        if ($missing->isEmpty()) {
            return null;
        }

        $label = $this->PO_Number ?? $this->PR_Number;

        $them = $missing->count() === 1 ? 'it' : 'them';

        return "{$label} is still missing: {$missing->join(', ', ' and ')}. Resolve {$them} before moving the order on.";
    }

    /**
     * Quantity received so far on each request line, across every IAR,
     * keyed by purchase_request_item_id.
     *
     * @return array<int, int>
     */
    public function receivedQuantities(): array
    {
        return IARItem::query()
            ->join('iar', 'iar.id', '=', 'iar_items.iar_id')
            ->where('iar.PO_Number', $this->PO_Number)
            ->groupBy('iar_items.purchase_request_item_id')
            ->selectRaw('iar_items.purchase_request_item_id, SUM(iar_items.quantity_received) as received')
            ->pluck('received', 'purchase_request_item_id')
            ->map(fn ($qty) => (int) $qty)
            ->all();
    }
}

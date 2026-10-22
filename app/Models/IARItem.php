<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * How many of one request line arrived on one IAR.
 */
class IARItem extends Model
{
    protected $table = 'iar_items';

    protected $fillable = [
        'iar_id',
        'purchase_request_item_id',
        'quantity_received',
    ];

    protected $casts = [
        'quantity_received' => 'integer',
    ];

    public function iar(): BelongsTo
    {
        return $this->belongsTo(IAR::class, 'iar_id');
    }

    public function purchaseRequestItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequestItem::class);
    }
}

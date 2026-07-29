<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseRequestItem extends Model
{

    use HasFactory;

    protected $fillable = [
        'purchase_request_id',
        'item_name',
        'item_desc',
        'quantity',
        'unit',
        'estimated_unit_cost', // Changed from price to cost
        'total_estimated_cost', // Changed from subtotal to cost

    ];

    /**
     * Get the purchase request that owns this item line.
     */
    public function purchaseRequest(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequest::class);
    }
}

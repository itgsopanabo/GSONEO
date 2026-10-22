<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One tracker tag on one purchase order: open until someone resolves it.
 */
class PurchaseOrderTag extends Model
{
    protected $fillable = [
        'purchase_order_id',
        'tracker_tag_id',
        'note',
        'tagged_by_emp_id',
        'resolved_at',
        'resolved_by_emp_id',
        'resolution_note',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function tag(): BelongsTo
    {
        return $this->belongsTo(TrackerTag::class, 'tracker_tag_id');
    }

    public function taggedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tagged_by_emp_id', 'emp_id');
    }

    public function resolvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by_emp_id', 'emp_id');
    }

    public function scopeOpen($query)
    {
        return $query->whereNull('resolved_at');
    }
}

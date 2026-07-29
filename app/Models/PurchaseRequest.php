<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @method static count()
 * @method static create(array $array)
 * @method static where(string $string, string $id)
 * @method static findOrFail(string $id)
 */
class PurchaseRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'pr_number',
        'requester_name',
        'requester_department',
        'needed_by_date',
        'remarks_or_notes',
        'verify_by_emp_id',
        'status',
        'decline_by_emp_id',
        'declined_At',
        'verified_At',
        'reason_to_decline',
        'canvas_start_At',
        'canvas_end_At',
        'canvas_started_by_emp_id',
        'canvas_ended_by_emp_id',
        'PO_Number',
        'PO_Date',
        'PO_Supplier',
        'supplier_receive_date',
        'poNumbered_by',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseRequestItem::class);
    }


    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'pr_number', 'PR_Number');
    }
}

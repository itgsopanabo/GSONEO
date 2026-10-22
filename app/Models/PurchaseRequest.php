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
        'requester_department',
        'needed_by_date',
        'remarks_or_notes',
        'verify_by_emp_id',
        'status',
        'decline_by_emp_id',
        'declined_At',
        'cancelled_by_emp_id',
        'cancelled_at',
        'cancellation_reason',
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
        'mode_of_procurement',
        'encoded_by',
        'encoded_at',
    ];

    /** The trail identifies a request by its PR number, not its row id. */
    public function getAuditKey(): string
    {
        return $this->pr_number;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Who verified, encoded and declined it — shown on the Purchase Requests page. */
    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verify_by_emp_id', 'emp_id');
    }

    public function encoder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'encoded_by', 'emp_id');
    }

    public function declinedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decline_by_emp_id', 'emp_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseRequestItem::class);
    }

    public function canvasForms(): HasMany
    {
        return $this->hasMany(CanvasForms::class, 'pr_number', 'pr_number');
    }


    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'pr_number', 'PR_Number');
    }
}

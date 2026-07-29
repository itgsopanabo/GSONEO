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

    protected $fillable = [
        'PO_Number', 'PO_Supplier', 'PO_Date', 'PR_Number', 'supplier_receive_date', 'poNumbered_by', 'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }


    public function purchaseRequest(): BelongsTo
    {
        return $this->belongsTo(PurchaseRequest::class, 'PR_Number', 'pr_number');
    }


}

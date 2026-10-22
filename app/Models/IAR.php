<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @method static where(string $string, string $string1, string $string2)
 * @method static create(array $array)
 * @method static whereYear(string $string, int $year)
 */
class IAR extends Model
{
    /** Some lines still have a balance to be delivered. */
    public const DELIVERY_PARTIAL = 'partial';

    /** Every line has been received in full. */
    public const DELIVERY_COMPLETE = 'complete';

    protected $table = 'iar';
    protected $fillable = [
        'iar_number',
        'invoice_number',
        'invoice_date',
        'delivery_status',
        'PO_Number',
    ];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'PO_Number', 'PO_Number');
    }

    public function items(): HasMany
    {
        return $this->hasMany(IARItem::class, 'iar_id');
    }
}

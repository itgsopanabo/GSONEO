<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @method static where(string $string, string $string1, string $string2)
 * @method static create(array $array)
 * @method static whereYear(string $string, int $year)
 */
class IAR extends Model
{
    protected $fillable = [
        'iar_number',
        'invoice_number',
        'PO_Number',
    ];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'PO_Number', 'PO_Number');
    }

}

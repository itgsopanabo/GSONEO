<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @method static create(array $array)
 * @method static whereYear(string $string, int $currentYear)
 */
class CanvasForms extends Model
{

    protected $table = 'canvasForms';

    protected $fillable = [
        'CF_Number',
        'CF_to_be_Open',
        'CF_delivery_Period',
        'CF_made_by',
        'CF_canvasser',
        'pr_number',
        'CF_bac_date'
    ];



    /**
     * Get the purchase request that owns this canvas form.
     */
    public function purchaseRequest(): BelongsTo
    {
        // 1st param: The parent model
        // 2nd param: The column name on the canvasForms table ('pr_number')
        // 3rd param: The column name on the purchase_requests table it matches ('pr_number')
        return $this->belongsTo(PurchaseRequest::class, 'pr_number', 'pr_number');
    }
}

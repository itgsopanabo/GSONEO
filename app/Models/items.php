<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @method static factory()
 * @method static create(array $data)
 */
class items extends Model
{
    protected $fillable = [
        'item_desc',
        'item_price',
        'item_unit',

    ];
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One letterhead or watermark setting for generated PDFs. Read them through
 * App\Services\DocumentBranding, which fills in the defaults.
 */
class DocumentSetting extends Model
{
    protected $fillable = ['key', 'value'];
}

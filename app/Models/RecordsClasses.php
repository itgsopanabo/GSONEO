<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecordsClasses extends Model
{

    protected $table = 'record_classes';

    protected $fillable = [
        'code', 'title', 'description', 'rds_source', 'rds_item_no',
        'retention_years', 'retention_trigger', 'is_permanent',
        'is_vital', 'sensitivity', 'is_active',
    ];

    protected $casts = [
        'is_permanent' => 'boolean',
        'is_vital'     => 'boolean',
        'is_active'    => 'boolean',
    ];

    public const SENSITIVITIES = ['public', 'internal', 'restricted'];
    public const TRIGGERS = ['creation', 'audit_settlement', 'asset_disposal', 'contract_completion'];

    public function records(): HasMany
    {
        return $this->hasMany(Records::class, 'record_class_id');
    }

    protected static function booted(): void
    {
        static::saving(function (RecordsClasses $class) {
            if ($class->is_permanent) {
                $class->retention_years = null;
            }
        });
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Status extends Model
{
    /** Eloquent would guess `statuses`, so point it at your table. */
    protected $table = 'status';

    protected $fillable = [
        'status_code',
        'status_desc',
    ];

    /** Resolved once per request — these rows rarely change. */
    private static ?int $activeId = null;
    private static ?array $selectableIds = null;

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'status_id');
    }

    public function isActive(): bool
    {
        return (int) $this->status_code === config('Users.active_status_code');
    }

    /** Only the statuses user management is allowed to assign. */
    public function scopeSelectable(Builder $query): Builder
    {
        return $query->whereIn('status_code', config('Users.selectable_status_codes'));
    }

    /** Primary key of the sign-in-permitted status, looked up by its code. */
    public static function activeId(): ?int
    {
        return self::$activeId ??= static::query()
            ->where('status_code', config('Users.active_status_code'))
            ->value('id');
    }

    /** Primary keys of every assignable status, for validation. */
    public static function selectableIds(): array
    {
        return self::$selectableIds ??= static::query()
            ->selectable()
            ->pluck('id')
            ->all();
    }
}

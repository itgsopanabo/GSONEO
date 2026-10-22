<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * Something an order can be missing, e.g. "Missing signature".
 *
 * Kept on the Tracker Tags screen. Every inventory page offers the active ones,
 * so the list is cached and dropped whenever a tag changes.
 */
class TrackerTag extends Model
{
    /** The colours a tag may take; the pages map each to their own styles. */
    public const COLORS = ['amber', 'rose', 'sky', 'violet', 'emerald', 'slate'];

    private const CACHE_KEY = 'tracker_tags.active';

    // holds_order: while open on an order, the order cannot move to its next
    // stage (PurchaseOrder::missingBlocker). Off, the tag is only a reminder.
    protected $fillable = ['name', 'description', 'color', 'holds_order', 'is_active'];

    protected $casts = [
        'holds_order' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function uses(): HasMany
    {
        return $this->hasMany(PurchaseOrderTag::class);
    }

    /**
     * The tags offered when tagging an order.
     *
     * @return array<int, array{id: int, name: string, description: ?string, color: string, holds_order: bool}>
     */
    public static function options(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, fn () => static::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'color', 'holds_order'])
            ->toArray());
    }

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget(self::CACHE_KEY);

        static::saved($forget);
        static::deleted($forget);
    }
}

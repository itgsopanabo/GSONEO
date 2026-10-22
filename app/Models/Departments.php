<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

/**
 * A requesting office — "City Agriculture Office", code CAGRO.
 *
 * Kept on the Requesting Offices screen. Requests, records and releases store
 * the office's name, so a rename is carried onto them (OfficeController).
 *
 * @method static select(string $string, string $string1)
 */
class Departments extends Model
{
    protected $table = 'departments';

    protected $fillable = ['Department_Name', 'Department_Code', 'Department_Desc', 'is_active'];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    private const CACHE_KEY = 'offices.active';

    /**
     * Where an office's name is written down, as [table, column]. A rename
     * updates every one of them; a delete is refused while any uses it.
     */
    public const USED_IN = [
        ['purchase_requests', 'requester_department'],
        ['records', 'originating_office'],
        ['purchase_order', 'released_to_department'],
    ];

    /**
     * The offices offered in every form, cached — they are on most pages and
     * rarely change.
     *
     * @return array<int, array{name: string, code: string}>
     */
    public static function options(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, fn () => static::query()
            ->where('is_active', true)
            ->orderBy('Department_Name')
            ->get(['Department_Name', 'Department_Code'])
            ->map(fn ($office) => ['name' => $office->Department_Name, 'code' => $office->Department_Code])
            ->all());
    }

    /**
     * Validation for a field that holds an office name: an active office, or
     * the value the record already has — so a request or record that names an
     * office since retired can still be saved unchanged.
     */
    public static function nameRule(?string $current = null): array
    {
        return [
            'string',
            'max:255',
            function (string $attribute, mixed $value, \Closure $fail) use ($current) {
                if ($current !== null && $value === $current) {
                    return;
                }
                if (! collect(self::options())->contains('name', $value)) {
                    $fail('Choose an office from the list.');
                }
            },
        ];
    }

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget(self::CACHE_KEY);

        static::saved($forget);
        static::deleted($forget);
    }
}

<?php

namespace App\Support;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Numbers for PR, PO, Canvass, IAR, RIS and SSMI: `YYYY-MM-NNNN`, for
 * example 2026-11-0001.
 *
 * The month is the month the number is issued. The serial counts through the
 * whole year and starts again at 0001 in January, so 2026-11-0057 is followed
 * by 2026-12-0058. A serial is therefore unique within its year, whatever the
 * month in front of it.
 *
 * Numbers issued before this format (`PO-2026-00012`, `RIS-2026-0004`, ...)
 * still count towards the year's serials when their old prefixes are passed
 * in, so the first new-style number continues where the old ones stopped
 * instead of repeating 0001.
 *
 * Call these inside a DB::transaction: the rows are read with lockForUpdate
 * so two people numbering at once are not handed the same serial.
 */
final class DocumentNumber
{
    public static function format(int $sequence, ?CarbonInterface $date = null): string
    {
        return sprintf('%s-%04d', ($date ?? now())->format('Y-m'), $sequence);
    }

    /** The next serial after the highest one used this year. */
    public static function next(Builder $query, string $column, array $legacyPrefixes = [], ?CarbonInterface $date = null): string
    {
        $date ??= now();
        $used = self::usedSequences($query, $column, $date->year, $legacyPrefixes);

        return self::format(($used->max() ?? 0) + 1, $date);
    }

    /**
     * The lowest serial not yet used this year, so a hand-entered number
     * doesn't leave the ones below it skipped (1 and 4 used: the next is 2).
     */
    public static function firstFree(Builder $query, string $column, array $legacyPrefixes = [], ?CarbonInterface $date = null): string
    {
        $date ??= now();
        $used = self::usedSequences($query, $column, $date->year, $legacyPrefixes)->flip();

        $sequence = 1;
        while ($used->has($sequence)) {
            $sequence++;
        }

        return self::format($sequence, $date);
    }

    /**
     * A hand-entered serial, dated this month. Refused when the year already
     * has that serial, even under another month (2026-10-0012 blocks
     * 2026-11-0012).
     *
     * @throws ValidationException
     */
    public static function manual(Builder $query, string $column, int $sequence, string $field, array $legacyPrefixes = [], ?CarbonInterface $date = null): string
    {
        $date ??= now();
        $number = self::format($sequence, $date);

        $taken = (clone $query)
            ->where(function (Builder $q) use ($column, $date, $legacyPrefixes) {
                $q->where($column, 'like', "{$date->year}-%");
                foreach ($legacyPrefixes as $prefix) {
                    $q->orWhere($column, 'like', "{$prefix}-{$date->year}-%");
                }
            })
            ->lockForUpdate()
            ->pluck($column)
            ->first(fn (?string $existing) => self::sequence($existing, $date->year, $legacyPrefixes) === $sequence);

        if ($taken !== null) {
            throw ValidationException::withMessages([
                $field => $taken === $number
                    ? "{$number} already exists."
                    : sprintf('Serial %04d is already used this year by %s.', $sequence, $taken),
            ]);
        }

        return $number;
    }

    /**
     * Serials already used in `$year`, read under a row lock.
     *
     * @return Collection<int, int>
     */
    public static function usedSequences(Builder $query, string $column, int $year, array $legacyPrefixes = []): Collection
    {
        return $query
            ->where(function (Builder $q) use ($column, $year, $legacyPrefixes) {
                $q->where($column, 'like', "{$year}-%");
                foreach ($legacyPrefixes as $prefix) {
                    $q->orWhere($column, 'like', "{$prefix}-{$year}-%");
                }
            })
            ->lockForUpdate()
            ->pluck($column)
            ->map(fn (?string $number) => self::sequence($number, $year, $legacyPrefixes))
            ->filter()
            ->unique()
            ->values();
    }

    /** The serial of a number from `$year`, or null when it isn't one. */
    public static function sequence(?string $number, int $year, array $legacyPrefixes = []): ?int
    {
        if ($number === null) {
            return null;
        }

        if (preg_match('/^' . $year . '-(0[1-9]|1[0-2])-(\d+)$/', $number, $m)) {
            return (int) $m[2];
        }

        foreach ($legacyPrefixes as $prefix) {
            if (preg_match('/^' . preg_quote($prefix, '/') . '-' . $year . '-(\d+)$/', $number, $m)) {
                return (int) $m[1];
            }
        }

        return null;
    }
}

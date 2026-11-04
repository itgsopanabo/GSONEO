<?php

namespace App\Support;

use App\Models\CanvasForms;
use App\Models\DocumentSetting;
use App\Models\IAR;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

/**
 * Numbers for PR, PO, Canvass, IAR, RIS and SSMI: `YYYY-MM-NNNN`, for
 * example 2026-11-0001.
 *
 * The month is the month the number is issued. The serial counts through the
 * whole year and starts again in January, so 2026-11-0057 is followed by
 * 2026-12-0058. A serial is therefore unique within its year, whatever the
 * month in front of it.
 *
 * Each year can have a starting serial per document, set on the Document
 * Numbering screen: with 2026's PO start at 1000, the first PO the system
 * issues in 2026 is 2026-11-1000, leaving 0001-0999 to the orders made on
 * paper before it. A year with no start begins at 0001. The start only ever
 * moves numbering forward: once the issued serials pass it, they carry on.
 *
 * Numbers issued before this format (`PO-2026-00012`, `RIS-2026-0004`, ...)
 * still count towards the year's serials, so the first new-style number
 * continues where the old ones stopped instead of repeating 0001.
 *
 * Call these inside a DB::transaction: the rows are read with lockForUpdate
 * so two people numbering at once are not handed the same serial.
 */
final class DocumentNumber
{
    /** key => [label, model, column, prefixes of the old PREFIX-YYYY-NNNN numbers] */
    public const DOCUMENTS = [
        'pr'      => ['Purchase Request (PR)', PurchaseRequest::class, 'pr_number', ['PR', 'EPR']],
        'canvass' => ['Canvass', CanvasForms::class, 'CF_Number', []],
        'po'      => ['Purchase Order (PO)', PurchaseOrder::class, 'PO_Number', ['PO']],
        'iar'     => ['Inspection and Acceptance Report (IAR)', IAR::class, 'iar_number', ['IAR']],
        'ris'     => ['Requisition and Issue Slip (RIS)', PurchaseOrder::class, 'RIS_Number', ['RIS']],
        'ssmi'    => ['SSMI', PurchaseOrder::class, 'SSMI_Number', ['SSMI']],
    ];

    /** Numbered with firstFree() rather than next(): POs, whose numbers can be typed in by hand. */
    public const FILLS_GAPS = ['po'];

    public const MAX_SERIAL = 9999;

    private const STARTS_KEY = 'numbering_start.';

    public static function format(int $sequence, ?CarbonInterface $date = null): string
    {
        return sprintf('%s-%04d', ($date ?? now())->format('Y-m'), $sequence);
    }

    /** The next serial after the highest one used this year, or the year's start if that is higher. */
    public static function next(string $document, ?CarbonInterface $date = null): string
    {
        $date ??= now();
        $used = self::usedSequences($document, $date->year, lock: true);

        return self::format(max(($used->max() ?? 0) + 1, self::start($document, $date->year)), $date);
    }

    /**
     * The lowest serial from the year's start that isn't used yet, so a
     * hand-entered number doesn't leave the ones below it skipped (1 and 4
     * used: the next is 2).
     */
    public static function firstFree(string $document, ?int $ignoreId = null, ?CarbonInterface $date = null): string
    {
        $date ??= now();
        $used = self::usedSequences($document, $date->year, $ignoreId, lock: true)->flip();

        $sequence = self::start($document, $date->year);
        while ($used->has($sequence)) {
            $sequence++;
        }

        return self::format($sequence, $date);
    }

    /**
     * A hand-entered serial, dated this month. Refused when the year already
     * has that serial, even under another month (2026-10-0012 blocks
     * 2026-11-0012). It may sit below the year's start, for documents first
     * made on paper.
     *
     * @throws ValidationException
     */
    public static function manual(string $document, int $sequence, string $field, ?int $ignoreId = null, ?CarbonInterface $date = null): string
    {
        $date ??= now();
        $number = self::format($sequence, $date);
        [, , , $legacy] = self::definition($document);

        $taken = self::yearQuery($document, $date->year, $ignoreId)
            ->lockForUpdate()
            ->pluck(self::definition($document)[2])
            ->first(fn (?string $existing) => self::sequence($existing, $date->year, $legacy) === $sequence);

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
     * Serials already used in `$year`.
     *
     * @return Collection<int, int>
     */
    public static function usedSequences(string $document, int $year, ?int $ignoreId = null, bool $lock = false): Collection
    {
        [, , $column, $legacy] = self::definition($document);

        $query = self::yearQuery($document, $year, $ignoreId);
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->pluck($column)
            ->map(fn (?string $number) => self::sequence($number, $year, $legacy))
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

    /** The year's starting serial for one document; 1 when none is set. */
    public static function start(string $document, int $year): int
    {
        self::definition($document);

        return self::starts($year)[$document] ?? 1;
    }

    /**
     * The starting serials set for `$year`, document => serial. Documents
     * without one are left out.
     *
     * Read straight from the table, not a cache, so a start saved a moment
     * ago applies to the very next number.
     *
     * @return array<string, int>
     */
    public static function starts(int $year): array
    {
        $saved = json_decode((string) DocumentSetting::where('key', self::STARTS_KEY . $year)->value('value'), true);

        return collect(is_array($saved) ? $saved : [])
            ->only(array_keys(self::DOCUMENTS))
            ->map(fn ($serial) => (int) $serial)
            ->filter(fn (int $serial) => $serial > 1)
            ->all();
    }

    /** Store `$year`'s starting serials, document => serial; null or 1 clears one. */
    public static function saveStarts(int $year, array $starts): void
    {
        $starts = collect($starts)
            ->only(array_keys(self::DOCUMENTS))
            ->filter(fn ($serial) => $serial !== null && (int) $serial > 1)
            ->map(fn ($serial) => (int) $serial)
            ->all();

        if ($starts) {
            DocumentSetting::updateOrCreate(['key' => self::STARTS_KEY . $year], ['value' => json_encode($starts)]);
        } else {
            DocumentSetting::where('key', self::STARTS_KEY . $year)->delete();
        }
    }

    /** @return array{0: string, 1: class-string, 2: string, 3: list<string>} */
    private static function definition(string $document): array
    {
        return self::DOCUMENTS[$document] ?? throw new InvalidArgumentException("Unknown document type [{$document}].");
    }

    /** Rows whose number may belong to `$year`, in the new format or an old one. */
    private static function yearQuery(string $document, int $year, ?int $ignoreId): Builder
    {
        [, $model, $column, $legacy] = self::definition($document);

        return $model::query()
            ->when($ignoreId, fn (Builder $q) => $q->whereKeyNot($ignoreId))
            ->where(function (Builder $q) use ($column, $year, $legacy) {
                $q->where($column, 'like', "{$year}-%");
                foreach ($legacy as $prefix) {
                    $q->orWhere($column, 'like', "{$prefix}-{$year}-%");
                }
            });
    }
}

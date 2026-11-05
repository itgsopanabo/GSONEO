<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\DocumentSetting;
use App\Support\DocumentNumber;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Document Numbering: the serial each document's numbers start from in a
 * year, for offices that issued numbers on paper before using the system.
 */
class DocumentNumberingController extends Controller
{
    use LogsAudit;

    public function index(Request $request): Response
    {
        $year = $this->year($request);
        $starts = DocumentNumber::starts($year);

        return Inertia::render('DocumentSettings/Numbering', [
            'year' => $year,
            'years' => $this->years(),
            // The month the next number would carry: this month, or January for next year.
            'month' => $year === now()->year ? now()->format('m') : '01',
            'maxSerial' => DocumentNumber::MAX_SERIAL,
            'documents' => collect(DocumentNumber::DOCUMENTS)->map(function ($document, $key) use ($starts, $year) {
                $used = DocumentNumber::usedSequences($key, $year);
                $fillsGaps = in_array($key, DocumentNumber::FILLS_GAPS, true);

                return [
                    'key' => $key,
                    'label' => $document[0],
                    'start' => $starts[$key] ?? null,
                    'lastSerial' => $used->max(),
                    // The page works out the next number as the start is typed;
                    // a gap-filling document needs every serial taken to do it.
                    'fillsGaps' => $fillsGaps,
                    'used' => $fillsGaps ? $used->sort()->values() : [],
                ];
            })->values(),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $keys = array_keys(DocumentNumber::DOCUMENTS);

        $validated = $request->validate([
            'year' => ['required', 'integer', Rule::in($this->years())],
            'starts' => ['array'],
            ...collect($keys)->mapWithKeys(fn ($key) => [
                "starts.{$key}" => ['nullable', 'integer', 'min:1', 'max:' . DocumentNumber::MAX_SERIAL],
            ])->all(),
        ], [], collect($keys)->mapWithKeys(fn ($key) => ["starts.{$key}" => 'starting number'])->all());

        $year = (int) $validated['year'];
        $before = DocumentNumber::starts($year);

        DocumentNumber::saveStarts($year, $validated['starts'] ?? []);

        $after = DocumentNumber::starts($year);

        if ($before == $after) {
            return back()->with('success', 'No changes to save.');
        }

        $label = fn (string $key) => DocumentNumber::DOCUMENTS[$key][0];
        $changed = collect($keys)->filter(fn ($key) => ($before[$key] ?? 1) !== ($after[$key] ?? 1));

        $this->audit(
            'document_numbering_updated',
            new DocumentSetting,
            "Set {$year} starting numbers: " . $changed
                ->map(fn ($key) => sprintf('%s from %04d to %04d', $label($key), $before[$key] ?? 1, $after[$key] ?? 1))
                ->join('; '),
            $changed->mapWithKeys(fn ($key) => [$label($key) => $before[$key] ?? 1])->all(),
            $changed->mapWithKeys(fn ($key) => [$label($key) => $after[$key] ?? 1])->all(),
            ['auditable_id' => null],
        );

        return back()->with('success', "Starting numbers for {$year} saved. They apply to the next number issued.");
    }

    /** This year, and next year so January can be set up ahead of time. */
    private function years(): array
    {
        return [now()->year, now()->year + 1];
    }

    private function year(Request $request): int
    {
        $year = (int) $request->query('year', now()->year);

        return in_array($year, $this->years(), true) ? $year : now()->year;
    }
}

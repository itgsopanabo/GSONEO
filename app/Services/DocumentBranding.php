<?php

namespace App\Services;

use App\Models\DocumentSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * The letterhead and foreground design shared by every generated PDF.
 *
 * Saved values come from the document_settings table and fall back to
 * config('documents.defaults') key by key. Images are stored on the local
 * disk and handed to dompdf as data URIs, so the PDFs never depend on a
 * public storage link or on dompdf being allowed to fetch URLs.
 */
class DocumentBranding
{
    private const CACHE_KEY = 'document-branding';

    public const DISK = 'local';

    public const DIRECTORY = 'branding';

    private const SIGNATORIES_KEY = 'signatories';

    /** Saved values merged over the defaults, image slots holding their stored path. */
    public static function settings(): array
    {
        $defaults = config('documents.defaults') + array_fill_keys(config('documents.images'), null);

        $settings = array_merge($defaults, array_intersect_key(self::saved(), $defaults));

        foreach (['logo_size', 'watermark_opacity', 'watermark_size'] as $key) {
            $settings[$key] = (int) $settings[$key];
        }
        foreach (['header_rule', 'footer_page_numbers'] as $key) {
            $settings[$key] = filter_var($settings[$key], FILTER_VALIDATE_BOOLEAN);
        }

        return $settings;
    }

    /**
     * Every document's signatories: document => slot => [label, name, position].
     *
     * Saved as one JSON row under `signatories`; any slot never saved takes its
     * default from config('documents.signatories').
     */
    public static function signatories(): array
    {
        $saved = json_decode(self::saved()[self::SIGNATORIES_KEY] ?? '[]', true) ?: [];

        return collect(config('documents.signatories'))->map(fn ($document, $key) => [
            'label' => $document[0],
            'slots' => collect($document[1])->map(fn ($slot, $slotKey) => [
                'label' => $slot[0],
                'name' => (string) ($saved[$key][$slotKey]['name'] ?? $slot[1]),
                'position' => (string) ($saved[$key][$slotKey]['position'] ?? $slot[2]),
            ])->all(),
        ])->all();
    }

    /** Store names and positions, as document => slot => [name, position]. */
    public static function saveSignatories(array $signatories): void
    {
        self::save([self::SIGNATORIES_KEY => json_encode($signatories)]);
    }

    /** Store the given keys and forget the cached copy. */
    public static function save(array $values): void
    {
        foreach ($values as $key => $value) {
            DocumentSetting::updateOrCreate(
                ['key' => $key],
                ['value' => is_bool($value) ? ($value ? '1' : '0') : $value],
            );
        }

        Cache::forget(self::CACHE_KEY);
    }

    /** What the pdf.partials.* views print. */
    public static function forPdf(): array
    {
        $settings = self::settings();
        $lines = fn (?string $text) => array_values(array_filter(array_map('trim', preg_split('/\R/', (string) $text))));

        $leftLogo = self::dataUri($settings['left_logo']);

        return [
            'header_lines' => $lines($settings['header_lines']),
            'office_name' => trim((string) $settings['office_name']),
            'motto' => $lines($settings['motto']),
            'left_logo' => $leftLogo,
            'right_logo' => self::dataUri($settings['right_logo']),
            'logo_size' => $settings['logo_size'],
            'accent_color' => $settings['accent_color'],
            'header_rule' => $settings['header_rule'],
            'watermark' => $settings['watermark'],
            // An image watermark without its own upload reuses the left logo.
            'watermark_image' => self::dataUri($settings['watermark_image']) ?? $leftLogo,
            'watermark_text' => trim((string) $settings['watermark_text']),
            'watermark_opacity' => $settings['watermark_opacity'] / 100,
            'watermark_size' => $settings['watermark_size'],
            'footer_lines' => $lines($settings['footer_text']),
            'footer_page_numbers' => $settings['footer_page_numbers'],
        ];
    }

    /** Every saved row, key => value. */
    private static function saved(): array
    {
        try {
            return Cache::rememberForever(self::CACHE_KEY, fn () => DocumentSetting::pluck('value', 'key')->all());
        } catch (Throwable) {
            return [];   // Table not migrated yet: print the defaults rather than fail the PDF.
        }
    }

    private static function dataUri(?string $path): ?string
    {
        $disk = Storage::disk(self::DISK);

        if (! $path || ! $disk->exists($path)) {
            return null;
        }

        return 'data:'.$disk->mimeType($path).';base64,'.base64_encode($disk->get($path));
    }
}

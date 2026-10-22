<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\DocumentSetting;
use App\Services\DocumentBranding;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Document Branding: the letterhead, logos, watermark and footer that every
 * generated PDF prints.
 */
class DocumentSettingController extends Controller
{
    use LogsAudit;

    public function index(): Response
    {
        $settings = DocumentBranding::settings();
        $images = config('documents.images');

        return Inertia::render('DocumentSettings/Index', [
            'settings' => Arr::except($settings, $images),
            // The version query keeps the browser from showing a replaced logo.
            'images' => collect($images)->mapWithKeys(fn ($slot) => [
                $slot => $settings[$slot]
                    ? route('document-settings.image', ['slot' => $slot, 'v' => md5($settings[$slot])])
                    : null,
            ]),
            'defaults' => config('documents.defaults'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $images = config('documents.images');

        $validated = $request->validate([
            'header_lines' => ['nullable', 'string', 'max:500'],
            'office_name' => ['nullable', 'string', 'max:150'],
            'motto' => ['nullable', 'string', 'max:200'],
            'logo_size' => ['required', 'integer', 'between:30,110'],
            'accent_color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'header_rule' => ['required', 'boolean'],
            'watermark' => ['required', Rule::in(['none', 'image', 'text'])],
            'watermark_text' => ['nullable', 'required_if:watermark,text', 'string', 'max:60'],
            'watermark_opacity' => ['required', 'integer', 'between:3,40'],
            'watermark_size' => ['required', 'integer', 'between:100,600'],
            'footer_text' => ['nullable', 'string', 'max:300'],
            'footer_page_numbers' => ['required', 'boolean'],
            // PNG and JPEG only: dompdf renders them reliably, and SVG can carry script.
            ...collect($images)->flatMap(fn ($slot) => [
                $slot => ['nullable', 'image', 'mimes:png,jpg,jpeg', 'max:2048'],
                "remove_{$slot}" => ['nullable', 'boolean'],
            ])->all(),
        ], [
            'watermark_text.required_if' => 'Enter the text to print as the watermark.',
            'accent_color.regex' => 'Pick a colour in the #RRGGBB form.',
        ]);

        $before = DocumentBranding::settings();
        $values = Arr::except($validated, [...$images, ...array_map(fn ($slot) => "remove_{$slot}", $images)]);
        $values['header_rule'] = (bool) $values['header_rule'];
        $values['footer_page_numbers'] = (bool) $values['footer_page_numbers'];

        $disk = Storage::disk(DocumentBranding::DISK);

        foreach ($images as $slot) {
            $replacing = $request->hasFile($slot);

            if (($replacing || $request->boolean("remove_{$slot}")) && $before[$slot]) {
                $disk->delete($before[$slot]);
                $values[$slot] = null;
            }

            if ($replacing) {
                $values[$slot] = $request->file($slot)->store(DocumentBranding::DIRECTORY, DocumentBranding::DISK);
            }
        }

        DocumentBranding::save($values);

        $after = DocumentBranding::settings();
        $changed = collect($after)->filter(fn ($value, $key) => $value !== $before[$key])->keys();

        if ($changed->isEmpty()) {
            return back()->with('success', 'No changes to save.');
        }

        $this->audit(
            'document_branding_updated',
            new DocumentSetting,
            'Updated document branding: '.$changed->map(fn ($key) => str_replace('_', ' ', $key))->join(', '),
            Arr::only($before, $changed->all()),
            Arr::only($after, $changed->all()),
            ['auditable_id' => null],
        );

        return back()->with('success', 'Document branding saved. New PDFs will use it.');
    }

    /** Signatories: the names and positions printed in each document's signature blocks. */
    public function signatories(): Response
    {
        return Inertia::render('DocumentSettings/Signatories', [
            'documents' => DocumentBranding::signatories(),
        ]);
    }

    public function updateSignatories(Request $request): RedirectResponse
    {
        $rules = [];
        foreach (config('documents.signatories') as $document => [, $slots]) {
            foreach (array_keys($slots) as $slot) {
                $rules["signatories.{$document}.{$slot}.name"] = ['nullable', 'string', 'max:120'];
                $rules["signatories.{$document}.{$slot}.position"] = ['nullable', 'string', 'max:120'];
            }
        }

        $validated = $request->validate($rules, [], collect($rules)->mapWithKeys(fn ($rule, $key) => [
            $key => str_ends_with($key, '.name') ? 'name' : 'position',
        ])->all());

        $before = DocumentBranding::signatories();

        // Keep only known slots, trimmed; a blank name stays blank on purpose.
        $values = collect($before)->map(fn ($document, $key) => collect($document['slots'])->map(fn ($slot, $slotKey) => [
            'name' => trim((string) data_get($validated, "signatories.{$key}.{$slotKey}.name")),
            'position' => trim((string) data_get($validated, "signatories.{$key}.{$slotKey}.position")),
        ])->all())->all();

        $changed = [];
        foreach ($values as $key => $slots) {
            foreach ($slots as $slotKey => $slot) {
                $old = $before[$key]['slots'][$slotKey];
                if ($slot['name'] !== $old['name'] || $slot['position'] !== $old['position']) {
                    $changed[] = [
                        'what' => "{$before[$key]['label']} — {$old['label']}",
                        'old' => trim("{$old['name']}, {$old['position']}", ', '),
                        'new' => trim("{$slot['name']}, {$slot['position']}", ', '),
                    ];
                }
            }
        }

        if (! $changed) {
            return back()->with('success', 'No changes to save.');
        }

        DocumentBranding::saveSignatories($values);

        $this->audit(
            'document_signatories_updated',
            new DocumentSetting,
            'Updated signatories: '.collect($changed)->pluck('what')->join('; '),
            collect($changed)->pluck('old', 'what')->all(),
            collect($changed)->pluck('new', 'what')->all(),
            ['auditable_id' => null],
        );

        return back()->with('success', 'Signatories saved. New PDFs will print them.');
    }

    /** An uploaded image, for the preview on the settings screen. */
    public function image(string $slot): StreamedResponse
    {
        abort_unless(in_array($slot, config('documents.images'), true), 404);

        $path = DocumentBranding::settings()[$slot];
        abort_unless($path && Storage::disk(DocumentBranding::DISK)->exists($path), 404);

        return Storage::disk(DocumentBranding::DISK)->response($path, null, [
            'Cache-Control' => 'private, max-age=31536000',
        ]);
    }

    /** A sample page printed with the saved branding. */
    public function preview()
    {
        return Pdf::loadView('pdf.branding-preview')
            ->setOptions(['defaultFont' => 'DejaVu Sans'])
            ->stream('document-branding-preview.pdf');
    }
}

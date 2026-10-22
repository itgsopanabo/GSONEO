import { useEffect, useMemo } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { ExternalLink, ImagePlus, Trash2, Undo2 } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DocumentSettingsTabs from '@/Components/DocumentSettingsTabs';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

const IMAGE_SLOTS = ['left_logo', 'right_logo', 'watermark_image'];

const field =
    'w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ' +
    'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-indigo-500';

const lines = (text) => (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

function Label({ htmlFor, children, hint }) {
    return (
        <label htmlFor={htmlFor} className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{children}</span>
            {hint && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
        </label>
    );
}

function Err({ children }) {
    return children ? <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{children}</p> : null;
}

function Group({ title, description, children }) {
    return (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
            {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
            <div className="mt-5 space-y-5">{children}</div>
        </section>
    );
}

function Toggle({ checked, onChange, title, note }) {
    return (
        <label className="flex cursor-pointer items-start gap-3">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900"
            />
            <span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
                {note && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{note}</span>}
            </span>
        </label>
    );
}

function Range({ id, label, hint, value, onChange, min, max, step = 1, unit, error }) {
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={id} hint={hint}>{label}</Label>
                <span className="shrink-0 text-sm tabular-nums text-gray-600 dark:text-gray-300">
                    {value}{unit}
                </span>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-2 w-full accent-indigo-600"
            />
            <Err>{error}</Err>
        </div>
    );
}

/** Upload, replace or remove one image. `src` is what the PDF will print after saving. */
function ImageField({ id, label, hint, src, file, removed, onPick, onRemove, onUndo, error }) {
    const hasSaved = Boolean(src) && !file && !removed;

    return (
        <div>
            <Label htmlFor={id} hint={hint}>{label}</Label>
            <div className="mt-2 flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900">
                    {src && !removed ? (
                        <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                        <span className="text-xs text-gray-400">None</span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label
                        htmlFor={id}
                        className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {src && !removed ? 'Replace' : 'Upload'}
                        <input
                            id={id}
                            type="file"
                            accept="image/png,image/jpeg"
                            className="sr-only"
                            onChange={(e) => {
                                const picked = e.target.files?.[0];
                                if (picked) onPick(picked);
                                e.target.value = '';
                            }}
                        />
                    </label>
                    {(hasSaved || file) && (
                        <button
                            type="button"
                            onClick={onRemove}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                        </button>
                    )}
                    {removed && (
                        <button
                            type="button"
                            onClick={onUndo}
                            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                            Keep it
                        </button>
                    )}
                    {file && <span className="w-full text-xs text-amber-600 dark:text-amber-400">New, not saved yet: {file.name}</span>}
                    {removed && <span className="w-full text-xs text-amber-600 dark:text-amber-400">Will be removed when you save.</span>}
                </div>
            </div>
            <Err>{error}</Err>
        </div>
    );
}

/** A small, approximate page showing how the PDFs will look. */
function PagePreview({ data, images }) {
    const accent = data.accent_color;
    const header = lines(data.header_lines);
    const motto = lines(data.motto);
    const footer = lines(data.footer_text);
    const scale = 0.62;   // the preview page is about 62% of a printed A4 width
    const watermarkImage = images.watermark_image ?? images.left_logo;

    return (
        <div
            className="relative mx-auto aspect-[210/297] w-full max-w-md overflow-hidden rounded-sm bg-white text-black shadow-md ring-1 ring-gray-200 dark:ring-gray-700"
            style={{ fontFamily: '"DejaVu Sans", Verdana, sans-serif' }}
            aria-label="Preview of a generated document"
        >
            <div className="flex h-full flex-col px-[7%] pt-[6%] pb-[4%]">
                {/* Letterhead */}
                <div
                    className="flex items-center gap-2 pb-2"
                    style={{ borderBottom: data.header_rule ? `2px solid ${accent}` : 'none' }}
                >
                    <div className="flex w-1/5 justify-center">
                        {images.left_logo && (
                            <img src={images.left_logo} alt="" style={{ height: data.logo_size * scale }} className="w-auto object-contain" />
                        )}
                    </div>
                    <div className="w-3/5 text-center leading-snug">
                        {header.map((l, i) => (
                            <div key={i} style={{ fontSize: 10.5 * scale }}>{l}</div>
                        ))}
                        {data.office_name && (
                            <div className="font-bold uppercase tracking-wide" style={{ fontSize: 12.5 * scale, color: accent }}>
                                {data.office_name}
                            </div>
                        )}
                        <div className="mt-1 font-bold uppercase tracking-widest" style={{ fontSize: 15 * scale, color: accent }}>
                            Purchase Request
                        </div>
                    </div>
                    <div className="flex w-1/5 flex-col items-center text-center">
                        {images.right_logo && (
                            <img src={images.right_logo} alt="" style={{ height: data.logo_size * scale }} className="w-auto object-contain" />
                        )}
                        {motto.length > 0 && (
                            <div className="mt-0.5 italic leading-tight" style={{ fontSize: 9 * scale }}>
                                {motto.map((l, i) => <div key={i}>{l}</div>)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Stand-in content */}
                <div className="mt-4 flex-1 space-y-2" aria-hidden="true">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="h-2 rounded bg-gray-200" />
                        <div className="h-2 rounded bg-gray-200" />
                    </div>
                    <div className="mt-3 border border-gray-300">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <div key={i} className="flex gap-2 border-b border-gray-200 px-2 py-1.5 last:border-0">
                                <div className="h-1.5 w-4 rounded bg-gray-200" />
                                <div className="h-1.5 flex-1 rounded bg-gray-200" />
                                <div className="h-1.5 w-8 rounded bg-gray-200" />
                            </div>
                        ))}
                    </div>
                    <div className="h-2 w-2/3 rounded bg-gray-200" />
                    <div className="h-2 w-1/2 rounded bg-gray-200" />
                </div>

                {/* Footer */}
                {(footer.length > 0 || data.footer_page_numbers) && (
                    <div className="border-t pt-1 text-center leading-tight text-gray-700" style={{ borderColor: accent, fontSize: 8 * scale }}>
                        {footer.map((l, i) => <div key={i}>{l}</div>)}
                        {data.footer_page_numbers && <div>Page 1</div>}
                    </div>
                )}
            </div>

            {/* Watermark, over the page like on the PDF */}
            {data.watermark === 'image' && watermarkImage && (
                <div className="pointer-events-none absolute inset-x-0 top-[30%] flex justify-center" style={{ opacity: data.watermark_opacity / 100 }}>
                    <img src={watermarkImage} alt="" style={{ width: data.watermark_size * scale }} />
                </div>
            )}
            {data.watermark === 'text' && data.watermark_text && (
                <div
                    className="pointer-events-none absolute inset-x-0 top-[40%] whitespace-nowrap text-center font-bold"
                    style={{
                        opacity: data.watermark_opacity / 100,
                        color: accent,
                        transform: 'rotate(-30deg)',
                        fontSize: (data.watermark_size / Math.max(4, data.watermark_text.length * 0.62)) * scale,
                    }}
                >
                    {data.watermark_text}
                </div>
            )}
        </div>
    );
}

export default function Index({ settings, images, defaults }) {
    const { data, setData, setDefaults, post, processing, errors, isDirty, reset } = useForm({
        ...settings,
        ...Object.fromEntries(IMAGE_SLOTS.flatMap((slot) => [[slot, null], [`remove_${slot}`, false]])),
    });

    // Local previews of newly picked files, released when replaced or unmounted.
    const picked = useMemo(
        () => Object.fromEntries(IMAGE_SLOTS.map((slot) => [slot, data[slot] ? URL.createObjectURL(data[slot]) : null])),
        [data.left_logo, data.right_logo, data.watermark_image], // eslint-disable-line react-hooks/exhaustive-deps
    );
    useEffect(() => () => Object.values(picked).forEach((url) => url && URL.revokeObjectURL(url)), [picked]);

    // What each image will be once saved: the new pick, nothing if removed, else the saved one.
    const effective = Object.fromEntries(
        IMAGE_SLOTS.map((slot) => [slot, picked[slot] ?? (data[`remove_${slot}`] ? null : images[slot])]),
    );

    const submit = (e) => {
        e.preventDefault();
        post(route('document-settings.update'), {
            forceFormData: true,
            preserveScroll: true,
            // What was typed is now what is saved; the images now come back in `images`.
            onSuccess: () => {
                const saved = {
                    ...data,
                    ...Object.fromEntries(IMAGE_SLOTS.flatMap((slot) => [[slot, null], [`remove_${slot}`, false]])),
                };
                setData(saved);
                setDefaults(saved);
            },
        });
    };

    const restoreText = () => {
        if (!window.confirm('Put the letterhead, footer and design back to the original wording and settings? Logos are not changed.')) return;
        Object.entries(defaults).forEach(([key, value]) => setData(key, value));
    };

    const imageField = (slot, label, hint) => (
        <ImageField
            id={slot}
            label={label}
            hint={hint}
            src={effective[slot]}
            file={data[slot]}
            removed={data[`remove_${slot}`]}
            onPick={(file) => {
                setData(slot, file);
                setData(`remove_${slot}`, false);
            }}
            onRemove={() => {
                setData(slot, null);
                setData(`remove_${slot}`, Boolean(images[slot]));
            }}
            onUndo={() => setData(`remove_${slot}`, false)}
            error={errors[slot]}
        />
    );

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Document branding
                </h2>
            }
        >
            <Head title="Document branding" />

            <form onSubmit={submit} className="py-8">
                <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_24rem] lg:px-8">
                    <div className="lg:col-span-2">
                        <DocumentSettingsTabs />
                    </div>

                    <div className="space-y-6">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            The letterhead, footer and watermark set here print on every generated PDF: purchase
                            requests, canvass forms, inspection and acceptance reports and SSMI. Changes apply to
                            documents generated after you save; PDFs already printed are not affected.
                        </p>

                        <Group title="Header" description="The letterhead at the top of every document.">
                            <div className="grid gap-5 sm:grid-cols-2">
                                {imageField('left_logo', 'Left logo', 'Usually the city seal. PNG or JPG, up to 2 MB.')}
                                {imageField('right_logo', 'Right logo', 'Usually the office or agency logo.')}
                            </div>

                            <Range
                                id="logo_size"
                                label="Logo height"
                                value={data.logo_size}
                                onChange={(v) => setData('logo_size', v)}
                                min={30}
                                max={110}
                                unit=" px"
                                error={errors.logo_size}
                            />

                            <div>
                                <Label htmlFor="header_lines" hint="One line per row, printed centred above the office name.">
                                    Header lines
                                </Label>
                                <textarea
                                    id="header_lines"
                                    rows={3}
                                    value={data.header_lines ?? ''}
                                    onChange={(e) => setData('header_lines', e.target.value)}
                                    className={`${field} mt-2`}
                                />
                                <Err>{errors.header_lines}</Err>
                            </div>

                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="office_name" hint="Printed in bold, in the accent colour.">Office name</Label>
                                    <input
                                        id="office_name"
                                        type="text"
                                        value={data.office_name ?? ''}
                                        onChange={(e) => setData('office_name', e.target.value)}
                                        className={`${field} mt-2`}
                                    />
                                    <Err>{errors.office_name}</Err>
                                </div>
                                <div>
                                    <Label htmlFor="motto" hint="Under the right logo. One line per row.">Motto</Label>
                                    <textarea
                                        id="motto"
                                        rows={2}
                                        value={data.motto ?? ''}
                                        onChange={(e) => setData('motto', e.target.value)}
                                        className={`${field} mt-2`}
                                    />
                                    <Err>{errors.motto}</Err>
                                </div>
                            </div>
                        </Group>

                        <Group title="Footer" description="Printed at the bottom of every page, such as the office address and contact numbers.">
                            <div>
                                <Label htmlFor="footer_text" hint="One line per row. Leave empty for no footer text.">
                                    Footer lines
                                </Label>
                                <textarea
                                    id="footer_text"
                                    rows={3}
                                    value={data.footer_text ?? ''}
                                    onChange={(e) => setData('footer_text', e.target.value)}
                                    className={`${field} mt-2`}
                                />
                                <Err>{errors.footer_text}</Err>
                            </div>
                            <Toggle
                                checked={data.footer_page_numbers}
                                onChange={(v) => setData('footer_page_numbers', v)}
                                title="Page numbers"
                                note="Adds “Page 1”, “Page 2”… under the footer lines."
                            />
                        </Group>

                        <Group title="Design" description="The colour and the watermark laid over each page.">
                            <div className="grid gap-5 sm:grid-cols-2">
                                <div>
                                    <Label htmlFor="accent_color" hint="Office name, document title, header and footer lines.">
                                        Accent colour
                                    </Label>
                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            id="accent_color"
                                            type="color"
                                            value={data.accent_color}
                                            onChange={(e) => setData('accent_color', e.target.value)}
                                            className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-900"
                                        />
                                        <input
                                            type="text"
                                            aria-label="Accent colour code"
                                            value={data.accent_color}
                                            onChange={(e) => setData('accent_color', e.target.value)}
                                            className={`${field} w-28 font-mono`}
                                        />
                                    </div>
                                    <Err>{errors.accent_color}</Err>
                                </div>
                                <div className="sm:pt-6">
                                    <Toggle
                                        checked={data.header_rule}
                                        onChange={(v) => setData('header_rule', v)}
                                        title="Line under the header"
                                        note="A rule in the accent colour below the letterhead."
                                    />
                                </div>
                            </div>

                            <fieldset>
                                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Watermark</legend>
                                <div className="mt-2 inline-flex rounded-md shadow-sm" role="radiogroup">
                                    {[
                                        ['none', 'None'],
                                        ['image', 'Image'],
                                        ['text', 'Text'],
                                    ].map(([value, text], i) => (
                                        <label
                                            key={value}
                                            className={`relative cursor-pointer border px-4 py-1.5 text-sm focus-within:z-10 focus-within:ring-2 focus-within:ring-indigo-500 ${
                                                i === 0 ? 'rounded-l-md' : '-ml-px'
                                            } ${i === 2 ? 'rounded-r-md' : ''} ${
                                                data.watermark === value
                                                    ? 'z-10 border-indigo-500 bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="watermark"
                                                value={value}
                                                checked={data.watermark === value}
                                                onChange={() => setData('watermark', value)}
                                                className="sr-only"
                                            />
                                            {text}
                                        </label>
                                    ))}
                                </div>
                                <Err>{errors.watermark}</Err>
                            </fieldset>

                            {data.watermark === 'image' &&
                                imageField('watermark_image', 'Watermark image', 'Leave empty to use the left logo. A plain, single-colour seal reads best.')}

                            {data.watermark === 'text' && (
                                <div>
                                    <Label htmlFor="watermark_text" hint="Printed diagonally across the page, e.g. CITY OF PANABO or CONTROLLED COPY.">
                                        Watermark text
                                    </Label>
                                    <input
                                        id="watermark_text"
                                        type="text"
                                        maxLength={60}
                                        value={data.watermark_text ?? ''}
                                        onChange={(e) => setData('watermark_text', e.target.value)}
                                        className={`${field} mt-2`}
                                    />
                                    <Err>{errors.watermark_text}</Err>
                                </div>
                            )}

                            {data.watermark !== 'none' && (
                                <div className="grid gap-5 sm:grid-cols-2">
                                    <Range
                                        id="watermark_opacity"
                                        label="Strength"
                                        hint="Keep it faint so the form stays readable."
                                        value={data.watermark_opacity}
                                        onChange={(v) => setData('watermark_opacity', v)}
                                        min={3}
                                        max={40}
                                        unit="%"
                                        error={errors.watermark_opacity}
                                    />
                                    <Range
                                        id="watermark_size"
                                        label="Size"
                                        value={data.watermark_size}
                                        onChange={(v) => setData('watermark_size', v)}
                                        min={100}
                                        max={600}
                                        step={10}
                                        unit=" px"
                                        error={errors.watermark_size}
                                    />
                                </div>
                            )}
                        </Group>
                    </div>

                    {/* Preview and actions */}
                    <aside className="lg:sticky lg:top-6 lg:self-start">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900/40">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Preview</h3>
                                <span className="text-xs text-gray-500 dark:text-gray-400">Approximate</span>
                            </div>

                            <PagePreview data={data} images={effective} />

                            <div className="mt-5 flex flex-wrap items-center gap-3">
                                <PrimaryButton type="submit" disabled={processing || !isDirty}>
                                    {processing ? 'Saving…' : 'Save changes'}
                                </PrimaryButton>
                                <SecondaryButton onClick={() => reset()} disabled={processing || !isDirty}>
                                    Discard
                                </SecondaryButton>
                            </div>
                            {isDirty && (
                                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</p>
                            )}

                            <div className="mt-5 space-y-2 border-t border-gray-200 pt-4 text-sm dark:border-gray-700">
                                <a
                                    href={route('document-settings.preview')}
                                    target="_blank"
                                    rel="noopener"
                                    className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Open a sample PDF
                                </a>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Printed with the saved settings, over two pages. Save first to check new changes.
                                </p>
                                <button
                                    type="button"
                                    onClick={restoreText}
                                    className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    Restore the original wording and design
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}

import { useMemo, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Plus, Star, Trash2, X } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DocumentSettingsTabs from '@/Components/DocumentSettingsTabs';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

const field =
    'w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ' +
    'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-indigo-500';

const iconButton =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 ' +
    'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-gray-700 dark:hover:text-gray-200';

const errorText = 'mt-1 text-sm text-rose-600 dark:text-rose-400';

/** How a block prints: the name over a signing line, the position beneath. */
function SignaturePreview({ label, name, position }) {
    return (
        <div className="min-w-0 text-center" aria-hidden="true">
            <div className="truncate text-left text-[10px] text-gray-500 dark:text-gray-400">{label ? `${label}:` : ' '}</div>
            <div className="mt-3 min-h-[1.25rem] truncate border-b border-gray-800 pb-0.5 text-xs font-bold uppercase text-gray-900 dark:border-gray-300 dark:text-gray-100">
                {name || ' '}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">{position || ' '}</div>
        </div>
    );
}

/** Blocks per printed row, as the PDFs lay them out (SignatorySet::columns). */
const columnsFor = (count) => (count === 4 ? 2 : Math.max(1, Math.min(count, 3)));

const toForm = (set, fixedSlots) => ({
    name: set.name,
    is_default: set.is_default,
    signers: set.signers.map((s) => ({ label: s.label ?? '', name: s.name ?? '', position: s.position ?? '' })),
    fixed: Object.fromEntries(
        fixedSlots.map((slot) => [slot, { name: set.fixed?.[slot]?.name ?? '', position: set.fixed?.[slot]?.position ?? '' }]),
    ),
    office_ids: set.office_ids ?? [],
});

function SetCard({ set, document, offices, takenBy, maxSigners }) {
    const fixedSlots = Object.keys(document.fixed ?? {});
    const { data, setData, put, processing, errors, isDirty, reset, setDefaults, clearErrors } = useForm(toForm(set, fixedSlots));
    const [officeFilter, setOfficeFilter] = useState('');

    const setSigner = (index, key, value) =>
        setData('signers', data.signers.map((s, i) => (i === index ? { ...s, [key]: value } : s)));

    const moveSigner = (index, by) => {
        const signers = [...data.signers];
        [signers[index], signers[index + by]] = [signers[index + by], signers[index]];
        setData('signers', signers);
    };

    const removeSigner = (index) => setData('signers', data.signers.filter((_, i) => i !== index));

    const addSigner = () => setData('signers', [...data.signers, { label: '', name: '', position: '' }]);

    const toggleOffice = (id) =>
        setData('office_ids', data.office_ids.includes(id) ? data.office_ids.filter((o) => o !== id) : [...data.office_ids, id]);

    const submit = (e) => {
        e.preventDefault();
        put(route('document-settings.signatories.update', set.id), {
            preserveScroll: true,
            onSuccess: () => setDefaults(),
        });
    };

    const destroy = () => {
        if (!window.confirm(`Remove the signer set "${set.name}"? Requests that use it will print with their office's set or the default.`)) return;
        router.delete(route('document-settings.signatories.destroy', set.id), { preserveScroll: true });
    };

    const discard = () => {
        reset();
        clearErrors();
    };

    const linked = offices.filter((o) => data.office_ids.includes(o.id));
    const shownOffices = offices.filter(
        (o) => !data.office_ids.includes(o.id)
            && (o.active)
            && `${o.name} ${o.code}`.toLowerCase().includes(officeFilter.trim().toLowerCase()),
    );
    const columns = columnsFor(data.signers.length);

    return (
        <form
            onSubmit={submit}
            className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
            {/* Name and default */}
            <div className="flex flex-wrap items-start gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
                <div className="min-w-[14rem] flex-1">
                    <label htmlFor={`set-${set.id}-name`} className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                        Set name
                    </label>
                    <input
                        id={`set-${set.id}-name`}
                        type="text"
                        maxLength={80}
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className={`${field} mt-1 font-semibold`}
                    />
                    {errors.name && <p className={errorText}>{errors.name}</p>}
                </div>
                <div className="flex items-center gap-2 pt-6">
                    {set.is_default ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                            <Star className="h-3.5 w-3.5" /> Default
                        </span>
                    ) : (
                        <>
                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={data.is_default}
                                    onChange={(e) => setData('is_default', e.target.checked)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900"
                                />
                                Make default
                            </label>
                            <button type="button" onClick={destroy} className={iconButton} title="Remove this set">
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Placements the layout keeps apart (the PR's budget box) */}
            {fixedSlots.map((slot) => (
                <div key={slot} className="grid gap-4 border-b border-gray-100 px-6 py-4 dark:border-gray-700 md:grid-cols-2">
                    <div>
                        <label htmlFor={`set-${set.id}-${slot}-name`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {document.fixed[slot]} <span className="font-normal text-gray-400">· name</span>
                        </label>
                        <input
                            id={`set-${set.id}-${slot}-name`}
                            type="text"
                            maxLength={120}
                            value={data.fixed[slot].name}
                            placeholder="Blank line to sign on"
                            onChange={(e) => setData('fixed', { ...data.fixed, [slot]: { ...data.fixed[slot], name: e.target.value } })}
                            className={`${field} mt-1.5`}
                        />
                        {errors[`fixed.${slot}.name`] && <p className={errorText}>{errors[`fixed.${slot}.name`]}</p>}
                    </div>
                    <div>
                        <label htmlFor={`set-${set.id}-${slot}-position`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Position
                        </label>
                        <input
                            id={`set-${set.id}-${slot}-position`}
                            type="text"
                            maxLength={120}
                            value={data.fixed[slot].position}
                            onChange={(e) => setData('fixed', { ...data.fixed, [slot]: { ...data.fixed[slot], position: e.target.value } })}
                            className={`${field} mt-1.5`}
                        />
                        {errors[`fixed.${slot}.position`] && <p className={errorText}>{errors[`fixed.${slot}.position`]}</p>}
                    </div>
                </div>
            ))}

            {/* Signers, in print order */}
            <div className="px-6 py-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        Signers <span className="font-normal text-gray-400">({data.signers.length} of {maxSigners})</span>
                    </h4>
                    {document.note && <p className="text-xs text-gray-500 dark:text-gray-400">{document.note}</p>}
                </div>

                <div className="hidden gap-3 px-1 pb-1 text-xs font-medium text-gray-500 dark:text-gray-400 md:grid md:grid-cols-[1fr_1.3fr_1.3fr_6.5rem]">
                    <span>Label</span>
                    <span>Name</span>
                    <span>Position</span>
                    <span />
                </div>

                <ol className="space-y-2">
                    {data.signers.map((signer, index) => (
                        <li key={index} className="grid gap-2 rounded-md bg-gray-50 p-2 dark:bg-gray-900/40 md:grid-cols-[1fr_1.3fr_1.3fr_6.5rem] md:items-start md:gap-3">
                            <div>
                                <input
                                    type="text"
                                    maxLength={80}
                                    value={signer.label}
                                    placeholder="e.g. Inspected by"
                                    aria-label={`Signer ${index + 1} label`}
                                    onChange={(e) => setSigner(index, 'label', e.target.value)}
                                    className={field}
                                />
                                {errors[`signers.${index}.label`] && <p className={errorText}>{errors[`signers.${index}.label`]}</p>}
                            </div>
                            <div>
                                <input
                                    type="text"
                                    maxLength={120}
                                    value={signer.name}
                                    placeholder="Blank line to sign on"
                                    aria-label={`Signer ${index + 1} name`}
                                    onChange={(e) => setSigner(index, 'name', e.target.value)}
                                    className={field}
                                />
                                {errors[`signers.${index}.name`] && <p className={errorText}>{errors[`signers.${index}.name`]}</p>}
                            </div>
                            <div>
                                <input
                                    type="text"
                                    maxLength={120}
                                    value={signer.position}
                                    aria-label={`Signer ${index + 1} position`}
                                    onChange={(e) => setSigner(index, 'position', e.target.value)}
                                    className={field}
                                />
                                {errors[`signers.${index}.position`] && <p className={errorText}>{errors[`signers.${index}.position`]}</p>}
                            </div>
                            <div className="flex items-center justify-end gap-0.5 md:pt-0.5">
                                <button type="button" className={iconButton} disabled={index === 0} onClick={() => moveSigner(index, -1)} title="Move up">
                                    <ArrowUp className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    className={iconButton}
                                    disabled={index === data.signers.length - 1}
                                    onClick={() => moveSigner(index, 1)}
                                    title="Move down"
                                >
                                    <ArrowDown className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    className={`${iconButton} hover:text-rose-600`}
                                    disabled={data.signers.length === 1}
                                    onClick={() => removeSigner(index)}
                                    title="Remove signer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </li>
                    ))}
                </ol>
                {errors.signers && <p className={errorText}>{errors.signers}</p>}

                <button
                    type="button"
                    onClick={addSigner}
                    disabled={data.signers.length >= maxSigners}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-indigo-400 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300"
                >
                    <Plus className="h-3.5 w-3.5" /> Add signer
                </button>

                {/* Rough look of the printed blocks */}
                <div
                    className="mt-4 grid gap-x-6 gap-y-4 rounded-md border border-gray-100 p-4 dark:border-gray-700"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                >
                    {data.signers.map((s, i) => (
                        <SignaturePreview key={i} label={s.label} name={s.name} position={s.position} />
                    ))}
                </div>
            </div>

            {/* Offices that use this set automatically */}
            <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Used automatically for</h4>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    Requests from these offices print with this set unless staff choose another one on the request.
                    {set.is_default && ' Offices not linked to any set use this default.'}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                    {linked.length === 0 && <span className="text-xs italic text-gray-400">No office linked.</span>}
                    {linked.map((office) => (
                        <button
                            key={office.id}
                            type="button"
                            onClick={() => toggleOffice(office.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300"
                            title="Unlink"
                        >
                            {office.name}{!office.active && ' (retired)'}
                            <X className="h-3 w-3" />
                        </button>
                    ))}
                </div>

                <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-indigo-600 dark:text-indigo-400">Link an office</summary>
                    <input
                        type="search"
                        value={officeFilter}
                        onChange={(e) => setOfficeFilter(e.target.value)}
                        placeholder="Filter offices"
                        className={`${field} mt-2 max-w-xs`}
                    />
                    <div className="mt-2 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                        {shownOffices.map((office) => {
                            const other = takenBy[office.id];
                            return (
                                <button
                                    key={office.id}
                                    type="button"
                                    disabled={Boolean(other)}
                                    onClick={() => toggleOffice(office.id)}
                                    title={other ? `Already uses "${other}"` : `Link ${office.name}`}
                                    className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    {office.name}
                                    {other && <span className="ml-1 text-gray-400">· {other}</span>}
                                </button>
                            );
                        })}
                        {shownOffices.length === 0 && <span className="text-xs italic text-gray-400">No other offices.</span>}
                    </div>
                </details>
                {errors.office_ids && <p className={errorText}>{errors.office_ids}</p>}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-lg border-t border-gray-100 bg-gray-50 px-6 py-3 dark:border-gray-700 dark:bg-gray-900/40">
                {isDirty && <span className="mr-auto text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>}
                <SecondaryButton onClick={discard} disabled={processing || !isDirty}>
                    Discard
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={processing || !isDirty}>
                    {processing ? 'Saving…' : 'Save set'}
                </PrimaryButton>
            </div>
        </form>
    );
}

function AddSet({ document }) {
    const { data, setData, post, processing, errors, reset } = useForm({ document, name: '' });

    const submit = (e) => {
        e.preventDefault();
        post(route('document-settings.signatories.store'), {
            preserveScroll: true,
            onSuccess: () => reset('name'),
        });
    };

    return (
        <form onSubmit={submit} className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
            <label htmlFor={`new-set-${document}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Add a signer set
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                    id={`new-set-${document}`}
                    type="text"
                    maxLength={80}
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="e.g. IT Equipment"
                    className={`${field} max-w-sm`}
                />
                <PrimaryButton type="submit" disabled={processing || !data.name.trim()}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add set
                </PrimaryButton>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">It starts as a copy of the default set, so you only change what differs.</p>
            {errors.name && <p className={errorText}>{errors.name}</p>}
        </form>
    );
}

export default function Signatories({ documents, sets, offices, maxSigners }) {
    const keys = Object.keys(documents);
    const [active, setActive] = useState(() => {
        const fromUrl = new URLSearchParams(window.location.search).get('document');
        return keys.includes(fromUrl) ? fromUrl : keys[0];
    });

    const documentSets = sets[active] ?? [];

    const choose = (key) => {
        setActive(key);
        window.history.replaceState(window.history.state, '', `${window.location.pathname}?document=${key}`);
    };

    // office id => the other set (of this document) it is linked to, per set.
    const takenFor = useMemo(
        () => (setId) =>
            Object.fromEntries(
                documentSets.filter((s) => s.id !== setId).flatMap((s) => (s.office_ids ?? []).map((id) => [id, s.name])),
            ),
        [documentSets],
    );

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Document branding
                </h2>
            }
        >
            <Head title="Signatories" />

            <div className="py-8">
                <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <DocumentSettingsTabs />

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Each document can have several signer sets, for example one for IT equipment signed by the IT
                        inspectors and one for vehicles signed by the motorpool. A request prints with the set chosen
                        on it beside its print button. If none was chosen, it uses the set linked to its requesting
                        office, or the default set. Type names the way they should print. Leave a name empty to print
                        a blank line for signing by hand.
                    </p>

                    <div className="flex flex-wrap gap-2" role="tablist">
                        {keys.map((key) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={active === key}
                                onClick={() => choose(key)}
                                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                                    active === key
                                        ? 'bg-indigo-600 text-white'
                                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                                }`}
                            >
                                {documents[key].label}
                                <span className={`ml-1.5 text-xs ${active === key ? 'text-indigo-100' : 'text-gray-400'}`}>
                                    {(sets[key] ?? []).length}
                                </span>
                            </button>
                        ))}
                    </div>

                    {documentSets.map((set) => (
                        // Keyed on the saved values too, so a save or delete elsewhere reloads the form.
                        <SetCard
                            key={`${set.id}-${JSON.stringify(set)}`}
                            set={set}
                            document={documents[active]}
                            offices={offices}
                            takenBy={takenFor(set.id)}
                            maxSigners={maxSigners}
                        />
                    ))}

                    <AddSet key={active} document={active} />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

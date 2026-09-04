// resources/js/Pages/RecordClasses/Form.jsx
import { Link } from '@inertiajs/react';

const TRIGGERS = {
    creation: { label: 'the date of the record', short: 'Date of the record' },
    audit_settlement: { label: 'the audit being settled', short: 'Audit settled' },
    asset_disposal: { label: 'the asset being disposed', short: 'Asset disposed' },
    contract_completion: { label: 'the contract being completed', short: 'Contract completed' },
};

const SENSITIVITIES = {
    public: {
        label: 'Public',
        note: 'Disclosable on request.',
        accent: 'text-emerald-700 dark:text-emerald-400',
    },
    internal: {
        label: 'Internal',
        note: 'Office use. Not released without approval.',
        accent: 'text-gray-600 dark:text-gray-400',
    },
    restricted: {
        label: 'Restricted',
        note: 'Cleared users only. Land titles and property documents.',
        accent: 'text-amber-700 dark:text-amber-400',
    },
};

const field =
    'w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ' +
    'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-indigo-500';

function Label({ children, hint }) {
    return (
        <>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">{children}</span>
            {hint && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{hint}</span>}
        </>
    );
}

function Err({ children }) {
    return children ? <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">{children}</p> : null;
}

/** A selectable card. Used for the retention mode and the access level. */
function Choice({ name, value, checked, onChange, title, note, accent }) {
    return (
        <label
            className={`relative flex cursor-pointer gap-3 rounded-lg border p-3.5 transition
                        focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-1
                        dark:focus-within:ring-offset-gray-800 ${
                checked
                    ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-500/10'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
            }`}
        >
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={onChange}
                className="mt-0.5 h-4 w-4 shrink-0 border-gray-300 text-indigo-600 focus:ring-0 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-900"
            />
            <span className="min-w-0">
                <span className={`block text-sm font-medium ${checked ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                    {title}
                </span>
                <span className={`mt-0.5 block text-xs ${accent ?? 'text-gray-500 dark:text-gray-400'}`}>
                    {note}
                </span>
            </span>
        </label>
    );
}

/** A quiet switch for the two secondary flags. */
function Toggle({ checked, onChange, title, note }) {
    return (
        <label className="flex cursor-pointer items-start gap-3 py-1">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900"
            />
            <span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{note}</span>
            </span>
        </label>
    );
}

function Group({ variant, title, description, children }) {
    if (variant === 'modal') {
        return (
            <section className="border-t border-gray-100 pt-6 first:border-0 first:pt-0 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
                {description && (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
                )}
                <div className="mt-4">{children}</div>
            </section>
        );
    }

    return (
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
            {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
            <div className="mt-5">{children}</div>
        </section>
    );
}

/** The rule as a records officer would say it out loud. */
function ruleSentence(data) {
    if (data.is_permanent) {
        return 'Kept permanently and never disposed.';
    }
    if (!data.retention_years) {
        return 'Enter a number of years to complete the rule.';
    }
    const years = Number(data.retention_years);
    const trigger = TRIGGERS[data.retention_trigger]?.label ?? data.retention_trigger;
    return `Kept ${years} ${years === 1 ? 'year' : 'years'}, counted from ${trigger}.`;
}

export default function Form({
                                 data,
                                 setData,
                                 errors,
                                 processing,
                                 sensitivities,
                                 triggers,
                                 submit,
                                 submitLabel,
                                 recordsCount = 0,
                                 variant = 'page',
                                 onCancel,
                             }) {
    const isModal = variant === 'modal';
    const complete = data.is_permanent || Boolean(data.retention_years);

    return (
        <form onSubmit={submit} className="space-y-6">
            {recordsCount > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm
                                dark:border-amber-500/30 dark:bg-amber-500/10">
                    <p className="font-medium text-amber-900 dark:text-amber-300">
                        {recordsCount} {recordsCount === 1 ? 'record uses' : 'records use'} this class
                    </p>
                    <p className="mt-0.5 text-amber-800 dark:text-amber-400/90">
                        Changing retention recalculates their disposal dates. Changing access changes who can see
                        them.
                    </p>
                </div>
            )}

            <Group
                variant={variant}
                title="Identity"
                description="How this class appears when someone registers a record."
            >
                <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                        <label className="block">
                            <Label hint="e.g. PROP-TITLE">Code</Label>
                            <input
                                type="text"
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value.toUpperCase())}
                                placeholder="PROC-BID"
                                className={`${field} mt-1.5 font-mono tracking-tight`}
                            />
                            <Err>{errors.code}</Err>
                        </label>

                        <label className="block">
                            <Label hint="The record series as named in your schedule">Title</Label>
                            <input
                                type="text"
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                placeholder="Bidding documents and abstracts"
                                className={`${field} mt-1.5`}
                            />
                            <Err>{errors.title}</Err>
                        </label>
                    </div>

                    <label className="block">
                        <Label hint="What belongs here, so registrations stay consistent.">Description</Label>
                        <textarea
                            rows={isModal ? 2 : 3}
                            value={data.description ?? ''}
                            onChange={(e) => setData('description', e.target.value)}
                            className={`${field} mt-1.5`}
                        />
                        <Err>{errors.description}</Err>
                    </label>
                </div>
            </Group>

            <Group
                variant={variant}
                title="Retention"
                description="How long records in this class are kept, and from what point."
            >
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Choice
                            name="retention_mode"
                            value="permanent"
                            checked={data.is_permanent}
                            onChange={() => setData('is_permanent', true)}
                            title="Kept permanently"
                            note="Never disposed. Transfers to the National Archives."
                        />
                        <Choice
                            name="retention_mode"
                            value="period"
                            checked={!data.is_permanent}
                            onChange={() => setData('is_permanent', false)}
                            title="Kept for a period"
                            note="Becomes eligible for disposal once the period elapses."
                        />
                    </div>

                    {!data.is_permanent && (
                        <div className="grid gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-[8rem_1fr] dark:bg-gray-900/40">
                            <label className="block">
                                <Label>Years</Label>
                                <input
                                    type="number"
                                    min="1"
                                    max="200"
                                    value={data.retention_years ?? ''}
                                    onChange={(e) => setData('retention_years', e.target.value)}
                                    placeholder="5"
                                    className={`${field} mt-1.5 tabular-nums`}
                                />
                                <Err>{errors.retention_years}</Err>
                            </label>

                            <label className="block">
                                <Label hint="The clock does not start until this is recorded on the record.">
                                    Counted from
                                </Label>
                                <select
                                    value={data.retention_trigger}
                                    onChange={(e) => setData('retention_trigger', e.target.value)}
                                    className={`${field} mt-1.5`}
                                >
                                    {triggers.map((t) => (
                                        <option key={t} value={t}>
                                            {TRIGGERS[t]?.short ?? t}
                                        </option>
                                    ))}
                                </select>
                                <Err>{errors.retention_trigger}</Err>
                            </label>
                        </div>
                    )}

                    {/* the rule in plain words — the one thing a records officer checks */}
                    <p
                        className={`rounded-md border-l-4 py-2.5 pl-4 pr-3 text-sm ${
                            complete
                                ? 'border-indigo-500 bg-indigo-50/50 text-gray-800 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-gray-200'
                                : 'border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-400'
                        }`}
                    >
                        {ruleSentence(data)}
                    </p>

                    <div className="grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 dark:border-gray-700">
                        <label className="block">
                            <Label hint="GRDS-2009, or your agency schedule">Schedule</Label>
                            <input
                                type="text"
                                value={data.rds_source}
                                onChange={(e) => setData('rds_source', e.target.value)}
                                className={`${field} mt-1.5`}
                            />
                            <Err>{errors.rds_source}</Err>
                        </label>

                        <label className="block">
                            <Label hint="Enter TODO if not yet confirmed against the circular.">Item number</Label>
                            <input
                                type="text"
                                value={data.rds_item_no}
                                onChange={(e) => setData('rds_item_no', e.target.value)}
                                placeholder="14"
                                className={`${field} mt-1.5 font-mono`}
                            />
                            <Err>{errors.rds_item_no}</Err>
                        </label>
                    </div>
                </div>
            </Group>

            <Group
                variant={variant}
                title="Access"
                description="Who can see records in this class."
            >
                <div className="space-y-3">
                    {sensitivities.map((s) => {
                        const meta = SENSITIVITIES[s] ?? { label: s, note: '' };
                        return (
                            <Choice
                                key={s}
                                name="sensitivity"
                                value={s}
                                checked={data.sensitivity === s}
                                onChange={() => setData('sensitivity', s)}
                                title={meta.label}
                                note={meta.note}
                                accent={data.sensitivity === s ? meta.accent : undefined}
                            />
                        );
                    })}
                    <Err>{errors.sensitivity}</Err>
                </div>
            </Group>

            <Group variant={variant} title="Handling">
                <div className="space-y-3">
                    <Toggle
                        checked={data.is_vital}
                        onChange={(e) => setData('is_vital', e.target.checked)}
                        title="Vital record"
                        note="The office cannot function without these if the originals are lost. Adds this class to the off-site backup list."
                    />
                    <Toggle
                        checked={data.is_active}
                        onChange={(e) => setData('is_active', e.target.checked)}
                        title="Offer this class when registering records"
                        note="Turn off to retire it. Existing records keep their classification."
                    />
                </div>
            </Group>

            <div
                className={
                    isModal
                        ? 'flex items-center justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-700'
                        : 'flex items-center gap-3'
                }
            >
                {isModal && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700
                                   hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                                   dark:hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                )}

                <button
                    type="submit"
                    disabled={processing}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500
                               disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                               focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                >
                    {processing ? 'Saving…' : submitLabel}
                </button>

                {!isModal && (
                    <Link
                        href={route('record-classes.index')}
                        className="text-sm text-gray-600 hover:underline dark:text-gray-400"
                    >
                        Cancel
                    </Link>
                )}
            </div>
        </form>
    );
}

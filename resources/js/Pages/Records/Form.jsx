// resources/js/Pages/Records/Form.jsx
import { Link } from '@inertiajs/react';
import { sensitivityOf, STATUS_LABELS, TRIGGERS, previewDisposal, formatDate } from './recordMeta';

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

/** What happens to this record, in the words a records officer would use. */
function disposalSentence(cls, retentionStartsOn) {
    const p = previewDisposal(cls, retentionStartsOn);

    if (!p) return { text: 'Choose a record class to see how long this is kept.', muted: true };
    if (p.permanent) return { text: 'Kept permanently. Never disposed.' };
    if (p.unset) return { text: 'This class has no retention period set yet.', muted: true };
    if (p.waiting) {
        return {
            text: `Not yet counting. Retention starts when ${TRIGGERS[cls.retention_trigger] ?? 'the trigger event'} is recorded.`,
            muted: true,
        };
    }
    return { text: `Becomes eligible for disposal on ${formatDate(p.date)}.` };
}

export default function Form({
                                 data,
                                 setData,
                                 errors,
                                 processing,
                                 classes,
                                 statuses,
                                 submit,
                                 submitLabel,
                                 variant = 'page',
                                 onCancel,
                                 isArchived = false,
                             }) {
    const isModal = variant === 'modal';
    const selected = classes.find((c) => String(c.id) === String(data.record_class_id));
    const sens = selected ? sensitivityOf(selected.sensitivity) : null;
    const sentence = disposalSentence(selected, data.retention_starts_on);

    return (
        <form onSubmit={submit} className="space-y-6">
            {isArchived && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900
                                dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    This record is archived. Restore it to active before making changes.
                </div>
            )}

            <Group
                variant={variant}
                title="Classification"
                description="The record class decides how long this is kept and who may view it."
            >
                <div className="space-y-4">
                    <label className="block">
                        <Label>Record class</Label>
                        <select
                            value={data.record_class_id}
                            onChange={(e) => setData('record_class_id', e.target.value)}
                            className={`${field} mt-1.5`}
                        >
                            <option value="">Select a class</option>
                            {classes.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.code} — {c.title}
                                </option>
                            ))}
                        </select>
                        <Err>{errors.record_class_id}</Err>
                    </label>

                    {selected && (
                        <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2 dark:bg-gray-900/40">
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Access</p>
                                <p className="mt-1">
                                    <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ring-inset ${sens.chip}`}>
                                        {sens.label}
                                    </span>
                                </p>
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{sens.note}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Schedule reference</p>
                                <p className="mt-1 font-mono text-xs text-gray-700 dark:text-gray-300">
                                    {selected.rds_source} · item {selected.rds_item_no}
                                </p>
                                {selected.is_vital && (
                                    <p className="mt-1.5 text-xs text-indigo-700 dark:text-indigo-400">
                                        Vital record — include in off-site backup
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Group>

            <Group variant={variant} title="The record">
                <div className="space-y-5">
                    <label className="block">
                        <Label>Title</Label>
                        <input
                            type="text"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            placeholder="Bidding documents — supply of office equipment"
                            className={`${field} mt-1.5`}
                        />
                        <Err>{errors.title}</Err>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <Label hint="PO number, TCT number, property number">Reference number</Label>
                            <input
                                type="text"
                                value={data.reference_no ?? ''}
                                onChange={(e) => setData('reference_no', e.target.value)}
                                className={`${field} mt-1.5 font-mono`}
                            />
                            <Err>{errors.reference_no}</Err>
                        </label>

                        <label className="block">
                            <Label>Date of the record</Label>
                            <input
                                type="date"
                                value={data.record_date ?? ''}
                                onChange={(e) => setData('record_date', e.target.value)}
                                className={`${field} mt-1.5`}
                            />
                            <Err>{errors.record_date}</Err>
                        </label>

                        <label className="block">
                            <Label>Originating office</Label>
                            <input
                                type="text"
                                value={data.originating_office ?? ''}
                                onChange={(e) => setData('originating_office', e.target.value)}
                                className={`${field} mt-1.5`}
                            />
                            <Err>{errors.originating_office}</Err>
                        </label>

                        <label className="block">
                            <Label hint="Who holds it now">Custodian</Label>
                            <input
                                type="text"
                                value={data.custodian ?? ''}
                                onChange={(e) => setData('custodian', e.target.value)}
                                className={`${field} mt-1.5`}
                            />
                            <Err>{errors.custodian}</Err>
                        </label>
                    </div>
                </div>
            </Group>

            <Group
                variant={variant}
                title="Custody"
                description="Where the paper original is kept. Scans stored here do not replace it."
            >
                <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                    <label className="block">
                        <Label hint="Vault, room or cabinet">Physical location</Label>
                        <input
                            type="text"
                            value={data.physical_location ?? ''}
                            onChange={(e) => setData('physical_location', e.target.value)}
                            className={`${field} mt-1.5`}
                        />
                        <Err>{errors.physical_location}</Err>
                    </label>

                    <label className="block">
                        <Label>Box</Label>
                        <input
                            type="text"
                            value={data.box_no ?? ''}
                            onChange={(e) => setData('box_no', e.target.value)}
                            className={`${field} mt-1.5 font-mono`}
                        />
                        <Err>{errors.box_no}</Err>
                    </label>
                </div>
            </Group>

            <Group
                variant={variant}
                title="Retention and status"
                description="Retention does not start until the trigger event has actually happened."
            >
                <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <Label
                                hint={
                                    selected?.is_permanent
                                        ? 'Not applicable to permanent records.'
                                        : selected
                                            ? `Leave blank until ${TRIGGERS[selected.retention_trigger] ?? 'the trigger'} has happened.`
                                            : 'Leave blank until the trigger event happens.'
                                }
                            >
                                Retention starts on
                            </Label>
                            <input
                                type="date"
                                value={data.retention_starts_on ?? ''}
                                onChange={(e) => setData('retention_starts_on', e.target.value)}
                                disabled={selected?.is_permanent}
                                className={`${field} mt-1.5 disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800`}
                            />
                            <Err>{errors.retention_starts_on}</Err>
                        </label>

                        <label className="block">
                            <Label>Status</Label>
                            <select
                                value={data.status}
                                onChange={(e) => setData('status', e.target.value)}
                                className={`${field} mt-1.5`}
                            >
                                {statuses.map((s) => (
                                    <option key={s} value={s}>
                                        {STATUS_LABELS[s] ?? s}
                                    </option>
                                ))}
                            </select>
                            <Err>{errors.status}</Err>
                        </label>
                    </div>

                    {/* the outcome in plain words — the one line worth checking */}
                    <p
                        className={`rounded-md border-l-4 py-2.5 pl-4 pr-3 text-sm ${
                            sentence.muted
                                ? 'border-gray-300 bg-gray-50 text-gray-500 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-400'
                                : 'border-indigo-500 bg-indigo-50/50 text-gray-800 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-gray-200'
                        }`}
                    >
                        {sentence.text}
                    </p>
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
                    disabled={processing || isArchived}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500
                               disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                               focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                >
                    {processing ? 'Saving…' : submitLabel}
                </button>

                {!isModal && (
                    <Link
                        href={route('records.index')}
                        className="text-sm text-gray-600 hover:underline dark:text-gray-400"
                    >
                        Cancel
                    </Link>
                )}
            </div>
        </form>
    );
}

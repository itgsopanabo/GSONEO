// resources/js/Pages/Records/Index.jsx
import { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Modal from '@/Components/Modal';
import Form from './Form';
import { sensitivityOf, retentionState, STATUS_LABELS, formatDate, previewDisposal } from './recordMeta';

const BLANK = {
    record_class_id: '',
    title: '',
    reference_no: '',
    record_date: '',
    originating_office: '',
    custodian: '',
    physical_location: '',
    box_no: '',
    retention_starts_on: '',
    status: 'active',
};

const toFormValues = (r) => ({
    record_class_id: r.record_class_id ?? '',
    title: r.title ?? '',
    reference_no: r.reference_no ?? '',
    record_date: r.record_date?.slice(0, 10) ?? '',
    originating_office: r.originating_office ?? '',
    custodian: r.custodian ?? '',
    physical_location: r.physical_location ?? '',
    box_no: r.box_no ?? '',
    retention_starts_on: r.retention_starts_on?.slice(0, 10) ?? '',
    status: r.status ?? 'active',
});

/** Only fields that change retention, access or where the paper lives. */
const CONSEQUENTIAL = [
    { key: 'record_class_id', label: 'Record class' },
    { key: 'retention_starts_on', label: 'Retention starts on' },
    { key: 'physical_location', label: 'Physical location' },
    { key: 'box_no', label: 'Box' },
    { key: 'custodian', label: 'Custodian' },
    { key: 'status', label: 'Status', format: (v) => STATUS_LABELS[v] ?? v },
];

function diffOf(original, next, classes) {
    if (!original?.id) return [];

    const className = (id) => {
        const c = classes.find((c) => String(c.id) === String(id));
        return c ? `${c.code} — ${c.title}` : '—';
    };

    return CONSEQUENTIAL.flatMap(({ key, label, format }) => {
        const before = key === 'record_class_id'
            ? String(original.record_class_id ?? '')
            : String(original[key] ?? '').slice(0, 10);
        const after = String(next[key] ?? '').slice(0, key === 'record_class_id' ? 99 : 10);

        if (before === after) return [];

        const render = key === 'record_class_id' ? className : (format ?? ((v) => v || '—'));
        return [{ label, before: render(before), after: render(after) }];
    });
}

export default function Index({ records, classes, statuses, filters, counts }) {
    const { flash } = usePage().props;
    const [q, setQ] = useState(filters.q ?? '');

    const [editing, setEditing] = useState(null);   // null = closed, {} = new, object = edit
    const [step, setStep] = useState('form');
    const [archiving, setArchiving] = useState(null);

    const { data, setData, post, put, patch, processing, errors, reset, clearErrors } = useForm(BLANK);

    const isEditing = Boolean(editing?.id);
    const changes = isEditing ? diffOf(editing, data, classes) : [];
    const view = filters.view ?? 'active';

    const go = (params) =>
        router.get(route('records.index'), { ...filters, ...params }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

    const submitSearch = (e) => {
        e.preventDefault();
        go({ q, page: 1 });
    };

    const openCreate = () => {
        clearErrors();
        setData(BLANK);
        setStep('form');
        setEditing({});
    };

    const openEdit = (record) => {
        clearErrors();
        setData(toFormValues(record));
        setStep('form');
        setEditing(record);
    };

    const close = () => {
        setEditing(null);
        setTimeout(() => {
            reset();
            clearErrors();
            setStep('form');
        }, 250);
    };

    const review = (e) => {
        e.preventDefault();
        if (isEditing && changes.length === 0) return save();
        setStep('confirm');
    };

    const save = () => {
        const options = { preserveScroll: true, onSuccess: () => close(), onError: () => setStep('form') };

        isEditing
            ? put(route('records.update', editing.id), options)
            : post(route('records.store'), options);
    };

    const confirmArchive = () => {
        const action = archiving.archived_at ? 'unarchive' : 'archive';
        router.patch(route(`records.${action}`, archiving.id), {}, {
            preserveScroll: true,
            onFinish: () => setArchiving(null),
        });
    };

    const selectedClass = classes.find((c) => String(c.id) === String(data.record_class_id));
    const preview = previewDisposal(selectedClass, data.retention_starts_on);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                            Records registry
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            Procurement, inventory and property records held by this office.
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white
                                   hover:bg-indigo-500 focus:outline-none focus-visible:ring-2
                                   focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                                   dark:focus-visible:ring-offset-gray-800"
                    >
                        Register a record
                    </button>
                </div>
            }
        >
            <Head title="Records registry" />

            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                {flash?.success && (
                    <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900
                                    dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900
                                    dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                        {flash.error}
                    </div>
                )}

                <div className="mb-4 flex flex-wrap items-end gap-3">
                    <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800">
                        {[
                            ['active', 'Active', counts.active],
                            ['archived', 'Archived', counts.archived],
                        ].map(([key, label, count]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => go({ view: key, page: 1 })}
                                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                                    view === key
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                                }`}
                            >
                                {label}
                                <span className={view === key ? 'ml-1.5 text-indigo-200' : 'ml-1.5 text-gray-400'}>
                                    {count}
                                </span>
                            </button>
                        ))}
                    </div>

                    <form onSubmit={submitSearch} className="flex flex-1 gap-2 sm:max-w-md">
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Title, reference number, box number"
                            className="w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500
                                       focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                        />
                        <button
                            type="submit"
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700
                                       hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                                       dark:hover:bg-gray-700"
                        >
                            Search
                        </button>
                    </form>

                    <select
                        value={filters.class ?? ''}
                        onChange={(e) => go({ class: e.target.value || undefined, page: 1 })}
                        className="rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500
                                   focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                    >
                        <option value="">All record classes</option>
                        {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.code} — {c.title}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm
                                dark:border-gray-700 dark:bg-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider
                                          text-gray-400 dark:bg-gray-900/40 dark:text-gray-500">
                        <tr>
                            <th scope="col" className="py-2.5 pl-5 pr-3">Record</th>
                            <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Class</th>
                            <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Location</th>
                            <th scope="col" className="px-3 py-2.5">Retention</th>
                            <th scope="col" className="hidden px-3 py-2.5 sm:table-cell">Status</th>
                            <th scope="col" className="py-2.5 pl-3 pr-5 text-right">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {records.data.map((record) => {
                            const sens = sensitivityOf(record.record_class?.sensitivity);
                            const ret = retentionState(record);

                            return (
                                <tr
                                    key={record.id}
                                    className={`border-l-[3px] ${sens.stripe} hover:bg-gray-50/70 dark:hover:bg-gray-700/30`}
                                >
                                    <td className="py-3 pl-5 pr-3 align-top">
                                        <Link
                                            href={route('records.show', record.id)}
                                            className="font-medium text-gray-900 hover:underline dark:text-gray-100"
                                        >
                                            {record.title}
                                        </Link>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                            {record.reference_no && (
                                                <span className="font-mono">{record.reference_no}</span>
                                            )}
                                            <span>{formatDate(record.record_date)}</span>
                                            <span
                                                className={`rounded px-1.5 py-0.5 ring-1 ring-inset ${sens.chip}`}
                                                title={sens.note}
                                            >
                                                    {sens.label}
                                                </span>
                                            {record.archived_at && (
                                                <span className="rounded bg-gray-700 px-1.5 py-0.5 text-white dark:bg-gray-600">
                                                        Archived
                                                    </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="hidden px-3 py-3 align-top text-gray-600 md:table-cell dark:text-gray-300">
                                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                            {record.record_class?.code}
                                        </div>
                                        <div className="mt-0.5">{record.record_class?.title}</div>
                                    </td>

                                    <td className="hidden px-3 py-3 align-top text-gray-600 lg:table-cell dark:text-gray-300">
                                        {record.physical_location}
                                        {record.box_no && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Box {record.box_no}
                                            </div>
                                        )}
                                    </td>

                                    <td className="px-3 py-3 align-top">
                                            <span
                                                className={`inline-block rounded px-2 py-1 text-xs ring-1 ring-inset ${ret.tone}`}
                                                title={ret.detail}
                                            >
                                                {ret.label}
                                            </span>
                                    </td>

                                    <td className="hidden px-3 py-3 align-top text-gray-600 sm:table-cell dark:text-gray-300">
                                        {STATUS_LABELS[record.status] ?? record.status}
                                    </td>

                                    <td className="py-3 pl-3 pr-5 text-right align-top">
                                        <div className="flex justify-end gap-3">
                                            {!record.archived_at && (
                                                <button
                                                    onClick={() => openEdit(record)}
                                                    className="text-sm text-gray-600 hover:text-indigo-600 hover:underline dark:text-gray-400 dark:hover:text-indigo-400"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setArchiving(record)}
                                                className="text-sm text-gray-600 hover:text-indigo-600 hover:underline dark:text-gray-400 dark:hover:text-indigo-400"
                                            >
                                                {record.archived_at ? 'Restore' : 'Archive'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {records.data.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-5 py-16 text-center">
                                    <p className="text-gray-700 dark:text-gray-300">
                                        {filters.q
                                            ? `Nothing matches "${filters.q}".`
                                            : view === 'archived'
                                                ? 'No records have been archived yet.'
                                                : 'No records registered yet.'}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        {filters.q
                                            ? 'Try the reference number or box number instead.'
                                            : 'Register the first one to start the registry.'}
                                    </p>
                                    {!filters.q && view !== 'archived' && (
                                        <button
                                            onClick={openCreate}
                                            className="mt-4 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                                        >
                                            Register the first record
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {records.links.length > 3 && (
                    <div className="mt-4 flex flex-wrap gap-1">
                        {records.links.map((link, i) => (
                            <Link
                                key={i}
                                href={link.url ?? '#'}
                                preserveScroll
                                className={`rounded px-3 py-1.5 text-sm ${
                                    link.active
                                        ? 'bg-indigo-600 text-white'
                                        : link.url
                                            ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                            : 'cursor-default border border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-600'
                                }`}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* register / edit, one modal, two steps */}
            <Modal show={editing !== null} onClose={close} maxWidth="2xl">
                <div className="bg-white dark:bg-gray-800">
                    <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                            {step === 'confirm'
                                ? isEditing ? 'Review these changes' : 'Confirm this record'
                                : isEditing ? 'Edit record' : 'Register a record'}
                        </h2>
                        <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                            {isEditing
                                ? editing.title
                                : 'Add a document to the registry and record where the original is kept.'}
                        </p>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                        {step === 'form' ? (
                            <Form
                                data={data}
                                setData={setData}
                                errors={errors}
                                processing={processing}
                                classes={classes}
                                statuses={statuses}
                                submit={review}
                                submitLabel={isEditing ? 'Review changes' : 'Review'}
                                variant="modal"
                                onCancel={close}
                            />
                        ) : (
                            <div className="space-y-5">
                                {isEditing ? (
                                    <dl className="divide-y divide-gray-100 rounded-md border border-gray-200
                                                   dark:divide-gray-700 dark:border-gray-700">
                                        {changes.map((c) => (
                                            <div key={c.label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                                                <dt className="text-sm text-gray-500 dark:text-gray-400">{c.label}</dt>
                                                <dd className="text-sm sm:col-span-2">
                                                    <span className="text-gray-400 line-through dark:text-gray-500">
                                                        {c.before}
                                                    </span>
                                                    <span className="mx-2 text-gray-400">to</span>
                                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                                        {c.after}
                                                    </span>
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                ) : (
                                    <dl className="divide-y divide-gray-100 rounded-md border border-gray-200
                                                   dark:divide-gray-700 dark:border-gray-700">
                                        {[
                                            ['Record', data.title],
                                            ['Reference', data.reference_no || '—'],
                                            [
                                                'Class',
                                                selectedClass
                                                    ? `${selectedClass.code} — ${selectedClass.title}`
                                                    : '—',
                                            ],
                                            ['Access', sensitivityOf(selectedClass?.sensitivity).label],
                                            [
                                                'Original kept at',
                                                `${data.physical_location}${data.box_no ? `, box ${data.box_no}` : ''}`,
                                            ],
                                            [
                                                'Disposal',
                                                preview?.permanent
                                                    ? 'Permanent, never disposed'
                                                    : preview?.date
                                                        ? `Eligible ${formatDate(preview.date)}`
                                                        : 'Not yet counting',
                                            ],
                                        ].map(([label, value]) => (
                                            <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                                                <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
                                                <dd className="text-sm text-gray-900 sm:col-span-2 dark:text-gray-100">
                                                    {value}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}

                                {selectedClass?.sensitivity === 'restricted' && (
                                    <p className="text-sm text-amber-800 dark:text-amber-400">
                                        This class is restricted. Only cleared users will be able to open this
                                        record, and every view is logged.
                                    </p>
                                )}

                                <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={() => setStep('form')}
                                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700
                                                   hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                                                   dark:hover:bg-gray-700"
                                    >
                                        Back to the form
                                    </button>
                                    <button
                                        type="button"
                                        onClick={save}
                                        disabled={processing}
                                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                                                   hover:bg-indigo-500 disabled:opacity-50"
                                    >
                                        {processing
                                            ? 'Saving…'
                                            : isEditing ? 'Apply changes' : 'Register record'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* archive / restore */}
            <Modal show={archiving !== null} onClose={() => setArchiving(null)} maxWidth="md">
                <div className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {archiving?.archived_at ? 'Restore this record to active?' : 'Archive this record?'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{archiving?.title}</p>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        {archiving?.archived_at
                            ? 'It returns to the active list and can be edited again.'
                            : 'It stays in the registry and remains searchable under Archived. Nothing is deleted, and its retention period is unaffected.'}
                    </p>

                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setArchiving(null)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700
                                       hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                                       dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={confirmArchive}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                        >
                            {archiving?.archived_at ? 'Restore' : 'Archive'}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

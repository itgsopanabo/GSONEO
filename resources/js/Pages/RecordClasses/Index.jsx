// resources/js/Pages/RecordClasses/Index.jsx
import { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx';
import Modal from '@/Components/Modal';
import Form from './Form';

const SENSITIVITY = {
    public: {
        label: 'Public',
        chip: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    },
    internal: {
        label: 'Internal',
        chip: 'bg-gray-100 text-gray-700 ring-gray-400/30 dark:bg-gray-700/50 dark:text-gray-300 dark:ring-gray-500/30',
    },
    restricted: {
        label: 'Restricted',
        chip: 'bg-amber-50 text-amber-900 ring-amber-600/30 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    },
};

const TRIGGER_LABELS = {
    creation: 'from date of record',
    audit_settlement: 'after audit is settled',
    asset_disposal: 'after the asset is disposed',
    contract_completion: 'after contract completion',
};

const BLANK = {
    code: '',
    title: '',
    description: '',
    rds_source: 'GRDS-2009',
    rds_item_no: '',
    retention_years: '',
    retention_trigger: 'creation',
    is_permanent: false,
    is_vital: false,
    sensitivity: 'internal',
    is_active: true,
};

const toFormValues = (cls) => ({
    code: cls.code ?? '',
    title: cls.title ?? '',
    description: cls.description ?? '',
    rds_source: cls.rds_source ?? '',
    rds_item_no: cls.rds_item_no ?? '',
    retention_years: cls.retention_years ?? '',
    retention_trigger: cls.retention_trigger ?? 'creation',
    is_permanent: !!cls.is_permanent,
    is_vital: !!cls.is_vital,
    sensitivity: cls.sensitivity ?? 'internal',
    is_active: !!cls.is_active,
});

function retentionRule(cls) {
    if (cls.is_permanent) return 'Permanent';
    if (!cls.retention_years) return 'Not set';
    return `${cls.retention_years} yrs ${TRIGGER_LABELS[cls.retention_trigger] ?? cls.retention_trigger}`;
}

/**
 * Only fields with downstream consequences are diffed. Fixing a typo in a
 * description shouldn't produce the same warning as changing who can see
 * a class of land titles — if everything warns, nothing does.
 */
const CONSEQUENTIAL = [
    { key: 'code', label: 'Code' },
    { key: 'is_permanent', label: 'Kept permanently', format: (v) => (v ? 'Yes' : 'No') },
    { key: 'retention_years', label: 'Retention period', format: (v) => (v ? `${v} years` : 'Not set') },
    {
        key: 'retention_trigger',
        label: 'Counted from',
        format: (v) => TRIGGER_LABELS[v] ?? v,
    },
    { key: 'sensitivity', label: 'Access level', format: (v) => SENSITIVITY[v]?.label ?? v },
    { key: 'is_active', label: 'Offered for new records', format: (v) => (v ? 'Yes' : 'No') },
];

function diffOf(original, next) {
    if (!original?.id) return [];

    return CONSEQUENTIAL.flatMap(({ key, label, format = (v) => String(v) }) => {
        const before = key === 'retention_years' ? (original[key] ?? '') : original[key];
        const after = key === 'retention_years' ? (next[key] ?? '') : next[key];

        if (String(before ?? '') === String(after ?? '')) return [];
        return [{ label, before: format(before), after: format(after) }];
    });
}

export default function Index({ classes, pending, sensitivities, triggers }) {
    const { flash } = usePage().props;

    const [editing, setEditing] = useState(null);   // null = closed, {} = new, object = edit
    const [step, setStep] = useState('form');       // 'form' | 'confirm'
    const [deleting, setDeleting] = useState(null);

    const { data, setData, post, put, delete: destroy, processing, errors, reset, clearErrors } = useForm(BLANK);

    const isEditing = Boolean(editing?.id);
    const changes = isEditing ? diffOf(editing, data) : [];
    const affected = editing?.records_count ?? 0;

    const openCreate = () => {
        clearErrors();
        setData(BLANK);
        setStep('form');
        setEditing({});
    };

    const openEdit = (cls) => {
        clearErrors();
        setData(toFormValues(cls));
        setStep('form');
        setEditing(cls);
    };

    const close = () => {
        setEditing(null);
        setTimeout(() => {
            reset();
            clearErrors();
            setStep('form');
        }, 250);
    };

    // Move to the review step instead of submitting straight away.
    const review = (e) => {
        e.preventDefault();

        // Nothing consequential changed on an edit — skip the review entirely.
        if (isEditing && changes.length === 0) {
            return save();
        }
        setStep('confirm');
    };

    const save = () => {
        const options = { preserveScroll: true, onSuccess: () => close(), onError: () => setStep('form') };

        isEditing
            ? put(route('record-classes.update', editing.id), options)
            : post(route('record-classes.store'), options);
    };

    const confirmDelete = () => {
        destroy(route('record-classes.destroy', deleting.id), {
            preserveScroll: true,
            onFinish: () => setDeleting(null),
        });
    };

    const toggle = (cls) => {
        const action = cls.is_active ? 'deactivate' : 'reactivate';
        router.patch(route(`record-classes.${action}`, cls.id), {}, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Record classes</h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            The disposition schedule this office follows. Each class sets how long its records are
                            kept and who may view them.
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white
                                   hover:bg-indigo-500 focus:outline-none focus-visible:ring-2
                                   focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                                   dark:focus-visible:ring-offset-gray-800"
                    >
                        Add a class
                    </button>
                </div>
            }
        >
            <Head title="Record classes" />

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

                {pending > 0 && (
                    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm
                                    dark:border-amber-500/30 dark:bg-amber-500/10">
                        <p className="font-medium text-amber-900 dark:text-amber-300">
                            {pending} {pending === 1 ? 'class has' : 'classes have'} no schedule reference yet
                        </p>
                        <p className="mt-0.5 text-amber-800 dark:text-amber-400/90">
                            Retention periods must be traceable to an item in the NAP General Records Disposition
                            Schedule or your approved agency schedule. Fill these in before disposal is proposed for
                            anything.
                        </p>
                    </div>
                )}

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm
                                dark:border-gray-700 dark:bg-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider
                                          text-gray-400 dark:bg-gray-900/40 dark:text-gray-500">
                        <tr>
                            <th scope="col" className="py-2.5 pl-5 pr-3">Class</th>
                            <th scope="col" className="hidden px-3 py-2.5 md:table-cell">Retention</th>
                            <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Schedule</th>
                            <th scope="col" className="px-3 py-2.5">Access</th>
                            <th scope="col" className="px-3 py-2.5 text-right">Records</th>
                            <th scope="col" className="py-2.5 pl-3 pr-5 text-right">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {classes.map((cls) => {
                            const sens = SENSITIVITY[cls.sensitivity] ?? SENSITIVITY.internal;
                            const unverified = cls.rds_item_no === 'TODO';

                            return (
                                <tr
                                    key={cls.id}
                                    className={`hover:bg-gray-50/70 dark:hover:bg-gray-700/30 ${
                                        cls.is_active ? '' : 'opacity-55'
                                    }`}
                                >
                                    <td className="py-3 pl-5 pr-3 align-top">
                                        <Link
                                            href={route('record-classes.show', cls.id)}
                                            className="font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                                        >
                                            {cls.code}
                                        </Link>
                                        <div className="mt-0.5 text-gray-800 dark:text-gray-200">{cls.title}</div>
                                        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                                            {cls.is_vital && (
                                                <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-800 ring-1 ring-inset ring-indigo-600/20
                                                                     dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20">
                                                        Vital
                                                    </span>
                                            )}
                                            {!cls.is_active && (
                                                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                                        Not offered for new records
                                                    </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="hidden px-3 py-3 align-top text-gray-600 md:table-cell dark:text-gray-300">
                                        {retentionRule(cls)}
                                    </td>

                                    <td className="hidden px-3 py-3 align-top lg:table-cell">
                                        {unverified ? (
                                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-900 ring-1 ring-inset ring-amber-600/30
                                                                 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20">
                                                    Not yet cited
                                                </span>
                                        ) : (
                                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                                    {cls.rds_source} · {cls.rds_item_no}
                                                </span>
                                        )}
                                    </td>

                                    <td className="px-3 py-3 align-top">
                                            <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ring-inset ${sens.chip}`}>
                                                {sens.label}
                                            </span>
                                    </td>

                                    <td className="px-3 py-3 text-right align-top tabular-nums text-gray-600 dark:text-gray-300">
                                        {cls.records_count}
                                    </td>

                                    <td className="py-3 pl-3 pr-5 text-right align-top">
                                        <div className="flex justify-end gap-3">
                                            <button
                                                onClick={() => openEdit(cls)}
                                                className="text-sm text-gray-600 hover:text-indigo-600 hover:underline dark:text-gray-400 dark:hover:text-indigo-400"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => toggle(cls)}
                                                className="text-sm text-gray-600 hover:text-indigo-600 hover:underline dark:text-gray-400 dark:hover:text-indigo-400"
                                            >
                                                {cls.is_active ? 'Retire' : 'Restore'}
                                            </button>
                                            {cls.records_count === 0 && (
                                                <button
                                                    onClick={() => setDeleting(cls)}
                                                    className="text-sm text-gray-600 hover:text-rose-600 hover:underline dark:text-gray-400 dark:hover:text-rose-400"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {classes.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-5 py-16 text-center">
                                    <p className="text-gray-700 dark:text-gray-300">No record classes yet.</p>
                                    <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                                        Add one class for each record series in your disposition schedule.
                                        Records cannot be registered until at least one exists.
                                    </p>
                                    <button
                                        onClick={openCreate}
                                        className="mt-4 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                                    >
                                        Add the first class
                                    </button>
                                </td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    Retiring a class hides it from the registration form. Existing records keep their
                    classification. Delete is offered only for classes no record uses.
                </p>
            </div>

            {/* form + review, one modal, two steps */}
            <Modal show={editing !== null} onClose={close} maxWidth="2xl">
                <div className="bg-white dark:bg-gray-800">
                    <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                            {step === 'confirm'
                                ? isEditing
                                    ? 'Review these changes'
                                    : 'Confirm the new class'
                                : isEditing
                                    ? 'Edit record class'
                                    : 'Add a record class'}
                        </h2>
                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            {step === 'confirm'
                                ? isEditing
                                    ? 'These settings govern retention and access for every record in this class.'
                                    : 'Check the retention rule and access level before adding this class.'
                                : isEditing
                                    ? editing.code
                                    : 'One class per record series in your disposition schedule.'}
                        </p>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
                        {step === 'form' ? (
                            <Form
                                data={data}
                                setData={setData}
                                errors={errors}
                                processing={processing}
                                sensitivities={sensitivities}
                                triggers={triggers}
                                submit={review}
                                submitLabel={isEditing ? 'Review changes' : 'Review'}
                                recordsCount={affected}
                                variant="modal"
                                onCancel={close}
                            />
                        ) : (
                            <div className="space-y-5">
                                {isEditing ? (
                                    <>
                                        {affected > 0 && (
                                            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm
                                                            dark:border-amber-500/30 dark:bg-amber-500/10">
                                                <p className="font-medium text-amber-900 dark:text-amber-300">
                                                    This affects {affected}{' '}
                                                    {affected === 1 ? 'existing record' : 'existing records'}
                                                </p>
                                                <p className="mt-0.5 text-amber-800 dark:text-amber-400/90">
                                                    Disposal dates are recalculated on save. Access changes take
                                                    effect immediately.
                                                </p>
                                            </div>
                                        )}

                                        <dl className="divide-y divide-gray-100 rounded-md border border-gray-200
                                                       dark:divide-gray-700 dark:border-gray-700">
                                            {changes.map((c) => (
                                                <div key={c.label} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                                                    <dt className="text-sm text-gray-500 dark:text-gray-400">
                                                        {c.label}
                                                    </dt>
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
                                    </>
                                ) : (
                                    <dl className="divide-y divide-gray-100 rounded-md border border-gray-200
                                                   dark:divide-gray-700 dark:border-gray-700">
                                        {[
                                            ['Class', `${data.code} — ${data.title}`],
                                            [
                                                'Retention',
                                                data.is_permanent
                                                    ? 'Permanent, never disposed'
                                                    : data.retention_years
                                                        ? `${data.retention_years} years ${TRIGGER_LABELS[data.retention_trigger]}`
                                                        : 'Not set',
                                            ],
                                            ['Schedule', `${data.rds_source} · item ${data.rds_item_no}`],
                                            ['Access level', SENSITIVITY[data.sensitivity]?.label],
                                            ['Vital record', data.is_vital ? 'Yes' : 'No'],
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

                                {data.rds_item_no === 'TODO' && (
                                    <p className="text-sm text-amber-800 dark:text-amber-400">
                                        The schedule item is still marked TODO. Records in this class cannot be
                                        proposed for disposal until it is cited.
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
                                            : isEditing
                                                ? 'Apply changes'
                                                : 'Add class'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* delete */}
            <Modal show={deleting !== null} onClose={() => setDeleting(null)} maxWidth="md">
                <div className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        Delete this record class?
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-mono">{deleting?.code}</span> — {deleting?.title}
                    </p>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        No records use this class, so nothing loses its classification. This cannot be undone.
                        To keep the class on file but stop offering it, retire it instead.
                    </p>

                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setDeleting(null)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700
                                       hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                                       dark:hover:bg-gray-700"
                        >
                            Keep it
                        </button>
                        <button
                            type="button"
                            onClick={confirmDelete}
                            disabled={processing}
                            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white
                                       hover:bg-rose-500 disabled:opacity-50"
                        >
                            {processing ? 'Deleting…' : 'Delete class'}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

// resources/js/Pages/Records/Show.jsx
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { sensitivityOf, retentionState, STATUS_LABELS, formatDate } from './recordMeta';

function Row({ label, children }) {
    return (
        <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="text-sm text-gray-800 sm:col-span-2 dark:text-gray-200">{children}</dd>
        </div>
    );
}

export default function Show({ record }) {
    const cls = record.record_class ?? {};
    const sens = sensitivityOf(cls.sensitivity);
    const ret = retentionState(record);

    const toggleArchive = () => {
        const action = record.archived_at ? 'unarchive' : 'archive';
        router.patch(route(`records.${action}`, record.id), {}, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold text-gray-800 dark:text-gray-100">
                            {record.title}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            {record.reference_no && (
                                <span className="font-mono">{record.reference_no}</span>
                            )}
                            <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ring-inset ${sens.chip}`}>
                                {sens.label}
                            </span>
                            {record.archived_at && (
                                <span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-white dark:bg-gray-600">
                                    Archived
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!record.archived_at && (
                            <Link
                                href={route('records.index', { edit: record.id })}
                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700
                                           hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                                           dark:hover:bg-gray-700"
                            >
                                Edit
                            </Link>
                        )}
                        <button
                            onClick={toggleArchive}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700
                                       hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                                       dark:hover:bg-gray-700"
                        >
                            {record.archived_at ? 'Restore to active' : 'Archive'}
                        </button>
                    </div>
                </div>
            }
        >
            <Head title={record.title} />

            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
                {/* retention is the fact that must never be misread, so it leads */}
                <div className={`mb-6 rounded-lg px-5 py-4 ring-1 ring-inset ${ret.tone}`}>
                    <p className="text-base font-semibold">{ret.label}</p>
                    <p className="mt-0.5 text-sm opacity-90">{ret.detail}</p>
                </div>

                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white px-6 shadow-sm
                                dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                    <Row label="Record class">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{cls.code}</span>
                        <span className="ml-2">{cls.title}</span>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {cls.rds_source} · item {cls.rds_item_no}
                            {cls.is_vital && ' · vital record'}
                        </div>
                    </Row>

                    <Row label="Date of the record">{formatDate(record.record_date)}</Row>
                    <Row label="Originating office">{record.originating_office}</Row>
                    <Row label="Custodian">{record.custodian}</Row>

                    <Row label="Physical location">
                        {record.physical_location}
                        {record.box_no && (
                            <span className="text-gray-500 dark:text-gray-400"> · Box {record.box_no}</span>
                        )}
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            The paper original is the authoritative copy. Scans held here supplement it.
                        </p>
                    </Row>

                    <Row label="Retention starts on">
                        {record.retention_starts_on
                            ? formatDate(record.retention_starts_on)
                            : 'Trigger event not yet recorded'}
                    </Row>

                    <Row label="Status">{STATUS_LABELS[record.status] ?? record.status}</Row>
                    <Row label="Access">{sens.note}</Row>

                    {record.archived_at && (
                        <Row label="Archived">
                            {formatDate(record.archived_at)}
                            {record.archived_by && (
                                <span className="text-gray-500 dark:text-gray-400">
                                    {' '}by{' '}
                                    {record.archived_by.emp_lname
                                        ? `${record.archived_by.emp_lname}, ${record.archived_by.emp_fname}`
                                        : record.archived_by}
                                </span>
                            )}
                        </Row>
                    )}
                </div>

                <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">
                    Records are never deleted from this registry. Disposal requires written authority from the
                    Executive Director of the National Archives and is handled through a disposal request.
                </p>

                <div className="mt-6">
                    <Link
                        href={route('records.index')}
                        className="text-sm text-gray-600 hover:underline dark:text-gray-400"
                    >
                        Back to the registry
                    </Link>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

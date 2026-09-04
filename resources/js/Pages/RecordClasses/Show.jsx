// resources/js/Pages/RecordClasses/Show.jsx
import { Head, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx';

const TRIGGER_LABELS = {
    creation: 'the date of the record',
    audit_settlement: 'settlement of the audit',
    asset_disposal: 'disposal of the asset',
    contract_completion: 'completion of the contract',
};

const SENSITIVITY_NOTES = {
    public: 'Disclosable on request.',
    internal: 'Office use. Not for release without approval.',
    restricted: 'Visible only to users cleared for restricted material.',
};

const fmt = (v) => (v ? new Date(v).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—');

function Row({ label, children }) {
    return (
        <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="text-sm text-gray-800 sm:col-span-2 dark:text-gray-200">{children}</dd>
        </div>
    );
}

export default function Show({ class: cls, samples }) {
    const unverified = cls.rds_item_no === 'TODO';

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{cls.code}</p>
                        <h2 className="mt-0.5 text-xl font-semibold text-gray-800 dark:text-gray-100">
                            {cls.title}
                        </h2>
                    </div>
                    <Link
                        href={route('record-classes.edit', cls.id)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700
                                   hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300
                                   dark:hover:bg-gray-700"
                    >
                        Edit
                    </Link>
                </div>
            }
        >
            <Head title={cls.code} />

            <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
                {/* the retention rule is the load-bearing fact, so it leads */}
                <div
                    className={`mb-6 rounded-lg border px-5 py-4 ${
                        cls.is_permanent
                            ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10'
                            : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                    }`}
                >
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {cls.is_permanent
                            ? 'Kept permanently'
                            : cls.retention_years
                                ? `Kept ${cls.retention_years} years from ${TRIGGER_LABELS[cls.retention_trigger] ?? cls.retention_trigger}`
                                : 'No retention period set'}
                    </p>
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                        {cls.is_permanent
                            ? 'Never disposed. Transfers to the National Archives when it leaves this office.'
                            : 'Disposal still requires written authority from the Executive Director of the National Archives.'}
                    </p>
                </div>

                {unverified && (
                    <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900
                                    dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        No schedule item cited yet. Confirm this class against the NAP General Records Disposition
                        Schedule or your approved agency schedule before proposing anything for disposal.
                    </div>
                )}

                <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white px-6 shadow-sm
                                dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                    {cls.description && <Row label="Covers">{cls.description}</Row>}
                    <Row label="Schedule reference">
                        {unverified ? (
                            <span className="text-amber-700 dark:text-amber-400">Not yet cited</span>
                        ) : (
                            <span className="font-mono text-xs">
                                {cls.rds_source} · item {cls.rds_item_no}
                            </span>
                        )}
                    </Row>
                    <Row label="Access level">
                        <span className="capitalize">{cls.sensitivity}</span>
                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                            {SENSITIVITY_NOTES[cls.sensitivity]}
                        </span>
                    </Row>
                    <Row label="Vital record">
                        {cls.is_vital ? 'Yes — include in off-site backup' : 'No'}
                    </Row>
                    <Row label="Offered for new records">{cls.is_active ? 'Yes' : 'Retired'}</Row>
                    <Row label="Records in this class">{cls.records_count}</Row>
                </div>

                {samples.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Most recent records
                        </h3>
                        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white
                                       dark:divide-gray-700/60 dark:border-gray-700 dark:bg-gray-800">
                            {samples.map((r) => (
                                <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                                    <div className="min-w-0">
                                        <Link
                                            href={route('records.show', r.id)}
                                            className="truncate text-sm text-gray-800 hover:underline dark:text-gray-200"
                                        >
                                            {r.title}
                                        </Link>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {r.reference_no ? `${r.reference_no} · ` : ''}
                                            {fmt(r.record_date)}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                        {cls.is_permanent
                                            ? 'Permanent'
                                            : r.eligible_for_disposal_on
                                                ? `Eligible ${new Date(r.eligible_for_disposal_on).getFullYear()}`
                                                : 'Not yet counting'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="mt-6">
                    <Link
                        href={route('record-classes.index')}
                        className="text-sm text-gray-600 hover:underline dark:text-gray-400"
                    >
                        Back to record classes
                    </Link>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

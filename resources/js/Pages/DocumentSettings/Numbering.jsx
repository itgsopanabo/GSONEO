import { Head, Link, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DocumentSettingsTabs from '@/Components/DocumentSettingsTabs';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

const field =
    'w-28 rounded-md border-gray-300 font-mono shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ' +
    'dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-indigo-500';

const serial = (n) => String(n).padStart(4, '0');

/** What DocumentNumber will hand out next: last + 1, or for POs the lowest free serial, never below the start. */
function nextSerial(d, start) {
    if (!d.fillsGaps) return Math.max((d.lastSerial ?? 0) + 1, start);
    const used = new Set(d.used);
    let n = start;
    while (used.has(n)) n++;
    return n;
}

export default function Numbering({ year, years, month, maxSerial, documents }) {
    const { data, setData, put, processing, errors, isDirty, reset, setDefaults } = useForm({
        year,
        starts: Object.fromEntries(documents.map((d) => [d.key, d.start ?? ''])),
    });

    const submit = (e) => {
        e.preventDefault();
        put(route('document-numbering.update'), {
            preserveScroll: true,
            onSuccess: () => setDefaults(),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Document branding
                </h2>
            }
        >
            <Head title="Document numbering" />

            <form onSubmit={submit} className="py-8">
                <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <DocumentSettingsTabs />

                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                        <p>
                            Numbers read <span className="font-mono">YEAR-MONTH-SERIAL</span>, for example{' '}
                            <span className="font-mono">{year}-{month}-0001</span>. The serial counts through the year
                            and goes back to 0001 every January.
                        </p>
                        <p>
                            If your office already issued numbers on paper this year, set where the system should
                            continue. For example, set 1000 and the system&apos;s first number is{' '}
                            <span className="font-mono">{year}-{month}-1000</span>. Each year is set on its own, so a
                            year left blank starts at 0001. Once issued numbers pass the starting number, they simply
                            carry on.
                        </p>
                    </div>

                    <nav aria-label="Year" className="flex gap-2">
                        {years.map((y) => (
                            <Link
                                key={y}
                                href={route('document-numbering.index', { year: y })}
                                preserveScroll
                                aria-current={y === year ? 'page' : undefined}
                                className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                                    y === year
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
                                }`}
                            >
                                {y}
                            </Link>
                        ))}
                    </nav>

                    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <table className="min-w-full divide-y divide-gray-100 text-sm dark:divide-gray-700">
                            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                                <tr>
                                    <th className="px-6 py-3">Document</th>
                                    <th className="px-6 py-3">Last issued in {year}</th>
                                    <th className="px-6 py-3">Start at</th>
                                    <th className="px-6 py-3">Next number</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {documents.map((d) => {
                                    const typed = parseInt(data.starts[d.key], 10);
                                    const start = Number.isFinite(typed) && typed > 0 ? typed : 1;
                                    const next = nextSerial(d, start);
                                    // The start no longer decides the next number once serials at or above it are taken.
                                    const passed = start > 1 && next !== start;
                                    const error = errors[`starts.${d.key}`];

                                    return (
                                        <tr key={d.key} className="align-top">
                                            <td className="px-6 py-4 font-medium text-gray-800 dark:text-gray-100">{d.label}</td>
                                            <td className="px-6 py-4 font-mono text-gray-600 dark:text-gray-300">
                                                {d.lastSerial ? serial(d.lastSerial) : <span className="font-sans text-gray-400">None yet</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={maxSerial}
                                                    placeholder="1"
                                                    aria-label={`${d.label} starting number`}
                                                    value={data.starts[d.key]}
                                                    onChange={(e) => setData('starts', { ...data.starts, [d.key]: e.target.value })}
                                                    className={field}
                                                />
                                                {error && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
                                                {passed && (
                                                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                                        Already in use; the next free number is shown on the right.
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-mono font-semibold text-indigo-700 dark:text-indigo-300">
                                                {year}-{month}-{serial(next)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </section>

                    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 bg-gray-100/95 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:mx-0 sm:rounded-b-lg">
                        {isDirty && (
                            <span className="mr-auto text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>
                        )}
                        <SecondaryButton onClick={() => reset()} disabled={processing || !isDirty}>
                            Discard
                        </SecondaryButton>
                        <PrimaryButton type="submit" disabled={processing || !isDirty}>
                            {processing ? 'Saving…' : `Save ${year} numbering`}
                        </PrimaryButton>
                    </div>
                </div>
            </form>
        </AuthenticatedLayout>
    );
}

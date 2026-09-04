import { Link } from '@inertiajs/react';

// Worth moving to @/Components/StatusBadge.jsx once your PR listing pages
// need it too — the status map should exist in exactly one place.
const STATUS_META = {
    0: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50' },
    100: { label: 'Verified', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800/50' },
    200: { label: 'Canvassing', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50' },
    201: { label: 'Re-canvassing', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50' },
    202: { label: 'Start canvassing', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50' },
    203: { label: 'End canvassing', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800/50' },
    300: { label: 'Completed', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50' },
    400: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50' },
};

const StatusBadge = ({ status }) => {
    const meta = STATUS_META[status] ?? {
        label: status,
        className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
    };

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
        >
            {meta.label}
        </span>
    );
};

export default function PrTable({ data = [], title, emptyLabel, viewMoreHref }) {
    const rows = data ?? [];

    return (
        <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-100 p-6 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>

                {rows.length > 0 && viewMoreHref && (
                    <Link
                        href={viewMoreHref}
                        className="rounded-md text-sm font-medium text-indigo-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-indigo-400 dark:focus-visible:ring-offset-gray-800"
                    >
                        View all
                    </Link>
                )}
            </div>

            {/* Scrolls instead of fading out under a gradient — the old version
                clipped rows with no way to reach them. */}
            <div className="max-h-[340px] overflow-auto">
                <table className="w-full border-collapse text-left text-sm text-gray-600 dark:text-gray-300">
                    <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    <tr>
                        <th scope="col" className="px-6 py-3 font-semibold">PR#</th>
                        <th scope="col" className="px-6 py-3 font-semibold">Requester</th>
                        <th scope="col" className="px-6 py-3 font-semibold">Status</th>
                        <th scope="col" className="px-6 py-3 font-semibold">Dept</th>
                        <th scope="col" className="px-6 py-3 font-semibold">Date</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {rows.length > 0 ? (
                        rows.map((pr, index) => (
                            <tr
                                key={pr.pr_num ?? index}
                                className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-700/20"
                            >
                                <td className="px-6 py-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                                    {pr.pr_num}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                    {pr.requester}
                                </td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={pr.status} />
                                </td>
                                <td className="px-6 py-4">{pr.dept}</td>
                                <td className="whitespace-nowrap px-6 py-4 text-gray-500 dark:text-gray-400">
                                    {pr.date ?? '—'}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-10 text-center text-gray-400">
                                {emptyLabel}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

import { Link } from '@inertiajs/react';
import { ArrowUpRight, CircleAlert } from 'lucide-react';
import InfoHint from '@/Components/InfoHint.jsx';

/**
 * `data` is an array so the backend picks which counters matter for the role:
 *   [{ label: 'Waiting for verification', value: 12, href: '/purchase-requests', tone: 'attention' }, ...]
 * A tile with an `href` opens the module where that work is done. A tile whose
 * tone is 'attention' or 'warning' has work waiting and is marked so it stands out.
 */
export default function StatCards({ data = [] }) {
    if (!data.length) return null;

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.map((stat) => {
                const needsAttention = stat.tone === 'attention' || stat.tone === 'warning';

                const tile = (
                    <div
                        className={`group relative flex h-full flex-col rounded-xl border bg-white px-5 py-4 shadow-sm transition-colors dark:bg-gray-800 ${
                            needsAttention
                                ? 'border-amber-200 dark:border-amber-500/30'
                                : 'border-gray-100 dark:border-gray-700/60'
                        } ${stat.href ? 'hover:border-indigo-200 dark:hover:border-indigo-500/40' : ''}`}
                    >
                        {needsAttention && (
                            <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-amber-400" />
                        )}
                        <div className="flex items-start justify-between gap-2">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                                <span>{stat.label}</span>
                                <InfoHint text={stat.info} label={`What "${stat.label}" counts`} />
                            </p>
                            {stat.href && (
                                <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-indigo-500 dark:text-gray-600" />
                            )}
                        </div>
                        <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white">
                            {(stat.value ?? 0).toLocaleString()}
                        </p>
                        {needsAttention && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                <CircleAlert className="h-3 w-3" />
                                Needs action
                            </p>
                        )}
                    </div>
                );

                return stat.href ? (
                    <Link
                        key={stat.label}
                        href={stat.href}
                        className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                    >
                        {tile}
                    </Link>
                ) : (
                    <div key={stat.label}>{tile}</div>
                );
            })}
        </div>
    );
}

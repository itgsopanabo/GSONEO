import { Link } from '@inertiajs/react';
import { CheckCircle2, ChevronRight, CircleAlert, Lock } from 'lucide-react';
import { getStatusConfig } from '@/Constants/statusConfig.js';
import { parseDate } from '@/Utils/formatDate.js';
import { TagChip } from '@/Components/MissingTags.jsx';
import DashboardCard from './DashboardCard';

function daysOpen(value) {
    const date = parseDate(value);
    return date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000)) : 0;
}

/** Same scale as the Missing Tracker page: a week is worth a look, two weeks is overdue. */
function ageStyle(days) {
    if (days >= 14) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    if (days >= 7) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300';
}

/**
 * What orders are still missing: the count, how many orders it holds up, and
 * the tags waiting longest. `data` = { open, held_orders, href, rows: [...] }.
 */
export default function MissingTrackerWidget({ data, info }) {
    const rows = data?.rows ?? [];
    const open = data?.open ?? 0;
    const held = data?.held_orders ?? 0;

    return (
        <DashboardCard
            title="Missing on orders"
            info={info}
            icon={CircleAlert}
            subtitle={open > 0 ? `${open} open · ${held} ${held === 1 ? 'order' : 'orders'} on hold` : 'Nothing open'}
            href={data?.href}
            hrefLabel="Missing Tracker"
        >
            {rows.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                    <CheckCircle2 className="mb-2 h-7 w-7 text-emerald-400" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">Every order has what it needs.</p>
                </div>
            ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {rows.map((row) => {
                        const days = daysOpen(row.date);
                        const body = (
                            <>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <TagChip tag={row.tag} />
                                        <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">{row.number}</span>
                                    </div>
                                    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                        {[getStatusConfig(row.status).label, row.dept, row.note].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${ageStyle(days)}`}>
                                    {days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`}
                                </span>
                                {row.href && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-indigo-500 dark:text-gray-600" />}
                            </>
                        );

                        return (
                            <li key={row.id}>
                                {row.href ? (
                                    <Link
                                        href={row.href}
                                        className="group flex items-center gap-3 px-5 py-3 hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 dark:hover:bg-gray-700/30 dark:focus-visible:bg-gray-700/30"
                                    >
                                        {body}
                                    </Link>
                                ) : (
                                    <div className="flex items-center gap-3 px-5 py-3">{body}</div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {held > 0 && (
                <p className="flex items-center gap-1.5 border-t border-gray-100 px-5 py-2.5 text-[11px] text-amber-700 dark:border-gray-700/60 dark:text-amber-400">
                    <Lock className="h-3 w-3" />
                    {held} {held === 1 ? 'order is' : 'orders are'} held at their stage until the locked tags are resolved.
                </p>
            )}
        </DashboardCard>
    );
}

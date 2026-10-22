import { Link } from '@inertiajs/react';
import { ChevronRight, Inbox } from 'lucide-react';
import { getStatusConfig } from '@/Constants/statusConfig.js';
import { formatDate, parseDate } from '@/Utils/formatDate.js';
import DashboardCard from './DashboardCard';

const BADGE_TONES = {
    critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
};

function Badge({ row }) {
    const { label, style } = row.badge
        ? { label: row.badge.label, style: BADGE_TONES[row.badge.tone] ?? BADGE_TONES.warning }
        : getStatusConfig(row.status);

    return (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${style}`}>
            {label}
        </span>
    );
}

/** Whole days since a past date, or null for today and future dates. */
function daysWaiting(value) {
    const date = parseDate(value);
    if (!date) return null;
    const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    return days < 1 ? null : days;
}

/** A week waiting is worth a look; two weeks is overdue. Same scale as the Missing Tracker. */
function ageStyle(days) {
    if (days >= 14) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    if (days >= 7) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300';
}

/**
 * A short list of work waiting at one stage, longest-waiting first.
 *
 * `data` = { total, href, rows: [{ id, number, secondary?, dept, status | badge, date, href? }] }
 * A row with an `href` opens that record directly.
 */
export default function WorkQueue({
    data,
    title,
    info,
    emptyLabel = 'Nothing waiting.',
    numberLabel = 'Reference',
    dateLabel = 'Waiting since',
    showAge = true,
}) {
    const rows = data?.rows ?? [];
    const total = data?.total ?? rows.length;

    return (
        <DashboardCard
            title={title}
            info={info}
            subtitle={total > rows.length ? `Showing the ${rows.length} waiting longest of ${total.toLocaleString()}` : undefined}
            href={total > 0 ? data?.href : undefined}
            aside={
                <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${total > 0 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
                >
                    {total.toLocaleString()}
                </span>
            }
        >
            {rows.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                    <Inbox className="mb-2 h-7 w-7 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">{emptyLabel}</p>
                </div>
            ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {rows.map((row) => {
                        const days = showAge ? daysWaiting(row.date) : null;
                        const body = (
                            <>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                                            <span className="sr-only">{numberLabel}: </span>
                                            {row.number}
                                        </span>
                                        <Badge row={row} />
                                    </div>
                                    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                        {[row.secondary, row.dept].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    {days !== null ? (
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${ageStyle(days)}`}>
                                            {days} day{days === 1 ? '' : 's'}
                                        </span>
                                    ) : null}
                                    <p className="mt-0.5 text-[11px] text-gray-400">
                                        <span className="sr-only">{dateLabel}: </span>
                                        {formatDate(row.date)}
                                    </p>
                                </div>
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
        </DashboardCard>
    );
}

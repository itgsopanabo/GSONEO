import { History } from 'lucide-react';
import { formatDateTime, parseDate } from '@/Utils/formatDate.js';
import DashboardCard from './DashboardCard';

/** "just now", "12m ago", "3h ago", "yesterday", or the date. */
function relativeTime(value) {
    const date = parseDate(value);
    if (!date) return '';
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    if (hours < 48) return 'yesterday';
    return formatDateTime(value);
}

function initialsOf(name) {
    return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

/** The latest changes recorded in the audit log (page views are left out). */
export default function RecentActivity({ data, info }) {
    const rows = data?.rows ?? [];

    return (
        <DashboardCard
            title="Recent activity"
            info={info}
            icon={History}
            subtitle="Latest changes across the system"
            href={data?.href}
            hrefLabel="Audit trail"
        >
            {rows.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-gray-400">No activity recorded yet.</p>
            ) : (
                <ol className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {rows.map((row) => (
                        <li key={row.id} className="flex gap-3 px-5 py-3">
                            <span
                                aria-hidden="true"
                                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            >
                                {initialsOf(row.user)}
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-800 dark:text-gray-200">{row.description || row.action}</p>
                                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                    {row.user}
                                    {' · '}
                                    <time dateTime={row.date} title={formatDateTime(row.date)}>{relativeTime(row.date)}</time>
                                </p>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </DashboardCard>
    );
}

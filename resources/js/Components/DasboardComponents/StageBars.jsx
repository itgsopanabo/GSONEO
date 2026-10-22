import DashboardCard from './DashboardCard';

/**
 * Horizontal bars for counts per stage or per category — one hue, because the
 * job is comparing magnitude, not telling series apart. Every bar carries its
 * label and value as text, so the list doubles as the table view.
 *
 * `data` is either an array of { label, value } or { stages, rejected?, href? }.
 */
export default function StageBars({ data, title, subtitle, info, unit = 'request', emptyLabel = 'Nothing to show yet.' }) {
    const rows = Array.isArray(data) ? data : (data?.stages ?? []);
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    const max = Math.max(1, ...rows.map((row) => row.value));
    const plural = (n) => `${n.toLocaleString()} ${unit}${n === 1 ? '' : 's'}`;

    return (
        <DashboardCard
            title={title}
            info={info}
            subtitle={subtitle ?? `${plural(total)} in total`}
            href={Array.isArray(data) ? undefined : data?.href}
            hrefLabel="Open monitoring"
        >
            {total === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-gray-400">{emptyLabel}</p>
            ) : (
                <ul className="space-y-1 px-6 py-5">
                    {rows.map((row) => {
                        const share = total ? Math.round((row.value / total) * 100) : 0;
                        const tooltip = `${row.label}: ${plural(row.value)} (${share}%)`;

                        return (
                            <li
                                key={row.label}
                                tabIndex={0}
                                aria-label={tooltip}
                                className="group relative grid grid-cols-[minmax(0,9.5rem)_1fr_3rem] items-center gap-3 rounded-md px-2 py-1.5 outline-none hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-700/40"
                            >
                                <span className="truncate text-sm text-gray-600 dark:text-gray-300" title={row.label}>
                                    {row.label}
                                </span>

                                <span className="flex h-6 items-center border-l border-gray-300 dark:border-gray-600">
                                    {row.value > 0 && (
                                        <span
                                            className="block h-3 rounded-r-[4px] bg-[#2a78d6] dark:bg-[#3987e5]"
                                            style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
                                        />
                                    )}
                                </span>

                                <span
                                    className={`text-right text-sm tabular-nums ${row.value > 0 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}
                                >
                                    {row.value.toLocaleString()}
                                </span>

                                <span
                                    role="tooltip"
                                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus-visible:block dark:bg-gray-100 dark:text-gray-900"
                                >
                                    {tooltip}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {!Array.isArray(data) && data?.rejected > 0 && (
                <p className="border-t border-gray-100 px-6 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Not counted above: {plural(data.rejected)} rejected.
                </p>
            )}
        </DashboardCard>
    );
}

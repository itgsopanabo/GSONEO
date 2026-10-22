import { formatMonth } from '@/Utils/formatDate.js';
import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import DashboardCard from './DashboardCard';

/**
 * Series colors follow the series (requests are always blue, orders always
 * orange), never their position, so a role with one series keeps its color.
 * Light and dark steps validated against white and gray-800 cards.
 */
const SERIES_COLORS = {
    requests: { light: '#2a78d6', dark: '#3987e5' },
    orders: { light: '#eb6834', dark: '#d95926' },
};

const CHROME = {
    light: { grid: '#e5e7eb', axis: '#6b7280', ink: '#111827', cursor: '#9ca3af', surface: '#ffffff' },
    dark: { grid: '#374151', axis: '#9ca3af', ink: '#f3f4f6', cursor: '#6b7280', surface: '#1f2937' },
};

/**
 * Tailwind uses class-based dark mode (`.dark` on <html>), which the app
 * currently never sets, so charts stay light. Watching the class keeps the
 * chart in step if a theme toggle is added later.
 */
function useDarkMode() {
    const read = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const [dark, setDark] = useState(read);

    useEffect(() => {
        const observer = new MutationObserver(() => setDark(read()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    return dark;
}

function LineKey({ color }) {
    return <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />;
}

function TrendTooltip({ active, payload, label, series, colorOf }) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-900">
            <p className="mb-1 text-gray-500 dark:text-gray-400">{formatMonth(label)}</p>
            {series.map((s) => (
                <p key={s.key} className="flex items-center gap-2">
                    <LineKey color={colorOf(s.key)} />
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {(payload.find((p) => p.dataKey === s.key)?.value ?? 0).toLocaleString()}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">{s.label}</span>
                </p>
            ))}
        </div>
    );
}

/**
 * Transactions per month as a line per series, on one shared count axis.
 *
 * `data` = { months: ['2025-10', ...], series: [{ key, label, values: [..] }] }
 */
export default function MonthlyTrend({ data, info }) {
    const dark = useDarkMode();
    const chrome = dark ? CHROME.dark : CHROME.light;
    const colorOf = (key) => (SERIES_COLORS[key] ?? SERIES_COLORS.requests)[dark ? 'dark' : 'light'];
    const [showTable, setShowTable] = useState(false);

    const months = data?.months ?? [];
    const series = data?.series ?? [];
    const rows = useMemo(
        () => months.map((month, i) => Object.fromEntries([['month', month], ...series.map((s) => [s.key, s.values[i] ?? 0])])),
        [months, series],
    );
    const total = series.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0);
    const lastIndex = rows.length - 1;

    // The value at the end of each line, in ink rather than the series color.
    const endLabel = (props) => {
        if (props.index !== lastIndex) return null;
        return (
            <text x={props.x + 8} y={props.y} dy={4} fill={chrome.ink} fontSize={12} fontWeight={600}>
                {Number(props.value).toLocaleString()}
            </text>
        );
    };

    return (
        <DashboardCard
            title="Transactions per month"
            info={info}
            subtitle={[
                // With a single line there's no legend, so the subtitle names what it counts.
                series.length === 1 ? series[0].label : null,
                months.length ? `${formatMonth(months[0])} – ${formatMonth(months[lastIndex])}` : null,
            ].filter(Boolean).join(' · ')}
            aside={
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {series.length > 1 &&
                        series.map((s) => (
                            <span key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                                <LineKey color={colorOf(s.key)} />
                                {s.label}
                            </span>
                        ))}
                    <button
                        type="button"
                        onClick={() => setShowTable((v) => !v)}
                        aria-pressed={showTable}
                        className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        {showTable ? 'Show chart' : 'Show table'}
                    </button>
                </div>
            }
        >
            {total === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-gray-400">No transactions in the last 12 months.</p>
            ) : showTable ? (
                <div className="overflow-x-auto px-6 py-4">
                    <table className="w-full text-left text-sm">
                        <thead className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            <tr>
                                <th scope="col" className="py-2 pr-4 font-semibold">Month</th>
                                {series.map((s) => (
                                    <th key={s.key} scope="col" className="py-2 pl-4 text-right font-semibold">{s.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {rows.map((row) => (
                                <tr key={row.month}>
                                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatMonth(row.month)}</td>
                                    {series.map((s) => (
                                        <td key={s.key} className="py-2 pl-4 text-right tabular-nums text-gray-900 dark:text-gray-100">
                                            {row[s.key].toLocaleString()}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="px-2 pb-4 pt-6 sm:px-4">
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={rows} margin={{ top: 8, right: 40, bottom: 0, left: 0 }}>
                            <CartesianGrid vertical={false} stroke={chrome.grid} strokeWidth={1} />
                            <XAxis
                                dataKey="month"
                                tickFormatter={(month, i) => formatMonth(month, { year: i === 0 || month.endsWith('-01') })}
                                tick={{ fill: chrome.axis, fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: chrome.grid }}
                                interval="preserveStartEnd"
                                minTickGap={12}
                            />
                            <YAxis
                                allowDecimals={false}
                                tick={{ fill: chrome.axis, fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                                width={40}
                            />
                            <Tooltip
                                cursor={{ stroke: chrome.cursor, strokeWidth: 1 }}
                                content={<TrendTooltip series={series} colorOf={colorOf} />}
                            />
                            {series.map((s) => (
                                <Line
                                    key={s.key}
                                    type="monotone"
                                    dataKey={s.key}
                                    name={s.label}
                                    stroke={colorOf(s.key)}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    dot={false}
                                    activeDot={{ r: 5, fill: colorOf(s.key), stroke: chrome.surface, strokeWidth: 2 }}
                                    label={endLabel}
                                    isAnimationActive={false}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </DashboardCard>
    );
}

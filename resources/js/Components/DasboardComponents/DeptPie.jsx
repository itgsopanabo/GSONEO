import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const DEPT_COLORS = [
    '#6366f1',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#0ea5e9',
    '#a855f7',
    '#14b8a6',
    '#ec4899',
];

export default function DeptPie({ data = [] }) {
    const rows = data ?? [];

    return (
        <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg dark:bg-gray-800">
            <div className="border-b border-gray-100 p-6 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Requests per department
                </h3>
            </div>

            <div className="p-6">
                {rows.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                            <Pie
                                data={rows}
                                dataKey="total"
                                nameKey="dept"
                                cx="50%"
                                cy="50%"
                                outerRadius={110}
                                /* Labels are hidden below 8% — on a busy month they
                                   overlap into an unreadable ring otherwise. */
                                label={({ dept, percent }) =>
                                    percent >= 0.08 ? `${dept} ${(percent * 100).toFixed(0)}%` : ''
                                }
                            >
                                {rows.map((entry, index) => (
                                    <Cell
                                        key={entry.dept ?? index}
                                        fill={DEPT_COLORS[index % DEPT_COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="py-8 text-center text-sm text-gray-400">
                        No department data yet.
                    </p>
                )}
            </div>
        </div>
    );
}

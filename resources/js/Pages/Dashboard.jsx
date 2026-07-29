import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {Head, usePage} from '@inertiajs/react';
import {useState, useEffect} from 'react';
import MetricCard from "@/Components/MetricCard.jsx";
import {PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer} from 'recharts';

const DEPT_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7', '#14b8a6', '#ec4899'];

const STATUS_META = {
    0: {
        label: 'Pending',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
    }, 100: {
        label: 'Verified',
        className: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
    }, 200: {
        label: 'Canvassing',
        className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
    }, 201: {
        label: 'Re-Canvassing',
        className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
    }, 202: {
        label: 'Start Canvassing',
        className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
    }, 203: {
        label: 'End Canvassing',
        className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50'
    }, 300: {
        label: 'Completed',
        className: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 dark:border-green-800/50'
    }, 400: {
        label: 'Rejected',
        className: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800/50'
    },
};

const StatusBadge = ({status}) => {
    const meta = STATUS_META[status] ?? {label: status, className: 'bg-gray-100 text-gray-800'};
    return (<span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}>
            {meta.label}
        </span>);
};

// Reusable PR table used for both "Recent Purchase Requests" and "Verified by You"
const PrTable = ({title, rows, emptyLabel, viewMoreHref}) => {
    const hasRows = rows && rows.length > 0;

    return (<div className="overflow-hidden bg-white shadow-sm sm:rounded-lg dark:bg-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    {title}
                </h3>
            </div>

            <div className="relative max-h-[320px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm text-gray-600 dark:text-gray-300">
                        <thead
                            className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-400 sticky top-0 backdrop-blur-sm z-10">
                        <tr>
                            <th className="px-6 py-3 font-semibold">PR#</th>
                            <th className="px-6 py-3 font-semibold">Name of Requester</th>
                            <th className="px-6 py-3 font-semibold">Status</th>
                            <th className="px-6 py-3 font-semibold">Dept</th>
                            <th className="px-6 py-3 font-semibold">Date</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {hasRows ? rows.map((pr, index) => (<tr key={pr.pr_num ?? index}
                                                                className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                                <td className="px-6 py-4 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                                    {pr.pr_num}
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                                    {pr.requester}
                                </td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={pr.status}/>
                                </td>
                                <td className="px-6 py-4">
                                    {pr.dept}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                    {pr.date ?? '—'}
                                </td>
                            </tr>)) : (<tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                    {emptyLabel}
                                </td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>

                {hasRows && (<>
                        <div
                            className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white via-white/90 to-transparent dark:from-gray-800 dark:via-gray-800/90 pointer-events-none z-10"/>

                        <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
                            {/* TODO: replace href with your real PR Monitoring route */}
                            <a
                                href={viewMoreHref}
                                className="px-4 py-2 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-md shadow-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                View More Requests
                            </a>
                        </div>
                    </>)}
            </div>
        </div>);
};

// Pie chart of PR count per department
const DeptPieChart = ({data}) => {
    const hasData = data && data.length > 0;

    return (<div className="overflow-hidden bg-white shadow-sm sm:rounded-lg dark:bg-gray-800">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Requests per Department
                </h3>
            </div>

            <div className="p-6">
                {hasData ? (<ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="total"
                                nameKey="dept"
                                cx="50%"
                                cy="50%"
                                outerRadius={110}
                                label={({dept, percent}) => `${dept} (${(percent * 100).toFixed(0)}%)`}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={entry.dept ?? index} fill={DEPT_COLORS[index % DEPT_COLORS.length]}/>))}
                            </Pie>
                            <Tooltip/>
                            <Legend/>
                        </PieChart>
                    </ResponsiveContainer>) : (
                    <p className="text-center text-gray-400 py-8">No department data yet.</p>)}
            </div>
        </div>);
};

export default function Dashboard({
                                      purchaseRequests = [],
                                      verifiedByMe = [],
                                      requestsByDept = [],
                                      stats = {totalReceived: 0, pending: 0, verified: 0, verifiedByMeCount: 0},
                                  }) {
    const {auth} = usePage().props;

    const ClockIcon = (props) => (<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>);

    // Live Time and Date State (this part stays client-side, it's not "data" from the DB)
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (<AuthenticatedLayout>
            <Head title="Dashboard"/>

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8 space-y-6">

                    {/* Widgets Grid */}
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {/* Welcome Card */}
                        <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg dark:bg-gray-800">
                            <div className="p-6 text-gray-900 dark:text-gray-100">
                                <h3 className="text-lg font-medium">
                                    Welcome back, <span
                                    className="font-bold text-indigo-600 dark:text-indigo-400">{auth.user.emp_lname}, {auth.user.emp_fname}</span>!
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Employee ID: {auth.user.emp_id}
                                </p>
                                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                    Assigned Role: <span className="font-semibold text-gray-800 dark:text-gray-200">
                                        {auth.user.role.role_name ?? 'No Role Assigned'} ({auth.user.role?.section ?? 'No Role Assigned'})
                                    </span>
                                </p>
                            </div>
                        </div>

                        {/* Live Clock Card */}
                        <MetricCard
                            title="Current Time"
                            value={currentTime.toLocaleTimeString('en-US', {
                                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                            })}
                            description={currentTime.toLocaleDateString('en-US', {
                                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                            })}
                            icon={ClockIcon}
                        />
                    </div>

                    {/* PR Counter Metric Cards - now driven by real DB counts */}
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-4">
                        <MetricCard title='Total Received PR' value={stats.totalReceived}/>
                        <MetricCard title='Pending PR' value={stats.pending}/>
                        <MetricCard title='Verified PR' value={stats.verified}/>
                        <MetricCard title='Verified by You' value={stats.verifiedByMeCount}/>
                    </div>

                    {/* PR distribution by department */}
                    <DeptPieChart data={requestsByDept}/>

                    {/* Recent Purchase Requests (all PRs, most recent first) */}
                    <PrTable
                        title="Recent Purchase Requests"
                        rows={purchaseRequests}
                        emptyLabel="No purchase requests yet."
                        viewMoreHref="/purchase-requests"
                    />

                    {/* PRs verified by the currently logged-in employee */}
                    <PrTable
                        title="Verified by You"
                        rows={verifiedByMe}
                        emptyLabel="You haven't verified any requests yet."
                        viewMoreHref="/pr-monitoring?verified_by=me"
                    />

                </div>
            </div>
        </AuthenticatedLayout>);
}

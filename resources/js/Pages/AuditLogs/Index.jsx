import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import { Head, Link } from '@inertiajs/react';
import { useState } from 'react';

export default function Index({ logs }) {
    const [selectedJson, setSelectedJson] = useState(null);

    // Dynamic helper to format specific action labels into badges
    const getBadgeClass = (action) => {
        switch (action) {
            case 'created':
            case 'verified':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'updated':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'deleted':
            case 'declined':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            default:
                return 'bg-blue-50 text-blue-700 border-blue-200';
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Audit Logs" />

            <div className="py-12 bg-slate-50 min-h-screen">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">

                    {/* Header Summary section */}
                    <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Audit Logs</h1>
                            <p className="text-sm text-slate-500 mt-1">Track actions, state alterations, and chronological resource changes across the application.</p>
                        </div>
                    </div>

                    {/* Main Table Content Container */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm text-slate-600">
                                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Timestamp</th>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Action</th>
                                    <th className="px-6 py-4">Target Resource</th>
                                    <th className="px-6 py-4">Description</th>
                                    <th className="px-6 py-4">State Diff</th>
                                    <th className="px-6 py-4">Context</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                {logs.data && logs.data.length > 0 ? (
                                    logs.data.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                                            {/* Timestamp */}
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                                                {new Date(log.created_at).toLocaleString()}
                                            </td>

                                            {/* User Info */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-semibold text-slate-900">
                                                    {log.user ? log.user.name : 'System / Automated'}
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono">
                                                    {log.user ? `ID: ${log.user_id}` : 'cron-job'}
                                                </div>
                                            </td>

                                            {/* Action type badge */}
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border uppercase tracking-wider ${getBadgeClass(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>

                                            {/* Polymorphic target */}
                                            <td className="px-6 py-4 whitespace-nowrap text-xs">
                                                {log.auditable_type ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-slate-400 font-medium">
                                                            {log.auditable_type.split('\\').pop()}
                                                        </span>
                                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 self-start border border-slate-200">
                                                            {log.auditable_id}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">Global System Context</span>
                                                )}
                                            </td>

                                            {/* Human Readable Summary Description */}
                                            <td className="px-6 py-4 max-w-xs truncate text-slate-700" title={log.description}>
                                                {log.description}
                                            </td>

                                            {/* Changes Diff Payload */}
                                            <td className="px-6 py-4 whitespace-nowrap space-x-2.5">
                                                {log.old_values && (
                                                    <button
                                                        onClick={() => setSelectedJson({ title: 'Previous Record State (Old Values)', data: log.old_values })}
                                                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 transition-colors underline bg-transparent border-none cursor-pointer"
                                                    >
                                                        Before
                                                    </button>
                                                )}
                                                {log.new_values && (
                                                    <button
                                                        onClick={() => setSelectedJson({ title: 'Modified Record State (New Values)', data: log.new_values })}
                                                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-900 transition-colors underline bg-transparent border-none cursor-pointer"
                                                    >
                                                        After
                                                    </button>
                                                )}
                                                {!log.old_values && !log.new_values && (
                                                    <span className="text-slate-300 font-mono">—</span>
                                                )}
                                            </td>

                                            {/* Client Context IP / UserAgent */}
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                                                <span className="block font-mono font-medium text-slate-500">{log.ip_address || '0.0.0.0'}</span>
                                                <span className="block max-w-[140px] truncate mt-0.5" title={log.user_agent}>
                                                    {log.user_agent}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-slate-400 italic">
                                            No tracking entries found in audit history logs.
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Section */}
                        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50">
                            <div className="text-xs font-medium text-slate-500">
                                Showing <span className="font-semibold text-slate-700">{logs.from || 0}</span> to <span className="font-semibold text-slate-700">{logs.to || 0}</span> of <span className="font-semibold text-slate-700">{logs.total}</span> audit records
                            </div>
                            <div className="flex items-center gap-1">
                                {logs.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url || '#'}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all border ${
                                            link.active
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                                : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                                        } ${!link.url ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal JSON payload view inspector backdrop */}
            {selectedJson && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-opacity">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h3 className="text-sm font-bold text-slate-800 tracking-wide uppercase">{selectedJson.title}</h3>
                            <button
                                onClick={() => setSelectedJson(null)}
                                className="text-slate-400 hover:text-slate-600 font-medium text-2xl leading-none transition-colors"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto bg-slate-950 text-slate-300 font-mono text-xs rounded-b-xl border-t border-slate-800 shadow-inner">
                            <pre className="whitespace-pre-wrap">{JSON.stringify(selectedJson.data, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {Head, Link} from '@inertiajs/react';
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {useMemo, useState} from "react";
import {FileText, Search} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'});
}

export default function Index({purchaseOrders}) {
    const [search, setSearch] = useState('');

    const rows = useMemo(() => purchaseOrders?.data ?? [], [purchaseOrders]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((po) => String(po.PO_Number ?? '').toLowerCase().includes(q));
    }, [rows, search]);

    return (
        <AuthenticatedLayout>
            <Head title="Requisition and Issue Slip"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Requisition &amp; Issue Slip
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {purchaseOrders?.total ?? rows.length} {(purchaseOrders?.total ?? rows.length) === 1 ? 'slip' : 'slips'} on record.
                        </p>
                    </div>
                    {/* Uncomment when ready
                    <Link
                        href={route('purchase-orders.create')}
                        className="inline-flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                    >
                        New Purchase Order
                    </Link>
                    */}
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm overflow-hidden">
                    {/* Search */}
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search PO number..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-700/40 bg-gray-50 dark:bg-gray-900/30">
                                <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    PO #
                                </th>
                                <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Date Created
                                </th>
                                <th className="px-5 py-2.5"></th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                            {filteredRows.map((po) => (
                                <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                    <td className="px-5 py-3.5 text-xs font-semibold text-gray-900 dark:text-white font-mono">
                                        {po.PO_Number ?? '—'}
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[po.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                            <span className="w-1 h-1 rounded-full bg-current"></span>
                                            {STATUS_MAP[po.status]?.label || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs text-gray-500 dark:text-gray-400">
                                        {formatDate(po.created_at)}
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        <Link
                                            href={route('ris.show', po.id)}
                                            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                                        >
                                            View &rarr;
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {filteredRows.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-16 text-center">
                                        <FileText className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                            {search ? 'No slips found' : 'No purchase orders found'}
                                        </p>
                                        <p className="mt-1 text-[11px] text-gray-500">
                                            {search ? 'Try a different search.' : 'New slips will appear here once created.'}
                                        </p>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {purchaseOrders?.links && purchaseOrders.links.length > 3 && (
                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-center gap-1">
                            {purchaseOrders.links.map((link, index) => (
                                <Link
                                    key={index}
                                    href={link.url || '#'}
                                    dangerouslySetInnerHTML={{__html: link.label}}
                                    className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${link.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/40'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

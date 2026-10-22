import {Head, Link, router, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {formatDate} from "@/Utils/formatDate.js";
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {useEffect, useMemo, useState} from "react";
import {Search, PanelRightClose, PanelRightOpen, FileText, Plus} from "lucide-react";
import ItemDescription from "@/Components/ItemDescripiton.jsx";

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
}

function formatCurrency(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return `₱${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

// total_estimated_cost is the line total, so the grand total is a plain sum.
function grandTotal(items = []) {
    return items.reduce((sum, item) => sum + Number(item.total_estimated_cost || 0), 0);
}

export default function Index({purchaseRequests}) {
    const requests = purchaseRequests?.data || [];
    const {flash} = usePage().props;

    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(requests[0]?.id ?? null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
    const [notice, setNotice] = useState(null);

    // Held locally so the 5s poll re-sharing props can't resurrect a dismissed banner.
    useEffect(() => {
        if (!flash?.success) return;
        setNotice(flash.success);
        const timer = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(timer);
    }, [flash?.success]);

    // Keep the queue fresh while an encoder sits on the page.
    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({only: ['purchaseRequests'], preserveScroll: true, preserveState: true});
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // Keep a valid selection as the polled list changes.
    useEffect(() => {
        if (requests.length === 0) {
            setSelectedId(null);
            return;
        }
        if (!requests.some(r => r.id === selectedId)) {
            setSelectedId(requests[0].id);
        }
    }, [requests, selectedId]);

    const filteredRequests = useMemo(() => {
        if (!search.trim()) return requests;
        const q = search.trim().toLowerCase();
        return requests.filter(pr => pr.pr_number?.toLowerCase().includes(q) || pr.requester_department?.toLowerCase().includes(q));
    }, [requests, search]);

    const selected = requests.find(r => r.id === selectedId) || null;
    const isPaginated = (purchaseRequests?.links?.length ?? 0) > 3;
    const itemCount = selected?.items?.length ?? 0;

    return (<AuthenticatedLayout>
        <Head title="Encoding - Purchase Requests"/>

        <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                        Encoding
                    </h1>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Encode incoming purchase requests into the procurement system.
                    </p>
                </div>
            </div>

            {/* Master-detail layout */}
            <div
                className={`grid grid-cols-1 gap-6 h-[calc(100vh-220px)] min-h-[560px] transition-[grid-template-columns] duration-300 ease-in-out ${isPanelCollapsed ? 'lg:grid-cols-[1fr_56px]' : 'lg:grid-cols-[360px_1fr]'}`}
            >
                {/* Left: Encoding queue */}
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden">
                    <div
                        className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">To Encode</h2>
                        <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {requests.length} Waiting
                        </span>
                    </div>

                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search PR number, department..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                        </div>
                        {search.trim() && isPaginated && (
                            <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-400">
                                Searching this page only.
                            </p>)}
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                        {filteredRequests.length > 0 ? filteredRequests.map((pr) => {
                            const isActive = pr.id === selectedId;
                            return (<button
                                key={pr.id}
                                onClick={() => {
                                    setSelectedId(pr.id);
                                    if (isPanelCollapsed) setIsPanelCollapsed(false);
                                }}
                                className={`w-full text-left px-4 py-3.5 transition-colors border-l-2 ${isActive ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-600' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/20'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span
                                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                        {pr.pr_number}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {formatRelativeTime(pr.created_at)}
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                    {pr.requester_department || 'No department'}
                                </p>
                                <div className="mt-1.5 flex items-center gap-2">
                                    {pr.items != null && (
                                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                                            {formatCurrency(grandTotal(pr.items))}
                                        </span>)}
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[pr.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                        <span className="w-1 h-1 rounded-full bg-current"></span>
                                        {STATUS_MAP[pr.status]?.label || 'Unknown'}
                                    </span>
                                </div>
                                {pr.remarks_or_notes && (
                                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                        {pr.remarks_or_notes}
                                    </p>)}
                            </button>);
                        }) : (<div className="px-6 py-16 text-center">
                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                                {search.trim() ? 'No requests found' : 'Nothing to encode'}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-500">
                                {search.trim() ? (isPaginated ? 'Nothing on this page matches. Try another page or a different search.' : 'Try a different search.') : 'New requests will appear here, or start one yourself.'}
                            </p>

                        </div>)}
                    </div>

                    {isPaginated && (<div
                        className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-center gap-1">
                        {purchaseRequests.links.map((link, index) => (<Link
                            key={index}
                            href={link.url || '#'}
                            dangerouslySetInnerHTML={{__html: link.label}}
                            className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${link.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />))}
                    </div>)}
                </div>

                {/* Right: Detail panel */}
                {isPanelCollapsed ? (<div
                    className="hidden lg:flex bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex-col items-center py-4">
                    <button
                        onClick={() => setIsPanelCollapsed(false)}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                        title="Expand details panel"
                    >
                        <PanelRightOpen className="w-4 h-4"/>
                    </button>
                </div>) : (<div
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden">
                    {!selected ? (<div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">No request selected</p>
                            <p className="mt-1 text-xs text-gray-500">Choose a request from the queue to encode it.</p>
                        </div>
                    </div>) : (<>
                        {/* Header */}
                        <div
                            className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {selected.pr_number || selected.requester_department || 'Purchase Request'}
                                </h2>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsPanelCollapsed(true)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors hidden lg:inline-flex"
                                    title="Collapse panel">
                                    <PanelRightClose className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div
                                    className="md:col-span-3 border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                        Request Summary
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                Department
                                            </p>
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                {selected.requester_department || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                Date Created
                                            </p>
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                {formatDate(selected.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            Purpose/Reason:
                                        </p>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                            {selected.remarks_or_notes || '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                <div
                                    className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Line Items
                                    </p>
                                    <span className="text-[11px] text-gray-400">
                                        {itemCount} Items Total
                                    </span>
                                </div>
                                <table className="w-full table-fixed text-left">
                                    <thead>
                                    <tr className="border-b border-gray-100 dark:border-gray-700/40">
                                        <th className="w-[60%] px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                            Item Description
                                        </th>
                                        <th className="w-[20%] px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Qty</th>
                                        <th className="w-[20%] px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Total</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                    {(selected.items || []).map((item, idx) => (<tr key={item.id ?? idx}>
                                        <td className="px-5 py-3 text-xs align-top">
                                            <ItemDescription text={item.item_desc}/>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-700 dark:text-gray-300 text-right align-top">
                                            {item.quantity} {item.unit || ''}
                                        </td>
                                        <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white text-right align-top">
                                            {formatCurrency(item.total_estimated_cost)}
                                        </td>
                                    </tr>))}
                                    {itemCount === 0 && (<tr>
                                        <td colSpan="3" className="px-5 py-6 text-center text-xs text-gray-400">
                                            No line items on this request.
                                        </td>
                                    </tr>)}
                                    </tbody>
                                    <tfoot>
                                    <tr className="border-t border-gray-100 dark:border-gray-700/40">
                                        <td colSpan="2"
                                            className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">
                                            Grand Total
                                        </td>
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white text-right">
                                            {formatCurrency(grandTotal(selected.items))}
                                        </td>
                                    </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Actions */}
                        <div
                            className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/20 flex items-center justify-between gap-4">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {itemCount ? `${itemCount} line item${itemCount === 1 ? '' : 's'} to price and check.` : 'No line items yet.'}
                            </p>

                            <Link
                                href={route('encode.edit', {purchaseRequest: selected.id})}
                                className="inline-flex shrink-0 items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
                            >
                                <FileText className="w-3.5 h-3.5"/>
                                Encode items
                            </Link>
                        </div>
                    </>)}
                </div>)}

            </div>
        </div>
    </AuthenticatedLayout>);
}

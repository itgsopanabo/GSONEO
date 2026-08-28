import {Head, Link, router} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {STATUS_MAP} from '@/constants/statusConfig';
import {useEffect, useMemo, useState} from "react";
import {Inbox as InboxIcon, PanelRightClose, PanelRightOpen, Search} from "lucide-react";
/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
// Both actions are keyed by {purchase_request}, not {purchase_order}.
const ROUTES = {
    toRelease: 'inventory.outgoing.release', acceptOutgoing: 'inventory.outgoing',
};
const STATUS_FOR_NOT_RECEIVE = 500;
const STATUS_FOR_RECEIVED = 550;
const QUEUE_COUNTERS = [{
    key: 'not-yet',
    label: 'Not yet Receive',
    statuses: [STATUS_FOR_NOT_RECEIVE],
    style: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
},];
const EMPTY_PO_FORM = {supplier: '', date_received: '', po_number_mode: 'auto', po_number: ''};
const CLOSED_RESULT_MODAL = {isOpen: false, poNumber: null, supplier: null, dateReceived: null};

// Default matches the PR page's arithmetic so totals agree across both pages.
function lineTotal(item) {
    return Number(item?.quantity ?? 0) * Number(item?.total_estimated_cost ?? 0);
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function resolvePurchaseRequest(item) {
    return item?.purchase_request ?? item?.purchaseRequest ?? null;
}

function readPoNumber(row) {
    return row?.PO_Number ?? row?.po_number ?? null;
}

function extractPoNumber(page, purchaseRequestId, fallback = null) {
    const refreshedRow = (page.props.purchaseOrders?.data ?? []).find((row) => {
        const pr = resolvePurchaseRequest(row);
        return (pr?.id ?? row?.id) === purchaseRequestId;
    });
    return readPoNumber(page.props.purchaseRequest) ?? page.props.flash?.po_number ?? readPoNumber(refreshedRow) ?? fallback ?? null;
}

function routeIsMissing(routeName) {
    return typeof route().has === 'function' && !route().has(routeName);
}

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function formatCurrency(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return `₱${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function outgoingIndex({purchaseOrders}) {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
    const [poFormModal, setPoFormModal] = useState({isOpen: false});
    // const [poResultModal, setPoResultModal] = useState(CLOSED_RESULT_MODAL);
    const modalIsOpen = poFormModal.isOpen;
    useEffect(() => {
        if (selectedId !== null || modalIsOpen) return;
        const interval = setInterval(() => {
            router.reload({only: ['purchaseOrders'], preserveScroll: true, preserveState: true});
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedId, modalIsOpen]);
    const orders = useMemo(() => {
        const rawItems = purchaseOrders?.data ?? [];
        return rawItems.map((item, index) => {
            const pr = resolvePurchaseRequest(item);
            return {
                rowId: item?.id ?? `row-${index}`,
                purchaseRequestId: pr?.id ?? null,
                po_number: readPoNumber(item),
                pr_number: pr?.pr_number ?? item?.PR_Number ?? '—',
                supplier: item?.PO_Supplier ?? null,
                po_date: item?.PO_Date ?? null,
                supplier_receive_date: item?.supplier_receive_date ?? null,
                requester_name: pr?.requester_name ?? '',
                requester_department: pr?.requester_department ?? '',
                status: item?.status ?? pr?.status ?? 0,
                created_at: item?.created_at ?? pr?.created_at ?? null,
                remarks_or_notes: pr?.remarks_or_notes ?? '',
                items: pr?.items ?? [],
            };
        });
    }, [purchaseOrders]);
    const filteredOrders = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return orders;
        return orders.filter((o) => [o.po_number, o.pr_number, o.requester_name, o.requester_department, o.supplier]
            .some((field) => String(field ?? '').toLowerCase().includes(q)));
    }, [orders, search]);

    const explicit = selectedId !== null ? filteredOrders.find((o) => o.rowId === selectedId) ?? null : null;
    const selected = selectedId === null ? (filteredOrders[0] ?? null) : explicit;
    const grandTotal = useMemo(() => (selected?.items ?? []).reduce((sum, item) => sum + lineTotal(item), 0), [selected]);
    const canAct = Boolean(selected?.purchaseRequestId);

    function selectRow(rowId) {
        setSelectedId(rowId);
        setIsPanelCollapsed(false);
    }

    function toRelease() {
        if (!selected?.po_number || routeIsMissing(ROUTES.toRelease)) return;
        setProcessing(true);
        router.post(route(ROUTES.toRelease), {
            PO_Number: selected.po_number,
        }, {
            preserveScroll: true, onFinish: () => setProcessing(false),
        });
    }

    return (<AuthenticatedLayout>
            <Head title="Procurement Section - Purchase Order Management"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Outgoings
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Manage, monitor, and process outgoing.
                        </p>
                    </div>
                </div>
                {/* Master-detail layout */}
                <div
                    className={`grid grid-cols-1 gap-6 lg:h-[calc(100vh-220px)] lg:min-h-[560px] transition-[grid-template-columns] duration-300 ease-in-out ${isPanelCollapsed ? 'lg:grid-cols-[1fr_56px]' : 'lg:grid-cols-[360px_1fr]'}`}
                >
                    {/* Left: PO Queue */}
                    <div
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden max-h-[70vh] lg:max-h-none">
                        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60">
                            <div className="flex items-center justify-between mb-2.5">
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Outgoings</h2>
                                <span className="text-[11px] text-gray-400">{orders.length} on this page</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {/*{QUEUE_COUNTERS.map((counter) => (*/}
                                {/*    <span*/}
                                {/*        key={counter.key}*/}
                                {/*        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${counter.style}`}*/}
                                {/*    >*/}
                                {/*        {counter.label ?? STATUS_MAP[counter.statuses[0]]?.label ?? 'Unknown'}*/}
                                {/*        <span className="font-semibold tabular-nums">{counts[counter.key]}</span>*/}
                                {/*    </span>*/}
                                {/*))}*/}
                            </div>
                        </div>
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                            <div className="relative">
                                <Search
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search PO / PR number, requester, supplier..."
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                            {filteredOrders.length > 0 ? filteredOrders.map((po) => {
                                const isActive = selected != null && po.rowId === selected.rowId;
                                const orderTotal = (po.items ?? []).reduce((sum, item) => sum + lineTotal(item), 0);
                                return (<button
                                        key={po.rowId}
                                        type="button"
                                        onClick={() => selectRow(po.rowId)}
                                        aria-current={isActive ? 'true' : undefined}
                                        className={`w-full text-left px-4 py-3.5 transition-colors border-l-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${isActive ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-600' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/20'}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span
                                                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                                {po.po_number || po.pr_number}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {formatRelativeTime(po.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                            {po.requester_name || 'Unnamed requester'}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            {po.items?.length > 0 && (<span
                                                    className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                                                    {formatCurrency(orderTotal)}
                                                </span>)}
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[po.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                                <span className="w-1 h-1 rounded-full bg-current"></span>
                                                {STATUS_MAP[po.status]?.label || 'Unknown'}
                                            </span>
                                        </div>
                                        {po.remarks_or_notes && (
                                            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                {po.remarks_or_notes}
                                            </p>)}
                                    </button>);
                            }) : (<div className="px-6 py-16 text-center">
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {search ? 'No orders found' : 'Nothing in the queue'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        {search ? 'Try a different search.' : 'New incoming will appear here.'}
                                    </p>
                                </div>)}
                        </div>
                        {purchaseOrders?.links && purchaseOrders.links.length > 3 && (<div
                                className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-center gap-1">
                                {purchaseOrders.links.map((link, index) => (<Link
                                        key={index}
                                        href={link.url || '#'}
                                        dangerouslySetInnerHTML={{__html: link.label}}
                                        className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${link.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />))}
                            </div>)}
                    </div>
                    {/* Right: Detail Panel / Collapsed State */}
                    {isPanelCollapsed ? (<div
                            className="hidden lg:flex bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex-col items-center py-4">
                            <button
                                type="button"
                                onClick={() => setIsPanelCollapsed(false)}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                                title="Expand details panel"
                            >
                                <PanelRightOpen className="w-4 h-4"/>
                            </button>
                        </div>) : (<div
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
                            {!selected ? (<div className="flex-1 flex items-center justify-center">
                                    <div className="text-center px-6">
                                        <InboxIcon className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">No order
                                            selected</p>
                                        <p className="mt-1 text-xs text-gray-500">Choose an order from the queue to
                                            review it.</p>
                                    </div>
                                </div>) : (<>
                                    {/* Header */}
                                    <div
                                        className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex items-start justify-between">
                                        <div>
                                            {/*        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">*/}
                                            {/*            <span>Created by {selected.requester_name || 'N/A'}</span>*/}
                                            {/*        </div>*/}
                                            {/*        <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">*/}
                                            {/*            {selected.po_number}*/}
                                            {/*        </h2>*/}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => setIsPanelCollapsed(true)}
                                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors hidden lg:inline-flex"
                                                title="Collapse panel"
                                            >
                                                <PanelRightClose className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                    {/* Body */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* Request Summary */}
                                            <div
                                                className="md:col-span-3 border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                                    Request Summary
                                                </p>
                                                <div
                                                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                            PR Number
                                                        </p>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white font-mono">
                                                            {selected.pr_number || '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                            PO Number
                                                        </p>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white font-mono">
                                                            {selected.po_number || '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                            Requester
                                                        </p>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                            {selected.requester_name || '—'}
                                                        </p>
                                                    </div>
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
                                                            {selected.created_at ? new Date(selected.created_at).toLocaleDateString(undefined, {
                                                                year: 'numeric', month: 'short', day: 'numeric',
                                                            }) : '—'}
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
                                        {/* Order Details */}
                                        {(selected.po_number || selected.supplier) && (<div
                                                className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                                    Order Details
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                            PO Number
                                                        </p>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white font-mono">
                                                            {selected.po_number || '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                            Supplier
                                                        </p>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                            {selected.supplier || '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                            PO Date
                                                        </p>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                            {selected.po_date || '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                            Date Received
                                                        </p>
                                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                            {selected.supplier_receive_date || '—'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>)}
                                        {/* Line Items */}
                                        <div
                                            className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                            <div
                                                className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Line Items
                                                </p>
                                                <span className="text-[11px] text-gray-400">
                                                    {(selected.items?.length ?? 0)} Items Total
                                                </span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                    <tr className="border-b border-gray-100 dark:border-gray-700/40">
                                                        <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                            Item Description
                                                        </th>
                                                        <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">
                                                            Qty
                                                        </th>
                                                        <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">
                                                            Total
                                                        </th>
                                                    </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                                    {(selected.items || []).map((item, idx) => (
                                                        <tr key={item.id ?? idx}>
                                                            <td className="px-5 py-3 text-xs text-gray-700 dark:text-gray-300">
                                                                {item.item_name}
                                                            </td>
                                                            <td className="px-5 py-3 text-xs text-gray-700 dark:text-gray-300 text-right">
                                                                {item.quantity} {item.unit || ''}
                                                            </td>
                                                            <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white text-right">
                                                                {formatCurrency(lineTotal(item))}
                                                            </td>
                                                        </tr>))}
                                                    {(!selected.items || selected.items.length === 0) && (<tr>
                                                            <td colSpan={3}
                                                                className="px-5 py-6 text-center text-xs text-gray-400">
                                                                No line items on this request.
                                                            </td>
                                                        </tr>)}
                                                    </tbody>
                                                    <tfoot>
                                                    <tr className="border-t border-gray-100 dark:border-gray-700/40">
                                                        <td colSpan={2}
                                                            className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">
                                                            Grand Total
                                                        </td>
                                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white text-right">
                                                            {formatCurrency(grandTotal)}
                                                        </td>
                                                    </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Footer actions */}
                                    <div
                                        className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-end gap-4">
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/*{selected.status === STATUS_FOR_NOT_RECEIVE && (*/}
                                            {/*    <button*/}
                                            {/*        type="button"*/}
                                            {/*        onClick={acceptIncoming}*/}
                                            {/*        disabled={processing || !canAct}*/}
                                            {/*        className="inline-flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full shadow-sm transition-colors"*/}
                                            {/*    >*/}
                                            {/*        {processing ? 'Processing…' : 'Accept for Outgoing'}*/}
                                            {/*    </button>*/}
                                            {/*)}*/}
                                            {selected.status === STATUS_FOR_RECEIVED && (<button
                                                    type="button"
                                                    onClick={toRelease}
                                                    disabled={processing || !canAct}
                                                    className="inline-flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                                                >
                                                    Release/Complete
                                                </button>)}
                                        </div>
                                    </div>
                                </>)}
                        </div>)}
                </div>
            </div>
        </AuthenticatedLayout>);
}

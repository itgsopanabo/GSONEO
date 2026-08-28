import {Head, Link, useForm} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {useEffect, useMemo, useState} from "react";
import {ClipboardCheck, PanelRightClose, PanelRightOpen, Printer, Search} from "lucide-react";
/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
const STATUS_FOR_IAR = 300;
// NOTE: this matches the original Show.jsx condition exactly (`status === 230`).
// The IAR queue below only ever lists orders with status 300 (see STATUS_FOR_IAR),
// so as written this button will never actually appear for anything in this list.
// Confirm which status code should trigger acceptance and update this constant.
const STATUS_FOR_ACCEPT = 230;
const QUEUE_COUNTERS = [{
    key: 'for-inspection',
    label: 'For Inspection',
    statuses: [STATUS_FOR_IAR],
    style: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
},];

function lineTotal(item) {
    return Number(item?.quantity ?? 0) * Number(item?.total_estimated_cost ?? 0);
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
function resolvePurchaseRequest(item) {
    return item?.purchase_request ?? item?.purchaseRequest ?? null;
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'});
}

function formatCurrency(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return `₱${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function IarIndex({purchaseOrders}) {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfDetails, setPdfDetails] = useState({invoice_number: '', invoice_date: '', selected_item_ids: []});
    const [pdfItemSearch, setPdfItemSearch] = useState('');
    const orders = useMemo(() => {
        const rawItems = purchaseOrders?.data ?? [];
        return rawItems.map((item, index) => {
            const pr = resolvePurchaseRequest(item);
            return {
                id: item?.id ?? null,
                rowId: item?.id ?? `row-${index}`,
                po_number: item?.PO_Number ?? null,
                pr_number: item?.PR_Number ?? pr?.pr_number ?? '—',
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
    const counts = useMemo(() => {
        const tally = Object.fromEntries(QUEUE_COUNTERS.map((c) => [c.key, 0]));
        for (const order of orders) {
            for (const counter of QUEUE_COUNTERS) {
                if (counter.statuses.includes(order.status)) tally[counter.key] += 1;
            }
        }
        return tally;
    }, [orders]);
    const explicit = selectedId !== null ? filteredOrders.find((o) => o.rowId === selectedId) ?? null : null;
    const selected = selectedId === null ? (filteredOrders[0] ?? null) : explicit;
    const grandTotal = useMemo(() => (selected?.items ?? []).reduce((sum, item) => sum + lineTotal(item), 0), [selected]);
    const pdfVisibleItems = useMemo(() => {
        const allItems = selected?.items ?? [];
        const q = pdfItemSearch.trim().toLowerCase();
        if (!q) return allItems;
        return allItems.filter((item) => String(item.item_name ?? item.product_id ?? '').toLowerCase().includes(q));
    }, [selected, pdfItemSearch]);
    // Acceptance form — Inertia's useForm. Kept at page level since the target
    // order changes whenever a different row is selected.
    const {data, setData, post, processing, reset} = useForm({
        inspector_name: '',
        date_inspected: '',
        invoice_number: '',
        invoice_date: '',
        remarks: '',
        selected_item_ids: [],
    });
    // Whenever the selected order changes, reset both the acceptance form and
    // the PDF item-selection defaults to that order's own items.
    useEffect(() => {
        const ids = (selected?.items ?? []).map((item) => item.id);
        reset();
        setData('selected_item_ids', ids);
        setPdfDetails({invoice_number: '', invoice_date: '', selected_item_ids: ids});
        setPdfItemSearch('');
        setConfirmOpen(false);
        setPdfModalOpen(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.rowId]);

    function selectRow(rowId) {
        setSelectedId(rowId);
        setIsPanelCollapsed(false);
    }

    function toggleItemSelection(itemId, targetStateSetter) {
        targetStateSetter((prev) => {
            const currentIds = prev.selected_item_ids;
            const updatedIds = currentIds.includes(itemId) ? currentIds.filter((id) => id !== itemId) : [...currentIds, itemId];
            return {...prev, selected_item_ids: updatedIds};
        });
    }

    // Select/clear act on whatever the search box is currently showing, so on
    // a long list someone can filter down to "screws" and select just those
    // without affecting items outside the filter.
    function selectAllVisibleItems(visibleItems, targetStateSetter) {
        targetStateSetter((prev) => {
            const visibleIds = visibleItems.map((item) => item.id);
            const merged = new Set([...prev.selected_item_ids, ...visibleIds]);
            return {...prev, selected_item_ids: Array.from(merged)};
        });
    }

    function clearAllVisibleItems(visibleItems, targetStateSetter) {
        targetStateSetter((prev) => {
            const visibleIds = new Set(visibleItems.map((item) => item.id));
            return {...prev, selected_item_ids: prev.selected_item_ids.filter((id) => !visibleIds.has(id))};
        });
    }

    function handleAccept() {
        if (!selected?.id) return;
        post(route('inspection-acceptance-reports.accept', selected.id), {
            preserveScroll: true, onSuccess: () => setConfirmOpen(false),
        });
    }

    function handleConfirmPrintPdf() {
        if (!selected?.id) return;
        const queryParams = new URLSearchParams({
            invoice_number: pdfDetails.invoice_number,
            invoice_date: pdfDetails.invoice_date,
            item_ids: pdfDetails.selected_item_ids.join(','),
        });
        const url = `${route('inspection-acceptance-reports.pdf', {purchaseOrder: selected.id})}?${queryParams.toString()}`;
        window.open(url, '_blank');
        setPdfModalOpen(false);
    }

    return (
        <AuthenticatedLayout>
            <Head title="Inspection & Acceptance Reports"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Inspection &amp; Acceptance Reports
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Purchase orders ready for inspection and acceptance.
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
                                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Orders</h2>
                                <span className="text-[11px] text-gray-400">
                                    {purchaseOrders?.total ?? orders.length} total
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {QUEUE_COUNTERS.map((counter) => (
                                    <span
                                        key={counter.key}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${counter.style}`}
                                    >
                                        {counter.label}
                                        <span className="font-semibold tabular-nums">{counts[counter.key]}</span>
                                    </span>
                                ))}
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
                                return (
                                    <button
                                        key={po.rowId}
                                        type="button"
                                        onClick={() => selectRow(po.rowId)}
                                        aria-current={isActive ? 'true' : undefined}
                                        className={`w-full text-left px-4 py-3.5 transition-colors border-l-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${isActive ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-600' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/20'}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span
                                                className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                                {po.po_number || po.pr_number}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                {formatDate(po.po_date)}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            {po.items?.length > 0 && (
                                                <span
                                                    className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                                                    {formatCurrency(orderTotal)}
                                                </span>
                                            )}
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[po.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                                <span className="w-1 h-1 rounded-full bg-current"></span>
                                                {STATUS_MAP[po.status]?.label || 'Unknown'}
                                            </span>
                                        </div>
                                        {po.remarks_or_notes && (
                                            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                {po.remarks_or_notes}
                                            </p>
                                        )}
                                    </button>
                                );
                            }) : (
                                <div className="px-6 py-16 text-center">
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {search ? 'No orders found' : 'No purchase orders awaiting inspection'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        {search ? 'Try a different search.' : 'New orders will appear here once accepted for incoming.'}
                                    </p>
                                </div>
                            )}
                        </div>
                        {purchaseOrders?.links && purchaseOrders.links.length > 3 && (
                            <div
                                className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-center gap-1">
                                {purchaseOrders.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url || '#'}
                                        dangerouslySetInnerHTML={{__html: link.label}}
                                        className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${link.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Right: Detail Panel / Collapsed State */}
                    {isPanelCollapsed ? (
                        <div
                            className="hidden lg:flex bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex-col items-center py-4">
                            <button
                                type="button"
                                onClick={() => setIsPanelCollapsed(false)}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                                title="Expand details panel"
                            >
                                <PanelRightOpen className="w-4 h-4"/>
                            </button>
                        </div>
                    ) : (
                        <div
                            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
                            {!selected ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <div className="text-center px-6">
                                        <ClipboardCheck
                                            className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">No order
                                            selected</p>
                                        <p className="mt-1 text-xs text-gray-500">Choose an order from the queue to
                                            review it.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Header */}
                                    <div
                                        className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex items-start justify-between">
                                        <div>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">
                                                {selected.supplier || 'Unknown supplier'}
                                            </p>
                                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                                                {selected.po_number || '—'}
                                            </h2>
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
                                        <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
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
                                                        {formatDate(selected.po_date)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                        Date Received from Supplier
                                                    </p>
                                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                        {formatDate(selected.supplier_receive_date)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                    Status
                                                </p>
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[selected.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                                    <span className="w-1 h-1 rounded-full bg-current"></span>
                                                    {STATUS_MAP[selected.status]?.label || 'Unknown'}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Items for Inspection */}
                                        <div
                                            className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                            <div
                                                className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                    Items for Inspection
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
                                                            Item
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
                                                                <p className="font-semibold text-gray-900 dark:text-white">
                                                                    {item.item_name ?? item.product_id}
                                                                </p>
                                                                {item.item_desc && (
                                                                    <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                                                                        {item.item_desc}
                                                                    </p>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-3 text-xs text-gray-700 dark:text-gray-300 text-right">
                                                                {item.quantity} {item.unit || ''}
                                                            </td>
                                                            <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white text-right">
                                                                {formatCurrency(lineTotal(item))}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!selected.items || selected.items.length === 0) && (
                                                        <tr>
                                                            <td colSpan={3}
                                                                className="px-5 py-6 text-center text-xs text-gray-400">
                                                                No line items on this request.
                                                            </td>
                                                        </tr>
                                                    )}
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
                                        className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setPdfModalOpen(true)}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-full shadow-sm transition-colors"
                                        >
                                            <Printer className="w-4 h-4 text-gray-500"/>
                                            Print / Download PDF
                                        </button>
                                        {selected.status === STATUS_FOR_ACCEPT && (
                                            <button
                                                type="button"
                                                onClick={() => setConfirmOpen(true)}
                                                className="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                                            >
                                                Accept for Inspection
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Print / PDF Modal with Invoice and Item Selection */}
            {pdfModalOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div
                        className="bg-white rounded-xl shadow-xl max-w-xl w-full p-6 border border-gray-100 max-h-[90vh] flex flex-col">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">
                            Print Options — Invoice &amp; Items
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Provide the invoice number and select which items are included in this PDF report.
                        </p>
                        <div className="space-y-4 mb-6 border-t border-b border-gray-100 py-4 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Invoice No.
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INV-2026-001"
                                        value={pdfDetails.invoice_number}
                                        onChange={(e) => setPdfDetails({...pdfDetails, invoice_number: e.target.value})}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Invoice Date
                                    </label>
                                    <input
                                        type="date"
                                        value={pdfDetails.invoice_date}
                                        onChange={(e) => setPdfDetails({...pdfDetails, invoice_date: e.target.value})}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-semibold text-gray-600 uppercase">
                                        Included Items
                                        ({pdfDetails.selected_item_ids.length} of {(selected.items ?? []).length})
                                    </label>
                                    <div className="flex items-center gap-3 text-xs font-medium">
                                        <button
                                            type="button"
                                            onClick={() => selectAllVisibleItems(pdfVisibleItems, setPdfDetails)}
                                            className="text-emerald-700 hover:text-emerald-800"
                                        >
                                            Select all{pdfItemSearch ? ' shown' : ''}
                                        </button>
                                        <span className="text-gray-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => clearAllVisibleItems(pdfVisibleItems, setPdfDetails)}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            Clear{pdfItemSearch ? ' shown' : ''}
                                        </button>
                                    </div>
                                </div>
                                {(selected.items ?? []).length > 6 && (
                                    <div className="relative mb-2">
                                        <svg
                                            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                                  d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                        </svg>
                                        <input
                                            type="text"
                                            value={pdfItemSearch}
                                            onChange={(e) => setPdfItemSearch(e.target.value)}
                                            placeholder="Filter items by name..."
                                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                        />
                                    </div>
                                )}
                                <div
                                    className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2 bg-gray-50">
                                    {pdfVisibleItems.length > 0 ? pdfVisibleItems.map((item) => (
                                        <label key={item.id}
                                               className="flex items-center gap-3 text-sm p-1.5 rounded hover:bg-white cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={pdfDetails.selected_item_ids.includes(item.id)}
                                                onChange={() => toggleItemSelection(item.id, setPdfDetails)}
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="flex-1 font-medium text-gray-800 truncate">
                                                {item.item_name ?? item.product_id}
                                            </span>
                                            <span className="text-xs text-gray-500 shrink-0">
                                                {item.quantity} {item.unit}
                                            </span>
                                        </label>
                                    )) : (
                                        <p className="text-xs text-gray-400 text-center py-4">No items match
                                            "{pdfItemSearch}".</p>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPdfModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPrintPdf}
                                disabled={pdfDetails.selected_item_ids.length === 0}
                                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                            >
                                Generate PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm / Acceptance modal */}
            {confirmOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 mb-2">
                            Confirm Inspection &amp; Acceptance
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Record inspector details and invoice information before marking as accepted.
                        </p>
                        <div
                            className="space-y-4 mb-6 border-t border-b border-gray-100 py-4 max-h-[60vh] overflow-y-auto px-1">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                    Inspector Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={data.inspector_name}
                                    onChange={(e) => setData('inspector_name', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Date Inspected
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={data.date_inspected}
                                        onChange={(e) => setData('date_inspected', e.target.value)}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Invoice No.
                                    </label>
                                    <input
                                        type="text"
                                        value={data.invoice_number}
                                        onChange={(e) => setData('invoice_number', e.target.value)}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                    Invoice Date
                                </label>
                                <input
                                    type="date"
                                    value={data.invoice_date}
                                    onChange={(e) => setData('invoice_date', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                    Remarks (optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={data.remarks}
                                    onChange={(e) => setData('remarks', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmOpen(false)}
                                disabled={processing}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAccept}
                                disabled={processing || !data.inspector_name || !data.date_inspected}
                                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700"
                            >
                                {processing ? 'Saving...' : 'Confirm Acceptance'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

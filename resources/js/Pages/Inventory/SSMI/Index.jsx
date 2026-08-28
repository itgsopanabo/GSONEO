import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {Head, Link, router} from '@inertiajs/react';
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {useMemo, useState} from "react";
import {ClipboardCheck, FileText, PanelRightClose, PanelRightOpen, Printer, Search} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */
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

function lineTotal(item) {
    return Number(item?.quantity ?? 0) * Number(item?.total_estimated_cost ?? 0);
}

const ROUTES = {
    generateSSMI: 'ssmi.generateNumber', proceedOutgoing: 'ssmi.toOutgoing',
};


const STATUS_FOR_NUMBERING = 500;
const STATUS_FOR_OUTGOING = 550;

function routeIsMissing(routeName) {
    return typeof route().has === 'function' && !route().has(routeName);
}

export default function Index({purchaseOrders}) {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

    const [processing, setProcessing] = useState(false);


    const rows = useMemo(() => purchaseOrders?.data ?? [], [purchaseOrders]);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((po) => String(po.PO_Number ?? '').toLowerCase().includes(q));
    }, [rows, search]);

    const explicit = selectedId !== null ? filteredRows.find((po) => po.id === selectedId) ?? null : null;
    const selected = selectedId === null ? (filteredRows[0] ?? null) : explicit;


    const grandTotal = useMemo(() => (selected?.purchase_request.items ?? []).reduce((sum, item) => sum + lineTotal(item), 0), [selected]);

    function selectRow(id) {
        setSelectedId(id);
        setIsPanelCollapsed(false);
    }


    function generateNumber() {
        if (!selected?.PO_Number || routeIsMissing(ROUTES.generateSSMI)) return;
        setProcessing(true);
        router.post(route(ROUTES.generateSSMI, selected.PO_Number), {}, {
            preserveScroll: true, onFinish: () => setProcessing(false),
        });
    }

    function proceedOutgoing() {
        if (!selected.SSMI_Number) return;
        router.post(route(ROUTES.proceedOutgoing, selected.id), {}, {
            preserveScroll: true, onSuccess: () => setSelectedId(null), onFinish: () => setAction(null),
        });
    }

    return (<AuthenticatedLayout>
        <Head title="SSMI"/>
        <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                        SSMI
                    </h1>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {purchaseOrders?.total ?? rows.length} {(purchaseOrders?.total ?? rows.length) === 1 ? 'slip' : 'slips'} on
                        record.
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
                    <div
                        className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Slips</h2>
                        <span className="text-[11px] text-gray-400">
                                {purchaseOrders?.total ?? rows.length} total
                            </span>
                    </div>
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                        <div className="relative">
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search PO number..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                        {filteredRows.length > 0 ? filteredRows.map((po) => {
                            const isActive = selected != null && po.id === selected.id;
                            return (<button
                                key={po.id}
                                type="button"
                                onClick={() => selectRow(po.id)}
                                aria-current={isActive ? 'true' : undefined}
                                className={`w-full text-left px-4 py-3.5 transition-colors border-l-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${isActive ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-600' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/20'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                            <span
                                                className="text-xs font-semibold text-gray-900 dark:text-white font-mono truncate">
                                                {po.PO_Number ?? '—'}
                                            </span>
                                    <span className="text-[10px] text-gray-400">
                                                {formatDate(po.created_at)}
                                            </span>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[po.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                                <span className="w-1 h-1 rounded-full bg-current"></span>
                                                {STATUS_MAP[po.status]?.label || 'Unknown'}
                                            </span>
                                </div>
                            </button>);
                        }) : (<div className="px-6 py-16 text-center">
                            <FileText className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                                {search ? 'No slips found' : 'No purchase orders found'}
                            </p>
                            <p className="mt-1 text-[11px] text-gray-500">
                                {search ? 'Try a different search.' : 'New slips will appear here once created.'}
                            </p>
                        </div>)}
                    </div>
                    {purchaseOrders?.links && purchaseOrders.links.length > 3 && (<div
                        className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-center gap-1">
                        {purchaseOrders.links.map((link, index) => (<Link
                            key={index}
                            href={link.url || '#'}
                            dangerouslySetInnerHTML={{__html: link.label}}
                            className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${link.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/40'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                            <ClipboardCheck
                                className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
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
                                            {selected.PO_Number || '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            Supplier
                                        </p>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                            {selected.PO_Supplier || '—'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            PO Date
                                        </p>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                            {formatDate(selected.PO_Date)}
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
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            RIS Number
                                        </p>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                            {selected.RIS_Number}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            RIS Date
                                        </p>
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">
                                            {selected.RIS_Date}
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
                            <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                    Inspection and Acceptance Reports
                                </p>

                                {selected.i_a_rs?.length > 0 ? (<div className="space-y-3">
                                    {selected.i_a_rs.map((iar, index) => (

                                        <div
                                            key={iar.id}
                                            className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                                        >
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-gray-400 uppercase">#</p>
                                                    <p className="text-xs font-medium">
                                                        {index + 1}
                                                    </p>
                                                </div>
                                                <div>

                                                    <p className="text-[10px] text-gray-400 uppercase">
                                                        IAR No.
                                                    </p>
                                                    <p className="text-xs font-medium">
                                                        {iar.iar_number}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-[10px] text-gray-400 uppercase">
                                                        Date
                                                    </p>
                                                    <p className="text-xs font-medium">
                                                        {formatDate(iar.created_at)}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-[10px] text-gray-400 uppercase">
                                                        Invoice Number
                                                    </p>
                                                    <p className="text-xs font-medium">
                                                        {iar.invoice_number ?? "—"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>))}
                                </div>) : (<p className="text-xs text-gray-500">
                                    No Inspection and Acceptance Reports found.
                                </p>)}
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
                                                    {(selected.purchase_request?.items?.length ?? 0)} Items Total
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
                                        {(selected.purchase_request.items || []).map((item, idx) => (
                                            <tr key={item.id ?? idx}>
                                                <td className="px-5 py-3 text-xs text-gray-700 dark:text-gray-300">
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {item.item_name ?? item.product_id}
                                                    </p>
                                                    {item.item_desc && (
                                                        <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {item.item_desc}
                                                        </p>)}
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
                                                End of the line items on this request.
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
                            className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-end gap-3">

                            {selected.SSMI_Number !== null && (<button
                                type="button"
                                onClick={proceedOutgoing}
                                disabled={processing}
                                className="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Proceed to Outgoing
                            </button>)}

                            {selected.SSMI_Number === null && (<button
                                type="button"
                                onClick={generateNumber}
                                disabled={processing}
                                className="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                Generate Number
                            </button>)}

                        </div>
                    </>)}
                </div>)}
            </div>
        </div>
    </AuthenticatedLayout>);
}

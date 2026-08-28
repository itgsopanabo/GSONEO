import {Head, Link, router, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {useEffect, useMemo, useState} from "react";
import {PanelRightClose, PanelRightOpen, Search} from "lucide-react";

/**
 * NOTE ON TOTALS
 * --------------
 * Your existing purchase-requests page treats `total_estimated_cost` two ways:
 * the Total column prints it as-is, while the grand total multiplies it by
 * quantity. Only one can be right. This page reads the name literally — the
 * field is already the line total — so `lineTotal()` below does no
 * multiplication. If it's actually a unit price, change `lineTotal` to
 * `quantity * total_estimated_cost` and every figure on the page follows.
 */

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
    return date.toLocaleDateString();
}

function formatCurrency(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return `₱${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function lineTotal(item) {
    const num = Number(item?.total_estimated_cost);
    return Number.isNaN(num) ? 0 : num;
}

function requestTotal(request) {
    return (request?.items || []).reduce((sum, item) => sum + lineTotal(item), 0);
}

export default function Index({purchaseRequests}) {
    const requests = purchaseRequests?.data || [];
    const {csrf_token} = usePage().props;

    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(requests[0]?.id ?? null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [processing, setProcessing] = useState(false);


    const [canvasModal, setCanvasModal] = useState({
        isOpen: false, mode: 'create', canvasId: null, opened_on: '', delivery_period: '', bac_date: '',
    });

    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({
                only: ['purchaseRequests'], preserveScroll: true, preserveState: true,
            });
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
        return requests.filter(pr => pr.pr_number?.toLowerCase().includes(q) || pr.requester_name?.toLowerCase().includes(q) || pr.requester_department?.toLowerCase().includes(q));
    }, [requests, search]);

    const pendingCount = useMemo(() => requests.filter(pr => pr.status === 200).length, [requests]);
    const selected = requests.find(r => r.id === selectedId) || null;
    const items = selected?.items || [];
    const canvasses = useMemo(() => {
        const groups = new Map();

        (selected?.canvas_forms || []).forEach((canvas) => {
            if (!groups.has(canvas.CF_Number)) groups.set(canvas.CF_Number, canvas);
        });

        return [...groups.values()];
    }, [selected]);

    function openCanvasModal(mode = 'create', canvas = null) {
        if (!selected) return;
        setCanvasModal({
            isOpen: true,
            mode,
            canvasId: canvas?.id ?? null,
            opened_on: mode === 'reprint' ? canvas?.CF_to_be_Open || '' : '',
            delivery_period: mode === 'reprint' ? canvas?.CF_delivery_Period || '' : '',
            bac_date: mode === 'reprint' ? canvas?.CF_bac_date || '' : '',
        });
    }

    function closeCanvasModal() {
        setCanvasModal({
            isOpen: false, mode: 'create', canvasId: null, opened_on: '', delivery_period: '', bac_date: '',
        });
    }

    function submitPrintCanvas() {
        if (!selected || !canvasModal.opened_on) return;

        const canvasPayload = {
            opened_on: canvasModal.opened_on,
            delivery_period: canvasModal.delivery_period,
            bac_date: canvasModal.bac_date,
        };

        if (canvasModal.mode === 'create') {
            setProcessing(true);
            router.post(route('purchase-requests.printCanvas', {purchase_request: selected.id}), canvasPayload, {
                preserveScroll: true,
                onSuccess: closeCanvasModal,
                onFinish: () => setProcessing(false),
            });
            return;
        }

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = route('canvas.reprint', {canva: canvasModal.canvasId});
        form.target = '_blank';

        const payload = {
            _token: csrf_token,
            ...canvasPayload,
            _method: 'PUT',
        };

        Object.keys(payload).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = payload[key] ?? '';
            form.appendChild(input);
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        closeCanvasModal();
    }

    function viewCanvas(canvas) {
        if (!canvas) return;
        window.open(
            route('canvas.show', {canva: canvas.id}),
            '_blank',
            'noopener,noreferrer',
        );
    }

    /*
    * TODO
    *  route: purchase-requests.proceedCanvas
    *  params: $id
    */
    function proceedtocanvas(){
        if (!selected) return;
        setProcessing(true);
        router.post(route('purchase-requests.proceedCanvas', {purchase_request: selected.id}), {}, {
            preserveScroll: true, onFinish: () => setProcessing(false),
        });
    }
    return (<AuthenticatedLayout>
        <Head title="Canvas Index Page"/>

        <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                    Canvas Form Management Module
                </h1>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Generate, view, and update vendor canvass forms for verified purchase requests.
                </p>
            </div>

            {/* Master-detail layout */}
            <div
                className={`grid grid-cols-1 gap-6 h-[calc(100vh-220px)] min-h-[560px] transition-[grid-template-columns] duration-300 ease-in-out ${isPanelCollapsed ? 'lg:grid-cols-[1fr_56px]' : 'lg:grid-cols-[360px_1fr]'}`}
            >

                {/* Left: Verify queue */}
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden">
                    <div
                        className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Canvas Form Queues</h2>
                        <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {pendingCount} Ready
                        </span>
                    </div>

                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search PR ID, Vendor..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                        </div>
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
                                    {pr.requester_name || 'Untitled request'}
                                </p>
                                <div className="mt-1.5 flex items-center gap-2">
                                    {pr.items != null && (<span
                                        className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                                        {formatCurrency(requestTotal(pr))}
                                    </span>)}
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[pr.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                        <span className="w-1 h-1 rounded-full bg-current"></span>
                                        {STATUS_MAP[pr.status]?.label || 'Unknown'}
                                    </span>
                                </div>
                            </button>);
                        }) : (<div className="px-6 py-16 text-center">
                            <p className="text-xs font-medium text-gray-900 dark:text-white">No requests found</p>
                            <p className="mt-1 text-[11px] text-gray-500">Try a different search.</p>
                        </div>)}
                    </div>

                    {purchaseRequests?.links && purchaseRequests.links.length > 3 && (<div
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
                            <p className="mt-1 text-xs text-gray-500">Choose a request from the queue to review it.</p>
                        </div>
                    </div>) : (<>
                        {/* Header */}
                        <div
                            className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {selected.pr_number || 'Purchase Request'}
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsPanelCollapsed(true)}
                                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors hidden lg:inline-flex"
                                title="Collapse panel"
                            >
                                <PanelRightClose className="w-4 h-4"/>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Request Summary */}
                            <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                    Request Summary
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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

                            {/* Canvas history */}
                            <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Canvasses for this PR
                                    </p>

                                </div>
                                {canvasses.length === 0 ? (
                                    <p className="px-5 py-5 text-xs text-gray-400">No Canvas form has been generated yet.</p>
                                ) : (
                                    <div className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                        {canvasses.map((canvas) => (
                                            <div key={canvas.CF_Number} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                                        {canvas.CF_Number}
                                                    </p>
                                                    <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                                        Open: {canvas.CF_to_be_Open || '—'} · Created: {canvas.created_at ? new Date(canvas.created_at).toLocaleDateString() : '—'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => viewCanvas(canvas)}
                                                        className="px-3 py-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openCanvasModal('reprint', canvas)}
                                                        className="px-3 py-1.5 text-[11px] font-medium text-white bg-blue-700 hover:bg-blue-600 rounded-lg"
                                                    >
                                                        Recanvass
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Line Items */}
                            <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                <div
                                    className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Line Items
                                    </p>
                                    <span className="text-[11px] text-gray-400">
                                        {items.length} {items.length === 1 ? 'Item' : 'Items'} Total
                                    </span>
                                </div>
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
                                    {items.map((item, idx) => (<tr key={item.id ?? idx}>
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
                                    {items.length === 0 && (<tr>
                                        <td colSpan="3" className="px-5 py-6 text-center text-xs text-gray-400">
                                            No line items on this request.
                                        </td>
                                    </tr>)}
                                    </tbody>
                                    {items.length > 0 && (<tfoot>
                                    <tr className="border-t border-gray-100 dark:border-gray-700/40">
                                        <td colSpan="2"
                                            className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">
                                            Grand Total
                                        </td>
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white text-right">
                                            {formatCurrency(requestTotal(selected))}
                                        </td>
                                    </tr>
                                    </tfoot>)}
                                </table>
                            </div>
                        </div>

                        {/* Actions */}
                        <div
                            className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-end gap-3">
                            {selected.status === 100 ? (<button
                                type="button"
                                onClick={proceedtocanvas}
                                disabled={processing}
                                className="inline-flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                            >
                                {processing ? 'Proceeding…' : 'Proceed to canvassing'}
                            </button>) : canvasses.length === 0 ? (<button
                                type="button"
                                onClick={() => openCanvasModal('create')}
                                disabled={processing}
                                className="inline-flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                            >
                                {processing ? 'Generatingâ€¦' : 'Generate Canvas'}
                            </button>) : null}
                        </div>
                    </>)}
                </div>)}

            </div>
        </div>

        {/* Canvas form modal */}
        {canvasModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {canvasModal.mode === 'reprint' ? 'Update & Reprint Canvas' : 'Print Canvas'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {canvasModal.mode === 'reprint'
                            ? `Update the canvassing details for ${selected?.pr_number || 'this request'} before reprinting.`
                            : `Provide the canvassing details for ${selected?.pr_number || 'this request'} before printing.`}
                    </p>

                    <div className="space-y-4 mb-6">


                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                To Be Opened On <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                autoFocus
                                value={canvasModal.opened_on}
                                onChange={(e) => setCanvasModal(prev => ({...prev, opened_on: e.target.value}))}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                Delivery Period
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 15 calendar days"
                                value={canvasModal.delivery_period}
                                onChange={(e) => setCanvasModal(prev => ({...prev, delivery_period: e.target.value}))}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                BAC Date
                            </label>
                            <input
                                type="date"
                                value={canvasModal.bac_date}
                                onChange={(e) => setCanvasModal(prev => ({...prev, bac_date: e.target.value}))}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeCanvasModal}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitPrintCanvas}
                            disabled={!canvasModal.opened_on}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            {canvasModal.mode === 'reprint' ? 'Update & Reprint' : 'Print Canvas'}
                        </button>
                    </div>
                </div>
            </div>)}
    </AuthenticatedLayout>);
}

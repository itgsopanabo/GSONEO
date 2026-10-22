import {Head, Link, router, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {formatDate} from "@/Utils/formatDate.js";
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {useEffect, useMemo, useState} from "react";
import {Search, PanelRightClose, PanelRightOpen} from "lucide-react";

/**
 * NOTE ON DATA SHAPE
 * ------------------
 * `purchaseOrders` is a Laravel paginator whose `.data` items are rows from the
 * `purchase_order` table, each carrying its parent purchase request as a
 * relation.
 *
 * That table uses PascalCase columns (`PO_Number`, `PO_Supplier`, `PR_Number`),
 * and Laravel serializes attribute names verbatim —
 * so the payload keys are PascalCase too, not snake_case. The lowercase
 * fallbacks below exist only in case an API resource renames them later.
 *
 * The PO row links to its request by the PR *number string*, not by a foreign
 * key id, so `purchaseRequestId` comes from the loaded relation. Without that
 * relation the action buttons have nothing to post against.
 *
 * Set DEBUG_ROWS to true to log the first raw row and its resolved shape.
 */
const DEBUG_ROWS = false;

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

// Both actions are keyed by {purchase_request}, not {purchase_order}.
const ROUTES = {
    verifyPO: 'purchase-requests.verifyPO', generatePONumber: 'purchase-requests.generatePONumber',
};

// Statuses that own a footer action. Named so the JSX reads as intent rather
// than magic numbers.
const STATUS_FOR_CANVASSING_NON_SVP = [100,205];
const STATUS_FOR_NUMBERING = 210;

const QUEUE_COUNTERS = [{
    key: 'not-yet',
    label: 'No yet Receive',
    statuses: [STATUS_FOR_CANVASSING_NON_SVP],
    style: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
}, {
    key: 'to-be-numbered',
    label: 'For PO Numbering',
    statuses: [STATUS_FOR_NUMBERING],
    style: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
},];

const EMPTY_PO_FORM = {supplier: '', po_number_mode: 'auto', po_number: ''};
const CLOSED_RESULT_MODAL = {isOpen: false, poNumber: null, supplier: null};

// Default matches the PR page's arithmetic so totals agree across both pages.
// If `total_estimated_cost` is already a line total, switch the two lines below
// AND fix the PR page's grand total, which is currently over-counting.
function lineTotal(item) {
    const num = Number(item?.total_estimated_cost);
    return Number.isNaN(num) ? 0 : num;
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function resolvePurchaseRequest(item) {
    return item?.purchase_request ?? item?.purchaseRequest ?? null;
}

// Single place that knows the column is `PO_Number`, so the rest of the file
// never has to guess the casing.
function readPoNumber(row) {
    return row?.PO_Number ?? row?.po_number ?? null;
}

/**
 * Digs the new PO number out of an Inertia response. This page's payload is a
 * paginator rather than a single PR, so the refreshed row is usually the real
 * source; the other branches cover controllers that flash or return the PR.
 */
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
    return formatDate(date);
}

function formatCurrency(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return `₱${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function Index({purchaseOrders}) {
    const {auth} = usePage().props;
    const userSection = auth?.user?.role?.section;

    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);

    const [poFormModal, setPoFormModal] = useState({isOpen: false});
    const [poForm, setPoForm] = useState(EMPTY_PO_FORM);
    const [poErrors, setPoErrors] = useState({});
    const [poResultModal, setPoResultModal] = useState(CLOSED_RESULT_MODAL);

    const modalIsOpen = poFormModal.isOpen || poResultModal.isOpen;

    // Polling pauses while a row is selected or a modal is open. Otherwise every
    // 5s the list is replaced underneath the user, which on a reordering or
    // shrinking list yanks the detail panel to a different order mid-read.
    useEffect(() => {
        if (selectedId !== null || modalIsOpen) return;
        const interval = setInterval(() => {
            router.reload({only: ['purchaseOrders'], preserveScroll: true, preserveState: true});
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedId, modalIsOpen]);

    const orders = useMemo(() => {
        const rawItems = purchaseOrders?.data ?? [];

        const mapped = rawItems.map((item, index) => {
            const pr = resolvePurchaseRequest(item);
            return {
                // Identity must always be defined and unique. If the payload has
                // no id, every row would share `undefined`, `find()` would match
                // row 0 on every click, and the queue would look unclickable.
                // The index fallback guarantees selection works regardless.
                rowId: item?.id ?? `row-${index}`,
                purchaseRequestId: pr?.id ?? null,
                po_number: readPoNumber(item), // The PO row carries PR_Number itself, so it stands in when the
                // relation is missing.
                pr_number: pr?.pr_number ?? item?.PR_Number ?? '—',
                supplier: item?.PO_Supplier ?? null,
                po_date: item?.PO_Date ?? null,
                requester_department: pr?.requester_department ?? '',
                status: item?.status ?? pr?.status ?? 0,
                created_at: item?.created_at ?? pr?.created_at ?? null,
                remarks_or_notes: pr?.remarks_or_notes ?? '',
                items: pr?.items ?? [],
            };
        });

        if (DEBUG_ROWS && rawItems.length > 0) {
            console.log('[PO] raw row:', rawItems[0]);
            console.log('[PO] mapped row:', mapped[0]);
            if (!mapped[0].purchaseRequestId) {
                console.warn('[PO] No purchase request id resolved — action buttons will stay disabled.');
            }
            if (!resolvePurchaseRequest(rawItems[0])) {
                console.warn('[PO] No purchase request relation found. Check the controller\'s `with()`.');
            }
        }

        return mapped;
    }, [purchaseOrders]);

    const filteredOrders = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return orders;
        return orders.filter((o) => [o.po_number, o.pr_number, o.requester_department, o.supplier]
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

    // Only falls back to the first row before the user has picked anything. Once
    // they have, a missing match shows the empty state instead of silently
    // snapping back to row 0 and masking a data problem.
    const explicit = selectedId !== null ? filteredOrders.find((o) => o.rowId === selectedId) ?? null : null;
    const selected = selectedId === null ? (filteredOrders[0] ?? null) : explicit;

    const grandTotal = useMemo(() => (selected?.items ?? []).reduce((sum, item) => sum + lineTotal(item), 0), [selected],);

    const canAct = Boolean(selected?.purchaseRequestId);

    function selectRow(rowId) {
        setSelectedId(rowId);
        setIsPanelCollapsed(false);
    }

    function closePoForm() {
        setPoFormModal({isOpen: false});
        setPoErrors({});
    }

    /* -------------------------------------------------------------- *
     * Status 200 → move the request into PO numbering
     * -------------------------------------------------------------- */
    function proceedPO() {
        if (!selected) return;

        if (!selected.purchaseRequestId) {
            console.warn('[verifyPO] Row has no purchase request id — check the controller\'s `with()`.');
            return;
        }

        if (routeIsMissing(ROUTES.verifyPO)) {
            console.warn(`Route "${ROUTES.verifyPO}" is not registered.`);
            return;
        }

        setProcessing(true);

        router.post(route(ROUTES.verifyPO, {purchase_request: selected.purchaseRequestId}), {}, {
            preserveScroll: true,
            preserveState: true, // keeps selectedId so the panel doesn't jump
            onSuccess: (page) => {
                const poNumber = extractPoNumber(page, selected.purchaseRequestId, selected.po_number);

                if (poNumber) {
                    setPoResultModal({isOpen: true, poNumber, supplier: null});
                } else {
                    console.warn('[verifyPO] No po_number in response. Controller must flash po_number ' + 'or redirect back with a refreshed purchaseOrders payload.');
                }
            },
            onError: (errors) => console.error('[verifyPO] request failed:', errors),
            onFinish: () => setProcessing(false),
        },);
    }

    /* -------------------------------------------------------------- *
     * Status 220 → collect supplier details, then assign the number
     * -------------------------------------------------------------- */
    function openPONumberForm() {
        if (!selected) return;

        if (!selected.purchaseRequestId) {
            console.warn('[generatePONumber] Row has no purchase request id.');
            return;
        }

        setPoErrors({});
        // Prefill from the row so re-running after a validation failure doesn't
        // make the user retype what the server already has.
        setPoForm({
            ...EMPTY_PO_FORM, supplier: selected.supplier ?? '',
        });
        setPoFormModal({isOpen: true});
    }

    function submitPONumber() {
        if (!selected?.purchaseRequestId) return;

        if (routeIsMissing(ROUTES.generatePONumber)) {
            console.warn(`Route "${ROUTES.generatePONumber}" is not registered.`);
            return;
        }

        setProcessing(true);

        router.post(route(ROUTES.generatePONumber, {purchase_request: selected.purchaseRequestId}), {
            supplier: poForm.supplier, po_number_mode: poForm.po_number_mode, // Only sent when the user types the number themselves. If the

            ...(poForm.po_number_mode === 'manual' ? {po_number: poForm.po_number} : {}),
        }, {
            preserveScroll: true, preserveState: true, onSuccess: (page) => {
                const poNumber = extractPoNumber(page, selected.purchaseRequestId, selected.po_number);
                closePoForm();

                if (poNumber) {
                    setPoResultModal({
                        isOpen: true, poNumber, supplier: poForm.supplier,
                    });
                } else {
                    console.warn('[generatePONumber] No po_number in response — check the controller redirect.');
                }
            }, // Errors stay in the modal so the user can correct them in place.
            onError: (errors) => setPoErrors(errors), onFinish: () => setProcessing(false),
        },);
    }

    return (<AuthenticatedLayout>
        <Head title="Procurement Section - Purchase Order Management"/>

        <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                        Purchase Orders
                    </h1>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Manage, monitor, and process purchase orders.
                    </p>
                </div>

                {userSection === 'Administration' && (<div>
                    <Link
                        href={route('purchase-requests.create')}
                        className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold tracking-wide text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 transition duration-150 ease-in-out shadow-sm"
                    >
                        Create Request
                    </Link>
                </div>)}
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
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Purchase Orders</h2>
                            <span className="text-[11px] text-gray-400">{orders.length} on this page</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {QUEUE_COUNTERS.map((counter) => (<span
                                key={counter.key}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${counter.style}`}
                            >
                                {counter.label ?? STATUS_MAP[counter.statuses[0]]?.label ?? 'Unknown'}
                                <span className="font-semibold tabular-nums">{counts[counter.key]}</span>
                            </span>))}
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
                                placeholder="Search PO / PR number, department, supplier..."
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
                                        {po.pr_number}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {formatRelativeTime(po.created_at)}
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                    {po.requester_department || 'No department'}
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
                                {search ? 'Try a different search.' : 'New purchase orders will appear here.'}
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

                {/* Right: Detail panel. The collapsed strip is desktop-only, so on
                    narrow screens the panel renders below the queue once a row is
                    picked rather than disappearing entirely. */}
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
                            <p className="text-sm font-medium text-gray-900 dark:text-white">No order selected</p>
                            <p className="mt-1 text-xs text-gray-500">Choose an order from the queue to review it.</p>
                        </div>
                    </div>) : (<>
                        {/* Header */}
                        <div
                            className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {selected.po_number || selected.pr_number || 'Purchase Order'}
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

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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

                            {/* Order details — only meaningful once numbering has run. */}
                            {(selected.po_number || selected.supplier) && (
                                <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                        Order Details
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                    </div>
                                </div>)}

                            {/* Line Items */}
                            <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
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
                                        {(selected.items || []).map((item, idx) => (<tr key={item.id ?? idx}>
                                            <td className="px-5 py-3 text-xs text-gray-700 dark:text-gray-300">
                                                {item.item_desc}
                                            </td>
                                            <td className="px-5 py-3 text-xs text-gray-700 dark:text-gray-300 text-right">
                                                {item.quantity} {item.unit || ''}
                                            </td>
                                            <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white text-right">
                                                {formatCurrency(lineTotal(item))}
                                            </td>
                                        </tr>))}
                                        {(!selected.items || selected.items.length === 0) && (<tr>
                                            <td colSpan={3} className="px-5 py-6 text-center text-xs text-gray-400">
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

                                {STATUS_FOR_CANVASSING_NON_SVP.includes(selected.status) && (<button
                                    type="button"
                                    onClick={proceedPO}
                                    disabled={processing || !canAct}
                                    className="inline-flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                                >
                                    {processing ? 'Processing…' : 'Receive Purchase Order'}
                                </button>)}

                                {/*i want to make this check if the status is included to the array of the status for numbering*/}
                                {selected.status === STATUS_FOR_NUMBERING && (<button
                                    type="button"
                                    onClick={openPONumberForm}
                                    disabled={processing || !canAct}
                                    className="inline-flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                                >
                                    Generate PO Number
                                </button>)}

                            </div>
                        </div>
                    </>)}
                </div>)}

            </div>
        </div>

        {/* PO number form */}
        {poFormModal.isOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Generate PO Number</h3>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4 font-mono">
                    {selected?.pr_number}
                </p>

                <div className="space-y-4">
                    <div>
                        <label
                            className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Supplier
                        </label>
                        <input
                            type="text"
                            value={poForm.supplier}
                            onChange={(e) => setPoForm({...poForm, supplier: e.target.value})}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                        {poErrors.supplier && (<p className="mt-1 text-[11px] text-red-600">{poErrors.supplier}</p>)}
                    </div>

                    <div>
                        <label
                            className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            PO Number Mode
                        </label>
                        <select
                            value={poForm.po_number_mode}
                            onChange={(e) => setPoForm({...poForm, po_number_mode: e.target.value})}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        >
                            {/* Values must match the controller's `in:` rule. */}
                            <option value="auto">Auto-generate</option>
                            <option value="manual">Enter manually</option>
                        </select>
                        {poErrors.po_number_mode && (
                            <p className="mt-1 text-[11px] text-red-600">{poErrors.po_number_mode}</p>)}
                    </div>

                    {poForm.po_number_mode === 'manual' && (<div>
                        <label
                            className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            PO Number
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="99999"
                            placeholder="e.g. 12 becomes PO-2026-00012"
                            value={poForm.po_number}
                            onChange={(e) => setPoForm({...poForm, po_number: e.target.value})}
                            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                        {poErrors.po_number && (<p className="mt-1 text-[11px] text-red-600">{poErrors.po_number}</p>)}
                    </div>)}
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={closePoForm}
                        disabled={processing}
                        className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/40 rounded-lg disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submitPONumber}
                        disabled={processing}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg"
                    >
                        {processing ? 'Generating…' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>)}

        {/* Result */}
        {poResultModal.isOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 p-6 shadow-xl">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">PO Number Generated</h3>
                <p className="mt-3 text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                    {poResultModal.poNumber}
                </p>

                {poResultModal.supplier && (<div className="mt-4 space-y-1.5">
                    {poResultModal.supplier && (<p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Supplier: <span
                        className="text-gray-900 dark:text-white">{poResultModal.supplier}</span>
                    </p>)}
                </div>)}

                <button
                    type="button"
                    onClick={() => setPoResultModal(CLOSED_RESULT_MODAL)}
                    className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                    Close
                </button>
            </div>
        </div>)}
    </AuthenticatedLayout>);
}

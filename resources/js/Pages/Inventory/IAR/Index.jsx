import {Head, Link, router, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import Modal from '@/Components/Modal';
import DateInput from "@/Components/DateInput.jsx";
import {HeldNotice, isHeldByTags, MissingTagsPanel, OrderTagBadges, TagMissingButton, personName} from "@/Components/MissingTags.jsx";
import {
    Detail, Pipeline, QueueTabs, StatusBadge, peso, qty, receivedByLine, useOrderQueue,
} from "@/Components/Inventory/OrderParts.jsx";
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {formatDate} from "@/Utils/formatDate.js";
import {useEffect, useMemo, useState} from "react";
import {ArrowRight, ClipboardCheck, FileText, Search} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
const STATUS_FOR_INSPECTION = 300;
const STATUS_FOR_RIS = 400;

const TABS = [
    {key: 'pending', label: 'For Inspection'},
    {key: 'inspected', label: 'Inspected'},
];

// Set by the server on each IAR and on the order: partial while any line still
// has a balance, complete once everything has been received.
const DELIVERY_TAGS = {
    partial: {
        label: 'Partial',
        style: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    },
    complete: {
        label: 'Complete',
        style: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    },
};

function DeliveryTag({status}) {
    const tag = DELIVERY_TAGS[status];
    if (!tag) return null;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tag.style}`}>
            {tag.label}
        </span>
    );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Each request line with what has arrived so far. The amount is the ordered
 * quantity at the awarded price where there is one, the estimate otherwise.
 */
function inspectionLines(order) {
    const received = receivedByLine(order?.iars);
    // Orders inspected before IARs recorded quantities count as fully received.
    const recorded = (order?.iars ?? []).some((iar) => (iar.items ?? []).length > 0);
    const legacyComplete = !recorded && (order?.iars ?? []).length > 0;

    return (order?.purchase_request?.items ?? []).map((item, index) => {
        const ordered = Number(item.quantity ?? 0);
        const got = legacyComplete ? ordered : Math.min(ordered, received[item.id] ?? 0);
        const unitCost = Number(item.bidding_unit_cost ?? item.estimated_unit_cost ?? 0);
        return {
            id: item.id ?? index,
            description: item.item_desc ?? item.item_name ?? '—',
            unit: item.unit ?? '',
            ordered,
            received: got,
            balance: Math.max(0, ordered - got),
            unitCost,
            amount: ordered * unitCost,
        };
    });
}

function progressOf(lines) {
    const ordered = lines.reduce((sum, line) => sum + line.ordered, 0);
    const received = lines.reduce((sum, line) => sum + line.received, 0);
    return {
        ordered,
        received,
        percent: ordered > 0 ? Math.round((received / ordered) * 100) : 0,
        linesDone: lines.filter((line) => line.balance === 0).length,
        linesOpen: lines.filter((line) => line.balance > 0).length,
    };
}

const totalOf = (lines) => lines.reduce((sum, line) => sum + line.amount, 0);

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function IarIndex({purchaseOrders, focusOrder, filters, counts}) {
    const {auth} = usePage().props;
    const permissions = auth?.permissions ?? [];

    const rows = useMemo(() => purchaseOrders?.data ?? [], [purchaseOrders]);
    const {view, search, setSearch, selected, setSelectedId, switchTab} = useOrderQueue({
        routeName: 'inspection-acceptance-reports.index', filters, defaultView: 'pending', rows, focusOrder,
    });

    const lines = useMemo(() => inspectionLines(selected), [selected]);
    const progress = useMemo(() => progressOf(lines), [lines]);
    const total = useMemo(() => totalOf(lines), [lines]);
    const iars = useMemo(() => selected?.iars ?? [], [selected]);
    const lineNames = useMemo(() => Object.fromEntries(lines.map((line) => [line.id, line])), [lines]);

    const pending = selected?.status === STATUS_FOR_INSPECTION;
    const held = isHeldByTags(selected);
    const office = selected?.purchase_request?.requester_department ?? '';

    /* ---------------- Generate dialog ---------------- */
    const [generating, setGenerating] = useState(false);
    const [processing, setProcessing] = useState(false);
    // quantities: received on this delivery, keyed by request line id.
    const [form, setForm] = useState({invoice_number: '', invoice_date: '', quantities: {}});
    const [itemFilter, setItemFilter] = useState('');

    // Every open line pre-filled with its balance: the common case is a full
    // delivery, and a short one only needs the missing lines lowered.
    const balances = useMemo(() => Object.fromEntries(lines.map((line) => [line.id, line.balance])), [lines]);

    // Reset whenever the order changes or a report is added to it. A refused
    // submit adds no report, so what was typed survives the error.
    useEffect(() => {
        setForm({invoice_number: '', invoice_date: '', quantities: balances});
        setItemFilter('');
        setGenerating(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id, selected?.iars?.length]);

    const openLines = useMemo(() => lines.filter((line) => line.balance > 0), [lines]);
    const visibleLines = useMemo(() => {
        const q = itemFilter.trim().toLowerCase();
        return q ? openLines.filter((line) => line.description.toLowerCase().includes(q)) : openLines;
    }, [openLines, itemFilter]);

    // What the order will be tagged once this report is generated — the same
    // sum the server does, shown before anything is saved.
    const outcome = useMemo(() => {
        let receiving = 0;
        let short = 0;
        let invalid = false;
        for (const line of openLines) {
            const value = form.quantities[line.id];
            const n = Number(value ?? 0);
            if (value === '' || !Number.isInteger(n) || n < 0 || n > line.balance) invalid = true;
            if (n > 0) receiving += 1;
            if (n < line.balance) short += 1;
        }
        return {receiving, short, invalid, status: short === 0 ? 'complete' : 'partial'};
    }, [openLines, form.quantities]);

    function setQuantity(id, value) {
        setForm((prev) => ({...prev, quantities: {...prev.quantities, [id]: value === '' ? '' : Number(value)}}));
    }

    // Act on what the filter shows, so a long list can be narrowed to "screws"
    // and set without touching the rest.
    function fillVisible(toBalance) {
        setForm((prev) => {
            const quantities = {...prev.quantities};
            for (const line of visibleLines) quantities[line.id] = toBalance ? line.balance : 0;
            return {...prev, quantities};
        });
    }

    function generate(e) {
        e.preventDefault();
        if (!selected?.id) return;
        setProcessing(true);
        router.post(route('inspection-acceptance-reports.generate', {purchaseOrder: selected.id}), {
            invoice_number: form.invoice_number.trim(),
            invoice_date: form.invoice_date,
            // Lines with nothing left to deliver are left out; zero is allowed
            // for a line that did not come in on this delivery.
            items: openLines.map((line) => ({id: line.id, quantity: Number(form.quantities[line.id] ?? 0)})),
        }, {
            preserveScroll: true,
            onFinish: () => setProcessing(false),
        });
    }

    function viewIar(iar) {
        window.open(route('inspection-acceptance-reports.view', {iar: iar.id}), '_blank', 'noopener,noreferrer');
    }

    const canGenerate = pending && !held && openLines.length > 0;

    return (
        <AuthenticatedLayout>
            <Head title="Inspection & Acceptance"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Inspection &amp; Acceptance
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Inspect each delivery against its invoice. A short delivery is recorded as partial and
                            waits here for the rest; a complete one moves on to RIS.
                        </p>
                    </div>
                    <QueueTabs tabs={TABS} active={view} counts={counts} onChange={switchTab}/>
                </div>

                {/* Master-detail */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr] lg:h-[calc(100vh-220px)] lg:min-h-[560px]">
                    {/* Left: queue */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden max-h-[70vh] lg:max-h-none">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search PO, IAR, invoice, office, supplier…"
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                            {rows.length > 0 ? rows.map((po) => {
                                const isActive = selected?.id === po.id;
                                const rowProgress = progressOf(inspectionLines(po));
                                const latest = (po.iars ?? [])[0];
                                return (
                                    <button
                                        key={po.id}
                                        type="button"
                                        onClick={() => setSelectedId(po.id)}
                                        aria-current={isActive ? 'true' : undefined}
                                        className={`w-full text-left px-4 py-3.5 transition-colors border-l-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${isActive ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-600' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/20'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold font-mono text-gray-900 dark:text-white truncate">
                                                {po.PO_Number || po.PR_Number}
                                            </span>
                                            <span className="text-[10px] text-gray-400 shrink-0">
                                                {view === 'inspected'
                                                    ? (latest ? formatDate(latest.created_at) : '')
                                                    : (po.received_at ? `Arrived ${formatDate(po.received_at)}` : '')}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                            {po.PO_Supplier || 'No supplier'}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            {po.delivery_status ? <DeliveryTag status={po.delivery_status}/> : (
                                                <span className="text-[10px] text-gray-400">Not yet inspected</span>
                                            )}
                                            {(po.iars ?? []).length > 0 && (
                                                <span className="text-[10px] font-medium text-gray-400 tabular-nums">
                                                    {po.iars.length} IAR{po.iars.length === 1 ? '' : 's'}
                                                </span>
                                            )}
                                            {view === 'inspected' && <StatusBadge status={po.status}/>}
                                        </div>
                                        {po.delivery_status === 'partial' && (
                                            <div className="mt-2 h-1 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
                                                <div className="h-full bg-amber-500" style={{width: `${rowProgress.percent}%`}}/>
                                            </div>
                                        )}
                                        {view === 'pending' && (po.open_tags ?? []).length > 0 && (
                                            <div className="mt-1.5"><OrderTagBadges order={po}/></div>
                                        )}
                                    </button>
                                );
                            }) : (
                                <div className="px-6 py-16 text-center">
                                    <ClipboardCheck className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {filters?.search ? 'No matches' : view === 'inspected' ? 'Nothing inspected yet' : 'Nothing waiting for inspection'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        {filters?.search
                                            ? 'Try a different search.'
                                            : view === 'inspected'
                                                ? 'Orders appear here once every item has been inspected.'
                                                : 'Orders arrive here once their delivery is accepted on Incoming.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {purchaseOrders?.links && purchaseOrders.links.length > 3 && (
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-center gap-1">
                                {purchaseOrders.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url || '#'}
                                        preserveState
                                        preserveScroll
                                        dangerouslySetInnerHTML={{__html: link.label}}
                                        className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${link.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/40'} ${!link.url ? 'opacity-50 pointer-events-none' : ''}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: detail */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden min-h-[400px]">
                        {!selected ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center px-6">
                                    <ClipboardCheck className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">No order selected</p>
                                    <p className="mt-1 text-xs text-gray-500">Choose an order from the list to review it.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 space-y-3">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                                                {selected.PO_Supplier || 'No supplier'}
                                            </p>
                                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                                                {selected.PO_Number || '—'}
                                            </h2>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {pending && <TagMissingButton order={selected}/>}
                                            <DeliveryTag status={selected.delivery_status}/>
                                            <StatusBadge status={selected.status}/>
                                        </div>
                                    </div>
                                    <Pipeline status={selected.status}/>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* How much of the order has arrived */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Delivery Progress
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{progress.percent}%</span>
                                                {' '}received · {progress.linesDone} of {lines.length} {lines.length === 1 ? 'line' : 'lines'} complete
                                            </p>
                                        </div>
                                        <div className="mt-3 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden"
                                             role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100}>
                                            <div
                                                className={`h-full rounded-full ${progress.percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                style={{width: `${progress.percent}%`}}
                                            />
                                        </div>
                                        {selected.delivery_status === 'partial' && (
                                            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
                                                {progress.linesOpen} {progress.linesOpen === 1 ? 'line still has' : 'lines still have'} a
                                                balance. Nothing can be issued until the rest is delivered and inspected.
                                            </p>
                                        )}
                                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <Detail label="Requesting office">{office || '—'}</Detail>
                                            <Detail label="Purchase request"><span className="font-mono">{selected.PR_Number}</span></Detail>
                                            <Detail label="PO issued">{formatDate(selected.PO_Date)}</Detail>
                                            <Detail label="Delivery accepted">
                                                {selected.received_at ? formatDate(selected.received_at) : 'Not recorded'}
                                                {personName(selected.received_by) && (
                                                    <span className="block text-[11px] font-normal text-gray-500">by {personName(selected.received_by)}</span>
                                                )}
                                            </Detail>
                                        </div>
                                    </div>

                                    {pending && <MissingTagsPanel order={selected}/>}

                                    {/* Reports so far, each with what that delivery brought */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Inspection Reports
                                            </p>
                                            <span className="text-[11px] text-gray-400">
                                                {iars.length} {iars.length === 1 ? 'report' : 'reports'}
                                            </span>
                                        </div>
                                        {iars.length === 0 ? (
                                            <p className="px-5 py-5 text-xs text-gray-400">
                                                No IAR yet. Generate one when the delivery has been inspected.
                                            </p>
                                        ) : (
                                            <ol className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                                {iars.map((iar) => (
                                                    <li key={iar.id} className="px-5 py-4">
                                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="flex flex-wrap items-center gap-2 text-xs font-semibold font-mono text-gray-900 dark:text-white">
                                                                    {iar.iar_number}
                                                                    <DeliveryTag status={iar.delivery_status}/>
                                                                </p>
                                                                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                                                    Invoice {iar.invoice_number || '—'}
                                                                    {iar.invoice_date && ` of ${formatDate(iar.invoice_date)}`}
                                                                    {' · '}Generated {formatDate(iar.created_at)}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => viewIar(iar)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                                            >
                                                                <FileText className="w-3.5 h-3.5"/>
                                                                View PDF
                                                            </button>
                                                        </div>
                                                        {(iar.items ?? []).length > 0 && (
                                                            <ul className="mt-2 flex flex-wrap gap-1.5">
                                                                {iar.items.map((row) => (
                                                                    <li key={row.id} className="px-2 py-0.5 rounded-md bg-gray-50 dark:bg-gray-900/40 text-[11px] text-gray-600 dark:text-gray-300">
                                                                        {lineNames[row.purchase_request_item_id]?.description ?? 'Item'}
                                                                        <span className="ml-1 font-semibold tabular-nums">
                                                                            × {qty.format(row.quantity_received)}
                                                                        </span>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        )}
                                                    </li>
                                                ))}
                                            </ol>
                                        )}
                                    </div>

                                    {/* Items */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Items
                                            </p>
                                            <span className="text-[11px] text-gray-400">
                                                {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                <tr className="border-b border-gray-100 dark:border-gray-700/40">
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Item</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Ordered</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Received</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Balance</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                                </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                                {lines.map((line) => (
                                                    <tr key={line.id}>
                                                        <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white">{line.description}</td>
                                                        <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-300 text-right tabular-nums whitespace-nowrap">
                                                            {qty.format(line.ordered)} {line.unit}
                                                        </td>
                                                        <td className="px-5 py-3 text-xs text-gray-900 dark:text-white text-right tabular-nums">
                                                            {qty.format(line.received)}
                                                        </td>
                                                        <td className={`px-5 py-3 text-xs text-right tabular-nums ${line.balance > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-400'}`}>
                                                            {line.balance > 0 ? qty.format(line.balance) : '—'}
                                                        </td>
                                                        <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white text-right tabular-nums">
                                                            {peso.format(line.amount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {lines.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-5 py-6 text-center text-xs text-gray-400">
                                                            No line items on this request.
                                                        </td>
                                                    </tr>
                                                )}
                                                </tbody>
                                                <tfoot>
                                                <tr className="border-t border-gray-100 dark:border-gray-700/40">
                                                    <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">
                                                        Order total
                                                    </td>
                                                    <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white text-right tabular-nums">
                                                        {peso.format(total)}
                                                    </td>
                                                </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-end gap-3">
                                    {pending ? (
                                        <>
                                            <HeldNotice order={selected} className="mr-auto"/>
                                            <button
                                                type="button"
                                                onClick={() => setGenerating(true)}
                                                disabled={!canGenerate}
                                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                                            >
                                                <ClipboardCheck className="w-4 h-4"/>
                                                {iars.length > 0 ? 'Record Next Delivery…' : 'Generate IAR…'}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                                                Fully inspected. The order is now at {STATUS_MAP[selected.status]?.label ?? 'a later stage'}.
                                            </p>
                                            {selected.status === STATUS_FOR_RIS && permissions.includes('inventory.ris') && (
                                                <Link
                                                    href={route('ris.index', {order: selected.id})}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                                >
                                                    Continue to RIS
                                                    <ArrowRight className="w-4 h-4"/>
                                                </Link>
                                            )}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Generate: one report per delivery, with what that delivery brought. */}
            <Modal show={generating && Boolean(selected)} onClose={() => !processing && setGenerating(false)} maxWidth="2xl">
                <form onSubmit={generate} className="bg-white dark:bg-gray-800 p-6 flex flex-col max-h-[90vh]">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {iars.length > 0 ? 'Record the next delivery' : 'Generate IAR'} — {selected?.PO_Number}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Enter the invoice and how many of each item arrived and passed inspection.
                    </p>

                    {iars.length > 0 && (
                        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                            Following {iars.map((iar) => iar.iar_number).join(', ')}. Quantities are limited to what is
                            still outstanding, and the invoice must differ from the ones already recorded.
                        </div>
                    )}

                    <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="invoice_number" className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                    Invoice No. <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="invoice_number"
                                    type="text"
                                    required
                                    autoFocus
                                    maxLength={255}
                                    placeholder="e.g. INV-2026-001"
                                    value={form.invoice_number}
                                    onChange={(e) => setForm({...form, invoice_number: e.target.value})}
                                    className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                    Invoice Date
                                </label>
                                <DateInput
                                    value={form.invoice_date}
                                    onChange={(e) => setForm({...form, invoice_date: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                    Quantity received
                                    <span className="ml-1 font-normal normal-case text-gray-400">
                                        ({outcome.receiving} of {openLines.length} outstanding {openLines.length === 1 ? 'line' : 'lines'})
                                    </span>
                                </p>
                                <div className="flex items-center gap-3 text-xs font-medium">
                                    <button type="button" onClick={() => fillVisible(true)} className="text-emerald-700 dark:text-emerald-400 hover:underline">
                                        Full balance{itemFilter ? ' (shown)' : ''}
                                    </button>
                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                    <button type="button" onClick={() => fillVisible(false)} className="text-gray-500 dark:text-gray-400 hover:underline">
                                        Zero{itemFilter ? ' (shown)' : ''}
                                    </button>
                                </div>
                            </div>
                            {openLines.length > 6 && (
                                <div className="relative mb-2">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                                    <input
                                        type="search"
                                        value={itemFilter}
                                        onChange={(e) => setItemFilter(e.target.value)}
                                        placeholder="Filter items…"
                                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                            )}
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
                                {visibleLines.length > 0 ? visibleLines.map((line) => {
                                    const value = form.quantities[line.id] ?? 0;
                                    const over = Number(value) > line.balance;
                                    return (
                                        <label key={line.id} className="flex items-center gap-3 px-3 py-2">
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{line.description}</span>
                                                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                                                    {qty.format(line.balance)} of {qty.format(line.ordered)} {line.unit} outstanding
                                                </span>
                                            </span>
                                            <input
                                                type="number"
                                                min={0}
                                                max={line.balance}
                                                step={1}
                                                value={value}
                                                onChange={(e) => setQuantity(line.id, e.target.value)}
                                                aria-label={`Quantity received of ${line.description}`}
                                                className={`w-20 shrink-0 text-right text-sm rounded-lg shadow-sm dark:bg-gray-900 dark:text-white ${over ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-emerald-500 focus:ring-emerald-500'}`}
                                            />
                                        </label>
                                    );
                                }) : (
                                    <p className="text-xs text-gray-400 text-center py-4">
                                        {itemFilter ? `No items match "${itemFilter}".` : 'Every item has been received.'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* What the order will be tagged once this report is generated. */}
                        {outcome.receiving > 0 && !outcome.invalid && (
                            <div className={`rounded-lg border p-3 text-xs ${outcome.status === 'complete'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'}`}>
                                <span className="mr-2"><DeliveryTag status={outcome.status}/></span>
                                {outcome.status === 'complete'
                                    ? 'Every item will be fully received. The order moves on to RIS.'
                                    : `${outcome.short} ${outcome.short === 1 ? 'line' : 'lines'} will still have a balance. The order stays here for the next delivery and cannot be issued yet.`}
                            </div>
                        )}
                        {outcome.invalid && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                                A quantity is empty, more than what is outstanding, or not a whole number.
                            </p>
                        )}
                    </div>

                    <div className="mt-5 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
                        <button
                            type="button"
                            onClick={() => setGenerating(false)}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || !form.invoice_number.trim() || outcome.receiving === 0 || outcome.invalid || held}
                            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {processing ? 'Generating…' : 'Generate IAR'}
                        </button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}

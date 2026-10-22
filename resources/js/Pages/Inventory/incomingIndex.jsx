import {Head, Link, router, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import Modal from '@/Components/Modal';
import {HeldNotice, isHeldByTags, MissingTagsPanel, OrderTagBadges, TagMissingButton, personName} from "@/Components/MissingTags.jsx";
import {Detail, Pipeline, QueueTabs, StatusBadge, peso, qty, useOrderQueue} from "@/Components/Inventory/OrderParts.jsx";
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {formatDate, parseDate} from "@/Utils/formatDate.js";
import {useMemo, useState} from "react";
import {ArrowRight, Inbox, PackageCheck, PackageOpen, Search} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
/** PO issued, delivery not yet accepted. */
const STATUS_INCOMING = 230;
const STATUS_FOR_INSPECTION = 300;

const TABS = [
    {key: 'awaiting', label: 'Awaiting Delivery'},
    {key: 'accepted', label: 'Accepted'},
];

/** "Oct. 14, 2026, 9:42 AM" — an acceptance is recorded to the minute. */
function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return null;
    const time = date.toLocaleTimeString('en-PH', {hour: 'numeric', minute: '2-digit'});
    return `${formatDate(date)}, ${time}`;
}

/** Days since the PO was issued, for spotting deliveries that are running late. */
function daysSince(value) {
    const date = parseDate(value);
    if (!date) return null;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

/** What the supplier is to deliver: the request's lines at the awarded price where there is one. */
function orderedLines(order) {
    return (order?.purchase_request?.items ?? []).map((item, index) => {
        const quantity = Number(item.quantity ?? 0);
        const unitCost = Number(item.bidding_unit_cost ?? item.estimated_unit_cost ?? 0);
        return {
            id: item.id ?? index,
            description: item.item_desc ?? item.item_name ?? '—',
            unit: item.unit ?? '',
            quantity,
            unitCost,
            amount: quantity * unitCost,
        };
    });
}

const totalOf = (lines) => lines.reduce((sum, line) => sum + line.amount, 0);

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function IncomingIndex({purchaseOrders, focusOrder, filters, counts}) {
    const {auth} = usePage().props;
    const permissions = auth?.permissions ?? [];

    const [confirming, setConfirming] = useState(false);
    const [processing, setProcessing] = useState(false);

    const rows = useMemo(() => purchaseOrders?.data ?? [], [purchaseOrders]);
    const {view, search, setSearch, selected, setSelectedId, switchTab} = useOrderQueue({
        routeName: 'inventory.index', filters, defaultView: 'awaiting', rows, focusOrder,
    });

    const lines = useMemo(() => orderedLines(selected), [selected]);
    const total = useMemo(() => totalOf(lines), [lines]);

    const awaiting = selected?.status === STATUS_INCOMING;
    const held = isHeldByTags(selected);
    const canAccept = awaiting && !held && Boolean(selected?.PO_Number) && lines.length > 0;
    const office = selected?.purchase_request?.requester_department ?? '';

    function accept() {
        if (!selected?.PO_Number) return;
        setProcessing(true);
        router.post(route('inventory.toIAR'), {PO_Number: selected.PO_Number}, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false);
                setConfirming(false);
            },
        });
    }

    return (
        <AuthenticatedLayout>
            <Head title="Incoming Requests"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Incoming Requests
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Purchase orders out with suppliers. Accept a delivery when the items arrive to send them
                            for inspection.
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
                                    placeholder="Search PO, PR, office, supplier…"
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                            {rows.length > 0 ? rows.map((po) => {
                                const isActive = selected?.id === po.id;
                                const waited = view === 'awaiting' ? daysSince(po.PO_Date) : null;
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
                                                {view === 'accepted'
                                                    ? (po.received_at ? formatDate(po.received_at) : 'Date not recorded')
                                                    : waited === null ? '' : waited === 0 ? 'Issued today' : `${waited}d since PO`}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                            {po.PO_Supplier || 'No supplier'}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2 min-w-0">
                                            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
                                                {peso.format(totalOf(orderedLines(po)))}
                                            </span>
                                            {view === 'accepted' ? (
                                                <StatusBadge status={po.status}/>
                                            ) : (
                                                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                    {po.purchase_request?.requester_department}
                                                </span>
                                            )}
                                        </div>
                                        {view === 'awaiting' && (po.open_tags ?? []).length > 0 && (
                                            <div className="mt-1.5"><OrderTagBadges order={po}/></div>
                                        )}
                                    </button>
                                );
                            }) : (
                                <div className="px-6 py-16 text-center">
                                    <Inbox className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {filters?.search ? 'No matches' : view === 'accepted' ? 'No deliveries accepted yet' : 'No deliveries expected'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        {filters?.search
                                            ? 'Try a different search.'
                                            : view === 'accepted'
                                                ? 'Orders appear here once their delivery is accepted.'
                                                : 'Orders arrive here once a PO number is generated.'}
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
                                    <Inbox className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
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
                                            {awaiting && <TagMissingButton order={selected}/>}
                                            {selected.received_at ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30">
                                                    <PackageCheck className="w-3.5 h-3.5"/>
                                                    Accepted {formatDate(selected.received_at)}
                                                </span>
                                            ) : (
                                                <StatusBadge status={selected.status}/>
                                            )}
                                        </div>
                                    </div>
                                    <Pipeline status={selected.status}/>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* The acceptance itself, once it has happened. */}
                                    {!awaiting && (
                                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5 p-5">
                                            <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-4">
                                                Delivery Accepted
                                            </p>
                                            {selected.received_at ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <Detail label="Accepted on">{formatDateTime(selected.received_at)}</Detail>
                                                    <Detail label="Accepted by">{personName(selected.received_by) ?? '—'}</Detail>
                                                    <Detail label="Now at">{STATUS_MAP[selected.status]?.label ?? '—'}</Detail>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                                    Accepted before acceptance dates were recorded, so when and by whom is not on file.
                                                    It is now at {STATUS_MAP[selected.status]?.label ?? 'a later stage'}.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                            Order Details
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <Detail label="Requesting office">{office || '—'}</Detail>
                                            <Detail label="Purchase request"><span className="font-mono">{selected.PR_Number}</span></Detail>
                                            <Detail label="PO issued">
                                                {formatDate(selected.PO_Date)}
                                                {awaiting && daysSince(selected.PO_Date) !== null && (
                                                    <span className="block text-[11px] font-normal text-gray-500">
                                                        {daysSince(selected.PO_Date) === 0 ? 'Today' : `${daysSince(selected.PO_Date)} days ago`}
                                                    </span>
                                                )}
                                            </Detail>
                                            <Detail label="Mode of procurement">{selected.purchase_request?.mode_of_procurement || '—'}</Detail>
                                            <Detail label="Order value"><span className="tabular-nums">{peso.format(total)}</span></Detail>
                                        </div>
                                        {selected.purchase_request?.remarks_or_notes && (
                                            <div className="mt-4">
                                                <Detail label="Purpose">
                                                    <span className="font-normal">{selected.purchase_request.remarks_or_notes}</span>
                                                </Detail>
                                            </div>
                                        )}
                                    </div>

                                    {/* Tags matter while the order waits here; afterwards they live on the later pages. */}
                                    {awaiting && <MissingTagsPanel order={selected}/>}

                                    {/* Items */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {awaiting ? 'Items to Expect' : 'Items Ordered'}
                                            </p>
                                            <span className="text-[11px] text-gray-400">
                                                {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                <tr className="border-b border-gray-100 dark:border-gray-700/40">
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-8">#</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Item</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Quantity</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Unit cost</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                                </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                                {lines.map((line, index) => (
                                                    <tr key={line.id}>
                                                        <td className="px-5 py-3 text-xs text-gray-400 tabular-nums">{index + 1}</td>
                                                        <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white">{line.description}</td>
                                                        <td className="px-5 py-3 text-xs text-gray-900 dark:text-white text-right tabular-nums whitespace-nowrap">
                                                            {qty.format(line.quantity)} {line.unit}
                                                        </td>
                                                        <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-300 text-right tabular-nums">
                                                            {peso.format(line.unitCost)}
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
                                                        Total
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
                                    {awaiting ? (
                                        <>
                                            <HeldNotice order={selected} className="mr-auto"/>
                                            <button
                                                type="button"
                                                onClick={() => setConfirming(true)}
                                                disabled={!canAccept || processing}
                                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                                            >
                                                <PackageOpen className="w-4 h-4"/>
                                                Accept Delivery…
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                                                Accepted. The order is now at {STATUS_MAP[selected.status]?.label ?? 'a later stage'}.
                                            </p>
                                            {selected.status === STATUS_FOR_INSPECTION && permissions.includes('inventory.iar') && (
                                                <Link
                                                    href={route('inspection-acceptance-reports.index')}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                                >
                                                    Continue to Inspection
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

            {/* Confirm: accepting sends the order on and cannot be undone from here. */}
            <Modal show={confirming && Boolean(selected)} onClose={() => !processing && setConfirming(false)} maxWidth="md">
                <div className="bg-white dark:bg-gray-800 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Accept the delivery for {selected?.PO_Number}?
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Confirm the items have arrived. The order moves to Inspection &amp; Acceptance, and today is
                        recorded as the date received.
                    </p>
                    <dl className="mt-4 divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                        {[
                            ['Supplier', selected?.PO_Supplier || '—'],
                            ['For', office || '—'],
                            ['Items', `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`],
                            ['Order value', <span key="t" className="tabular-nums font-semibold">{peso.format(total)}</span>],
                        ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                                <dd className="text-gray-900 dark:text-gray-100 text-right">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        Quantities are checked at inspection; a short delivery is recorded there as partial.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Not yet
                        </button>
                        <button
                            type="button"
                            onClick={accept}
                            disabled={processing || !canAccept}
                            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {processing ? 'Accepting…' : 'Accept delivery'}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

import {Head, Link, router, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import Modal from '@/Components/Modal';
import {HeldNotice, isHeldByTags, MissingTagsPanel, OrderTagBadges, TagMissingButton, personName} from "@/Components/MissingTags.jsx";
import {
    Detail, Pipeline, QueueTabs, StatusBadge, peso, qty, slipLines, totalOf, useOrderQueue,
} from "@/Components/Inventory/OrderParts.jsx";
import {formatDate, parseDate} from "@/Utils/formatDate.js";
import {useMemo, useState} from "react";
import {ClipboardCheck, ExternalLink, PackageCheck, Search, Truck} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
/** SSMI issued, waiting to be handed over. */
const STATUS_FOR_RELEASE = 550;

const TABS = [
    {key: 'ready', label: 'Ready to Release'},
    {key: 'released', label: 'Released'},
];

/** A release needs a name to hand the items to; the rest is optional. */
const EMPTY_RELEASE_FORM = {released_to: '', released_to_department: '', release_remarks: ''};

/** "Oct. 14, 2026, 9:42 AM" — a hand-over is recorded to the minute. */
function formatDateTime(value) {
    const date = parseDate(value);
    if (!date) return '—';
    const time = date.toLocaleTimeString('en-PH', {hour: 'numeric', minute: '2-digit'});
    return `${formatDate(date)}, ${time}`;
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function outgoingIndex({purchaseOrders, focusOrder, filters, counts}) {
    const {auth, offices: officeOptions} = usePage().props;
    const permissions = auth?.permissions ?? [];

    const [processing, setProcessing] = useState(false);
    const [releasing, setReleasing] = useState(false);
    const [form, setForm] = useState(EMPTY_RELEASE_FORM);
    const [errors, setErrors] = useState({});

    const rows = useMemo(() => purchaseOrders?.data ?? [], [purchaseOrders]);
    const {view, search, setSearch, selected, setSelectedId, switchTab} = useOrderQueue({
        routeName: 'inventory.outgoings', filters, defaultView: 'ready', rows, focusOrder,
    });

    // Lines that issued nothing are not handed over, so they are left off here.
    const lines = useMemo(() => slipLines(selected).filter((line) => line.issued > 0), [selected]);
    const total = useMemo(() => totalOf(lines), [lines]);

    const ready = selected?.status === STATUS_FOR_RELEASE;
    const held = isHeldByTags(selected);
    const canRelease = ready && !held && Boolean(selected?.SSMI_Number) && lines.length > 0;
    const office = selected?.purchase_request?.requester_department ?? '';

    function openRelease() {
        setErrors({});
        // Whoever collects is usually from the office that asked for the items.
        setForm({...EMPTY_RELEASE_FORM, released_to_department: office});
        setReleasing(true);
    }

    function closeRelease() {
        if (processing) return;
        setReleasing(false);
        setErrors({});
    }

    /** Releasing completes the order — there is no undo inside this module. */
    function confirmRelease(e) {
        e.preventDefault();
        if (!selected?.PO_Number || !form.released_to.trim()) return;
        setProcessing(true);
        router.post(route('inventory.outgoing.release'), {
            PO_Number: selected.PO_Number,
            released_to: form.released_to.trim(),
            released_to_department: form.released_to_department.trim() || null,
            release_remarks: form.release_remarks.trim() || null,
        }, {
            preserveScroll: true,
            onSuccess: () => setReleasing(false),
            onError: (errs) => setErrors(errs),
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <AuthenticatedLayout>
            <Head title="Outgoing Requests"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Outgoing Requests
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Hand issued items over to the requesting office. Recording who collected them completes
                            the order.
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
                                    placeholder={view === 'released' ? 'Search PO, SSMI, office, collected by…' : 'Search PO, PR, SSMI, office, supplier…'}
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                            {rows.length > 0 ? rows.map((po) => {
                                const isActive = selected?.id === po.id;
                                const orderTotal = totalOf(slipLines(po));
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
                                                {po.PO_Number}
                                            </span>
                                            <span className="text-[10px] text-gray-400 shrink-0">
                                                {formatDate(view === 'released' ? po.released_at : po.SSMI_Date)}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                            {po.purchase_request?.requester_department || 'No office'}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2 min-w-0">
                                            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
                                                {peso.format(orderTotal)}
                                            </span>
                                            {view === 'released' && po.released_to && (
                                                <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                    to {po.released_to}
                                                </span>
                                            )}
                                        </div>
                                        {view !== 'released' && (po.open_tags ?? []).length > 0 && (
                                            <div className="mt-1.5"><OrderTagBadges order={po}/></div>
                                        )}
                                    </button>
                                );
                            }) : (
                                <div className="px-6 py-16 text-center">
                                    <Truck className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {filters?.search ? 'No matches' : view === 'released' ? 'Nothing released yet' : 'Nothing waiting to be released'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        {filters?.search
                                            ? 'Try a different search.'
                                            : view === 'released'
                                                ? 'Orders appear here once they are handed over.'
                                                : 'Orders arrive here once their SSMI is issued.'}
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
                                    <Truck className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
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
                                                {office || 'No office'}
                                            </p>
                                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                                                {selected.PO_Number || '—'}
                                            </h2>
                                        </div>
                                        {selected.released_at ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30">
                                                <PackageCheck className="w-3.5 h-3.5"/>
                                                Released {formatDate(selected.released_at)}
                                            </span>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                {ready && <TagMissingButton order={selected}/>}
                                                <StatusBadge status={selected.status}/>
                                            </div>
                                        )}
                                    </div>
                                    <Pipeline status={selected.status}/>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* The hand-over itself, once it has happened. */}
                                    {selected.released_at && (
                                        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5 p-5">
                                            <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-4">
                                                Release Record
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <Detail label="Collected by">{selected.released_to}</Detail>
                                                <Detail label="Their office">{selected.released_to_department || '—'}</Detail>
                                                <Detail label="Released by">{personName(selected.released_by) ?? '—'}</Detail>
                                                <Detail label="Released on">{formatDateTime(selected.released_at)}</Detail>
                                            </div>
                                            {selected.release_remarks && (
                                                <div className="mt-4">
                                                    <Detail label="Remarks">
                                                        <span className="font-normal whitespace-pre-line">{selected.release_remarks}</span>
                                                    </Detail>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Order and the paper trail behind it */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                            Order and Documents
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <Detail label="Purchase request"><span className="font-mono">{selected.PR_Number}</span></Detail>
                                            <Detail label="Supplier">{selected.PO_Supplier || '—'}</Detail>
                                            <Detail label="Delivery accepted">{formatDate(selected.received_at)}</Detail>
                                            <Detail label="Inspected under">
                                                {(selected.iars ?? []).length > 0 ? (
                                                    <span className="flex flex-wrap gap-x-2 gap-y-1">
                                                        {[...selected.iars].reverse().map((iar) => (
                                                            <span key={iar.id} className="inline-flex items-center gap-1 font-mono">
                                                                <ClipboardCheck className="w-3 h-3 text-gray-400"/>
                                                                {iar.iar_number}
                                                            </span>
                                                        ))}
                                                    </span>
                                                ) : 'No IAR on record'}
                                            </Detail>
                                            <Detail label="RIS No.">
                                                <span className="font-mono">{selected.RIS_Number || '—'}</span>
                                                {selected.RIS_Date && <span className="block text-[11px] font-normal text-gray-500">{formatDate(selected.RIS_Date)}</span>}
                                            </Detail>
                                            <Detail label="SSMI No.">
                                                {selected.SSMI_Number ? (
                                                    <>
                                                        {permissions.includes('inventory.ssmi') ? (
                                                            <a
                                                                href={route('ssmi.document', selected.id)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 font-mono text-indigo-600 dark:text-indigo-400 hover:underline"
                                                            >
                                                                {selected.SSMI_Number}
                                                                <ExternalLink className="w-3 h-3"/>
                                                            </a>
                                                        ) : (
                                                            <span className="font-mono">{selected.SSMI_Number}</span>
                                                        )}
                                                        {selected.fund_source && <span className="block text-[11px] font-normal text-gray-500">Fund: {selected.fund_source}</span>}
                                                    </>
                                                ) : '—'}
                                            </Detail>
                                        </div>
                                        {selected.purchase_request?.remarks_or_notes && (
                                            <div className="mt-4">
                                                <Detail label="Purpose">
                                                    <span className="font-normal">{selected.purchase_request.remarks_or_notes}</span>
                                                </Detail>
                                            </div>
                                        )}
                                    </div>

                                    {/* A released order is complete; there is nothing left to hold. */}
                                    {!selected.released_at && <MissingTagsPanel order={selected}/>}

                                    {/* Items */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {selected.released_at ? 'Items Handed Over' : 'Items to Hand Over'}
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
                                                            {qty.format(line.issued)} {line.unit}
                                                            {line.issued < line.requested && (
                                                                <span className="block text-[10px] font-normal text-amber-700 dark:text-amber-400">
                                                                    of {qty.format(line.requested)} requested
                                                                </span>
                                                            )}
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
                                                            No items were issued on this order.
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
                                    {ready ? (
                                        <>
                                            <HeldNotice order={selected} className="mr-auto"/>
                                            {!held && !selected.SSMI_Number && (
                                                <p className="mr-auto text-[11px] text-amber-800 dark:text-amber-300">
                                                    This order has no SSMI number yet.
                                                </p>
                                            )}
                                            <button
                                                type="button"
                                                onClick={openRelease}
                                                disabled={!canRelease || processing}
                                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                                            >
                                                <Truck className="w-4 h-4"/>
                                                Release Items…
                                            </button>
                                        </>
                                    ) : selected.released_at ? (
                                        <p className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                                            Completed. Collected by {selected.released_to} on {formatDate(selected.released_at)}.
                                        </p>
                                    ) : (
                                        <p className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                                            This order is not waiting for release.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Release: the last step before the items leave the office, so it records
                who is collecting them rather than completing on one click. */}
            <Modal show={releasing && Boolean(selected)} onClose={closeRelease} maxWidth="lg">
                <form onSubmit={confirmRelease} className="bg-white dark:bg-gray-800 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Release {selected?.PO_Number}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        This completes the order. It cannot be undone from here.
                    </p>

                    <dl className="mt-4 divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                        {[
                            ['For', office || '—'],
                            ['Items', `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`],
                            ['Total', <span key="t" className="tabular-nums font-semibold">{peso.format(total)}</span>],
                        ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                                <dd className="text-gray-900 dark:text-gray-100 text-right">{value}</dd>
                            </div>
                        ))}
                    </dl>

                    <div className="mt-5 space-y-4">
                        <div>
                            <label htmlFor="released_to" className="mb-1 block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                                Collected by <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="released_to"
                                type="text"
                                required
                                autoFocus
                                maxLength={255}
                                placeholder="Name of the person collecting the items"
                                value={form.released_to}
                                onChange={(e) => setForm({...form, released_to: e.target.value})}
                                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            />
                            {errors.released_to && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.released_to}</p>}
                        </div>
                        <div>
                            <label htmlFor="released_to_department" className="mb-1 block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                                Their office
                            </label>
                            {/* Suggests the offices on the Requesting Offices screen; anything else may still be typed. */}
                            <datalist id="office-suggestions">
                                {(officeOptions ?? []).map((o) => <option key={o.code} value={o.name}/>)}
                            </datalist>
                            <input
                                id="released_to_department"
                                type="text"
                                list="office-suggestions"
                                maxLength={255}
                                value={form.released_to_department}
                                onChange={(e) => setForm({...form, released_to_department: e.target.value})}
                                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="release_remarks" className="mb-1 block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                                Remarks
                            </label>
                            <textarea
                                id="release_remarks"
                                rows={2}
                                maxLength={1000}
                                placeholder="Anything worth recording about the hand-over — a partial pick-up, a damaged item."
                                value={form.release_remarks}
                                onChange={(e) => setForm({...form, release_remarks: e.target.value})}
                                className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            />
                        </div>
                    </div>

                    {errors.PO_Number && (
                        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                            {errors.PO_Number}
                        </p>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeRelease}
                            disabled={processing}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                            Not yet
                        </button>
                        <button
                            type="submit"
                            disabled={processing || !form.released_to.trim() || !canRelease}
                            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {processing ? 'Releasing…' : 'Release and complete'}
                        </button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}

import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {Head, Link, router, usePage} from '@inertiajs/react';
import Modal from '@/Components/Modal';
import {HeldNotice, isHeldByTags, MissingTagsPanel, OrderTagBadges, TagMissingButton, personName} from "@/Components/MissingTags.jsx";
import {
    Detail, Pipeline, QueueTabs, StatusBadge, peso, qty, slipLines, totalOf, useOrderQueue,
} from "@/Components/Inventory/OrderParts.jsx";
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {formatDate} from "@/Utils/formatDate.js";
import {useMemo, useState} from "react";
import {ArrowRight, Check, ClipboardCheck, ExternalLink, FileText, PackageCheck, Search, Send} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
const STATUS_FOR_SSMI = 500;
const STATUS_FOR_OUTGOING = 550;

const TABS = [
    {key: 'pending', label: 'For SSMI'},
    {key: 'issued', label: 'Issued'},
];

/** The lines the SSMI prints: only what was actually issued. */
const issuedLines = (order) => slipLines(order).filter((line) => line.issued > 0);

function documentUrl(order) {
    return route('ssmi.document', order.id);
}

/** One of the two SSMI steps, as a numbered row with its state. */
function Step({number, title, state, children}) {
    const done = state === 'done';
    const current = state === 'current';
    return (
        <li className="flex gap-3">
            <span
                className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    done ? 'bg-emerald-600 text-white'
                        : current ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'}`}
                aria-hidden="true"
            >
                {done ? <Check className="w-3.5 h-3.5"/> : number}
            </span>
            <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${done || current ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                    {title}
                    <span className="sr-only">{done ? ' (done)' : current ? ' (current step)' : ''}</span>
                </p>
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{children}</div>
            </div>
        </li>
    );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function Index({purchaseOrders, focusOrder, filters, counts, fundSources = {}}) {
    const {auth} = usePage().props;
    const permissions = auth?.permissions ?? [];

    const rows = useMemo(() => purchaseOrders?.data ?? [], [purchaseOrders]);
    const {view, search, setSearch, selected, setSelectedId, switchTab} = useOrderQueue({
        routeName: 'ssmi.index', filters, defaultView: 'pending', rows, focusOrder,
    });

    const lines = useMemo(() => issuedLines(selected), [selected]);
    const total = useMemo(() => totalOf(lines), [lines]);
    const office = selected?.purchase_request?.requester_department ?? '';

    const atSsmi = selected?.status === STATUS_FOR_SSMI;
    const numbered = Boolean(selected?.SSMI_Number);
    const held = isHeldByTags(selected);
    const sentOn = Boolean(selected) && !atSsmi && numbered;

    /* ---------------- Dialogs ---------------- */
    // 'number' to generate the SSMI number, 'send' to hand the order to Outgoing.
    const [dialog, setDialog] = useState(null);
    const [processing, setProcessing] = useState(false);
    // Supplies are almost always charged to MOOE, so it is the starting choice.
    const defaultFund = 'MOOE' in fundSources ? 'MOOE' : (Object.keys(fundSources)[0] ?? '');
    const [fundSource, setFundSource] = useState(defaultFund);

    function openNumber() {
        setFundSource(defaultFund);
        setDialog('number');
    }

    function submit() {
        if (!selected) return;
        setProcessing(true);
        const done = {preserveScroll: true, onFinish: () => {
            setProcessing(false);
            setDialog(null);
        }};
        if (dialog === 'number') {
            router.post(route('ssmi.generateNumber', selected.PO_Number), {fund_source: fundSource}, done);
        } else {
            router.post(route('ssmi.toOutgoing', selected.id), {}, done);
        }
    }

    return (
        <AuthenticatedLayout>
            <Head title="SSMI"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Summary of Supplies and Materials Issued
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Number the SSMI for each issued order and charge it to its fund, then send the order on
                            to Outgoing.
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
                                    placeholder="Search SSMI, RIS, PO, office, supplier…"
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                            {rows.length > 0 ? rows.map((po) => {
                                const isActive = selected?.id === po.id;
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
                                                {po.SSMI_Number || po.PO_Number}
                                            </span>
                                            <span className="text-[10px] text-gray-400 shrink-0">
                                                {po.SSMI_Number ? formatDate(po.SSMI_Date) : `RIS ${formatDate(po.RIS_Date)}`}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                            {[po.SSMI_Number && po.PO_Number, po.purchase_request?.requester_department].filter(Boolean).join(' · ') || '—'}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2 min-w-0">
                                            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums shrink-0">
                                                {peso.format(totalOf(issuedLines(po)))}
                                            </span>
                                            {view === 'issued' ? (
                                                <StatusBadge status={po.status}/>
                                            ) : po.SSMI_Number ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                    Ready to send
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
                                                    Needs number
                                                </span>
                                            )}
                                        </div>
                                        {view === 'pending' && (po.open_tags ?? []).length > 0 && (
                                            <div className="mt-1.5"><OrderTagBadges order={po}/></div>
                                        )}
                                    </button>
                                );
                            }) : (
                                <div className="px-6 py-16 text-center">
                                    <PackageCheck className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {filters?.search ? 'No matches' : view === 'issued' ? 'No SSMI issued yet' : 'Nothing waiting for an SSMI'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        {filters?.search
                                            ? 'Try a different search.'
                                            : view === 'issued'
                                                ? 'SSMIs appear here once their order is sent to Outgoing.'
                                                : 'Orders arrive here once their RIS number is generated.'}
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
                                    <PackageCheck className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
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
                                        <div className="flex flex-wrap items-center gap-3">
                                            {atSsmi && <TagMissingButton order={selected}/>}
                                            {numbered ? (
                                                <div className="text-right">
                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">SSMI No.</p>
                                                    <p className="text-sm font-semibold font-mono text-emerald-700 dark:text-emerald-400">{selected.SSMI_Number}</p>
                                                </div>
                                            ) : (
                                                <StatusBadge status={selected.status}/>
                                            )}
                                        </div>
                                    </div>
                                    <Pipeline status={selected.status}/>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* The two steps of this stage */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                            SSMI Steps
                                        </p>
                                        <ol className="space-y-4">
                                            <Step number={1} title="Generate the SSMI number" state={numbered ? 'done' : 'current'}>
                                                {numbered ? (
                                                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <a
                                                            href={documentUrl(selected)}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 font-mono font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                                                        >
                                                            {selected.SSMI_Number}
                                                            <ExternalLink className="w-3 h-3"/>
                                                        </a>
                                                        <span>
                                                            on {formatDate(selected.SSMI_Date)}
                                                            {personName(selected.ssmi_numbered_by) && ` by ${personName(selected.ssmi_numbered_by)}`}
                                                        </span>
                                                        <span>
                                                            · Fund: {selected.fund_source
                                                                ? `${selected.fund_source} — ${fundSources[selected.fund_source] ?? selected.fund_source}`
                                                                : 'not recorded'}
                                                        </span>
                                                    </span>
                                                ) : 'Choose the fund the supplies are charged to. This takes the next SSMI number.'}
                                            </Step>
                                            <Step number={2} title="Send to Outgoing" state={sentOn ? 'done' : numbered ? 'current' : 'todo'}>
                                                {sentOn
                                                    ? `Sent on. The order is now at ${STATUS_MAP[selected.status]?.label ?? 'a later stage'}.`
                                                    : numbered
                                                        ? 'Print the SSMI for Accounting, then send the order to Outgoing for hand-over.'
                                                        : 'Available once the SSMI is numbered.'}
                                            </Step>
                                        </ol>
                                    </div>

                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                            Order and Documents
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <Detail label="Purchase request"><span className="font-mono">{selected.PR_Number}</span></Detail>
                                            <Detail label="Supplier">{selected.PO_Supplier || '—'}</Detail>
                                            <Detail label="Mode of procurement">{selected.purchase_request?.mode_of_procurement || '—'}</Detail>
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
                                            <Detail label="Delivery accepted">
                                                {selected.received_at ? formatDate(selected.received_at) : 'Not recorded'}
                                            </Detail>
                                        </div>
                                    </div>

                                    {atSsmi && <MissingTagsPanel order={selected}/>}

                                    {/* Items, as the SSMI prints them */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Supplies Issued
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
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Qty issued</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Unit cost</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Total cost</th>
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
                                    {atSsmi && <HeldNotice order={selected} className="mr-auto"/>}
                                    {!atSsmi && (
                                        <p className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                                            {sentOn ? `Sent to Outgoing. Now at ${STATUS_MAP[selected.status]?.label ?? 'a later stage'}.` : 'This order is not at the SSMI stage.'}
                                        </p>
                                    )}
                                    {numbered && (
                                        <a
                                            href={documentUrl(selected)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-900/40"
                                        >
                                            <FileText className="w-4 h-4"/>
                                            View SSMI
                                        </a>
                                    )}
                                    {atSsmi && !numbered && (
                                        <button
                                            type="button"
                                            onClick={openNumber}
                                            disabled={held || lines.length === 0 || processing}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                                        >
                                            <PackageCheck className="w-4 h-4"/>
                                            Generate SSMI Number…
                                        </button>
                                    )}
                                    {atSsmi && numbered && (
                                        <button
                                            type="button"
                                            onClick={() => setDialog('send')}
                                            disabled={held || processing}
                                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                                        >
                                            <Send className="w-4 h-4"/>
                                            Send to Outgoing…
                                        </button>
                                    )}
                                    {selected.status === STATUS_FOR_OUTGOING && permissions.includes('inventory.outgoing') && (
                                        <Link
                                            href={route('inventory.outgoings', {order: selected.id})}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                        >
                                            Continue to Outgoing
                                            <ArrowRight className="w-4 h-4"/>
                                        </Link>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Generate the number, or send the order on. Both cannot be undone from here. */}
            <Modal show={dialog !== null && Boolean(selected)} onClose={() => !processing && setDialog(null)} maxWidth="lg">
                <div className="bg-white dark:bg-gray-800 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {dialog === 'number' ? 'Generate the SSMI number?' : `Send ${selected?.PO_Number} to Outgoing?`}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {dialog === 'number'
                            ? 'This takes the next SSMI number and charges the supplies to the fund below. It cannot be undone from here.'
                            : `${selected?.SSMI_Number} is done. The order moves to Outgoing for hand-over to the requesting office.`}
                    </p>

                    <dl className="mt-4 divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                        {[
                            ['Purchase order', <span key="po" className="font-mono">{selected?.PO_Number}</span>],
                            ['RIS No.', <span key="ris" className="font-mono">{selected?.RIS_Number || '—'}</span>],
                            ['Issued to', office || '—'],
                            ['Supplies', `${lines.length} ${lines.length === 1 ? 'line' : 'lines'} · ${peso.format(total)}`],
                        ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                                <dd className="text-gray-900 dark:text-gray-100 text-right">{value}</dd>
                            </div>
                        ))}
                    </dl>

                    {dialog === 'number' && (
                        <fieldset className="mt-4">
                            <legend className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">Source of fund</legend>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {Object.entries(fundSources).map(([code, label]) => (
                                    <label
                                        key={code}
                                        className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${fundSource === code
                                            ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-500/60 dark:bg-emerald-500/10'
                                            : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/40'}`}
                                    >
                                        <input
                                            type="radio"
                                            name="fund_source"
                                            value={code}
                                            checked={fundSource === code}
                                            onChange={() => setFundSource(code)}
                                            className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span>
                                            <span className="block font-semibold text-gray-900 dark:text-white">{code}</span>
                                            <span className="block text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setDialog(null)}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={processing || held || (dialog === 'number' && !fundSource)}
                            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {processing ? 'Working…' : dialog === 'number' ? 'Generate SSMI number' : 'Send to Outgoing'}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

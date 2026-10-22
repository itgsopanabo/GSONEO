import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {Head, Link, router, usePage} from '@inertiajs/react';
import {useMemo, useState} from "react";
import {ArrowRight, ClipboardCheck, FileSpreadsheet, Search} from "lucide-react";
import Modal from '@/Components/Modal';
import {STATUS_MAP} from '@/Constants/statusConfig.js';
import {formatDate} from "@/Utils/formatDate.js";
import {HeldNotice, isHeldByTags, MissingTagsPanel, OrderTagBadges, TagMissingButton} from "@/Components/MissingTags.jsx";
import {
    Detail, Pipeline, QueueTabs, StatusBadge, peso, qty, slipLines, totalOf, useOrderQueue,
} from "@/Components/Inventory/OrderParts.jsx";

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */
const STATUS_FOR_RIS = 400;
const STATUS_FOR_SSMI = 500;

const TABS = [
    {key: 'pending', label: 'Awaiting RIS'},
    {key: 'issued', label: 'Issued'},
];

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function Index({purchaseOrders, focusOrder, filters, counts}) {
    const {auth} = usePage().props;
    const permissions = auth?.permissions ?? [];

    const [confirming, setConfirming] = useState(false);
    const [processing, setProcessing] = useState(false);

    const rows = useMemo(() => purchaseOrders?.data ?? [], [purchaseOrders]);
    const {view, search, setSearch, selected, setSelectedId, switchTab} = useOrderQueue({
        routeName: 'ris.index', filters, defaultView: 'pending', rows, focusOrder,
    });

    const lines = useMemo(() => slipLines(selected), [selected]);
    const total = useMemo(() => totalOf(lines), [lines]);
    const shortLines = lines.filter((line) => line.issued < line.requested).length;

    const pending = selected?.status === STATUS_FOR_RIS && !selected?.RIS_Number;
    const held = isHeldByTags(selected);
    const canIssue = pending && !held && lines.length > 0;

    function issue() {
        if (!selected?.id) return;
        setProcessing(true);
        router.post(route('ris.generateNumber', selected.id), {}, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false);
                setConfirming(false);
            },
        });
    }

    return (
        <AuthenticatedLayout>
            <Head title="Requisition and Issue Slip"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            Requisition &amp; Issue Slip
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Issue fully inspected deliveries to the requesting office. Each slip takes the next RIS
                            number and sends the order on to SSMI.
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
                                    placeholder={view === 'issued' ? 'Search RIS, PO, PR, office, supplier…' : 'Search PO, PR, office, supplier…'}
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
                                                {view === 'issued' ? po.RIS_Number : po.PO_Number}
                                            </span>
                                            <span className="text-[10px] text-gray-400 shrink-0">
                                                {formatDate(view === 'issued' ? po.RIS_Date : po.updated_at)}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                            {[view === 'issued' && po.PO_Number, po.purchase_request?.requester_department].filter(Boolean).join(' · ') || '—'}
                                        </p>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                                                {peso.format(orderTotal)}
                                            </span>
                                            {view === 'issued' && <StatusBadge status={po.status}/>}
                                        </div>
                                        {(po.open_tags ?? []).length > 0 && (
                                            <div className="mt-1.5"><OrderTagBadges order={po}/></div>
                                        )}
                                    </button>
                                );
                            }) : (
                                <div className="px-6 py-16 text-center">
                                    <FileSpreadsheet className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {filters?.search ? 'No matches' : view === 'issued' ? 'No slips issued yet' : 'Nothing waiting for an RIS'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        {filters?.search
                                            ? 'Try a different search.'
                                            : view === 'issued'
                                                ? 'Slips appear here once an RIS number is generated.'
                                                : 'Orders arrive here once every item has been delivered and inspected.'}
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
                                    <FileSpreadsheet className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
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
                                                {selected.PO_Supplier || 'Unknown supplier'}
                                            </p>
                                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">
                                                {selected.PO_Number || '—'}
                                            </h2>
                                        </div>
                                        {selected.RIS_Number ? (
                                            <div className="text-right">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">RIS No.</p>
                                                <p className="text-sm font-semibold font-mono text-emerald-700 dark:text-emerald-400">{selected.RIS_Number}</p>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Issued {formatDate(selected.RIS_Date)}</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-2">
                                                {pending && <TagMissingButton order={selected}/>}
                                                <StatusBadge status={selected.status}/>
                                            </div>
                                        )}
                                    </div>
                                    <Pipeline status={selected.status}/>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                            Issue Details
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <Detail label="Requesting office">{selected.purchase_request?.requester_department}</Detail>
                                            <Detail label="Purchase request"><span className="font-mono">{selected.PR_Number}</span></Detail>
                                            <Detail label="PO date">{formatDate(selected.PO_Date)}</Detail>
                                            <Detail label="Inspected under">
                                                {(selected.iars ?? []).length > 0 ? (
                                                    <span className="flex flex-wrap gap-1">
                                                        {[...selected.iars].reverse().map((iar) => (
                                                            <span key={iar.id} className="inline-flex items-center gap-1 font-mono">
                                                                <ClipboardCheck className="w-3 h-3 text-gray-400"/>
                                                                {iar.iar_number}
                                                            </span>
                                                        ))}
                                                    </span>
                                                ) : 'No IAR on record'}
                                            </Detail>
                                            <Detail label="Delivery">
                                                {selected.delivery_status === 'complete' ? 'Complete'
                                                    : selected.delivery_status === 'partial' ? 'Partial (accepted short)'
                                                        : '—'}
                                            </Detail>
                                            <Detail label="Total to issue"><span className="tabular-nums">{peso.format(total)}</span></Detail>
                                        </div>
                                    </div>

                                    <MissingTagsPanel order={selected}/>

                                    {/* Items */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Items to Issue
                                            </p>
                                            <span className="text-[11px] text-gray-400">
                                                {lines.length} {lines.length === 1 ? 'line' : 'lines'}
                                            </span>
                                        </div>
                                        {shortLines > 0 && (
                                            <p className="px-5 py-2 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-500/5 border-b border-amber-100 dark:border-amber-500/20">
                                                {shortLines} {shortLines === 1 ? 'line issues' : 'lines issue'} less than requested — only what was received and inspected is issued.
                                            </p>
                                        )}
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                <tr className="border-b border-gray-100 dark:border-gray-700/40">
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-8">#</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Item</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Requested</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Issued</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Unit cost</th>
                                                    <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                                </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                                {lines.map((line) => (
                                                    <tr key={line.id}>
                                                        <td className="px-5 py-3 text-xs text-gray-400 tabular-nums">{line.line}</td>
                                                        <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white">{line.description}</td>
                                                        <td className="px-5 py-3 text-xs text-gray-500 dark:text-gray-400 text-right tabular-nums whitespace-nowrap">
                                                            {qty.format(line.requested)} {line.unit}
                                                        </td>
                                                        <td className={`px-5 py-3 text-xs text-right tabular-nums whitespace-nowrap ${line.issued < line.requested ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                                                            {qty.format(line.issued)} {line.unit}
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
                                                        <td colSpan={6} className="px-5 py-6 text-center text-xs text-gray-400">
                                                            No line items on this request. Add them on the PR before issuing.
                                                        </td>
                                                    </tr>
                                                )}
                                                </tbody>
                                                <tfoot>
                                                <tr className="border-t border-gray-100 dark:border-gray-700/40">
                                                    <td colSpan={5} className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">
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
                                    {pending ? (
                                        <>
                                            <HeldNotice order={selected} className="mr-auto"/>
                                            <button
                                                type="button"
                                                onClick={() => setConfirming(true)}
                                                disabled={!canIssue || processing}
                                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                                            >
                                                <FileSpreadsheet className="w-4 h-4"/>
                                                Generate RIS Number
                                            </button>
                                        </>
                                    ) : selected.RIS_Number ? (
                                        <>
                                            <p className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                                                {selected.status === STATUS_FOR_SSMI
                                                    ? 'Issued. The order is waiting for its SSMI.'
                                                    : `Issued. The order is now at ${STATUS_MAP[selected.status]?.label ?? 'a later stage'}.`}
                                            </p>
                                            {selected.status === STATUS_FOR_SSMI && permissions.includes('inventory.ssmi') && (
                                                <Link
                                                    href={route('ssmi.index')}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                                >
                                                    Continue to SSMI
                                                    <ArrowRight className="w-4 h-4"/>
                                                </Link>
                                            )}
                                        </>
                                    ) : (
                                        <p className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                                            This order is not waiting for an RIS.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm: the number is sequential and cannot be taken back. */}
            <Modal show={confirming && Boolean(selected)} onClose={() => !processing && setConfirming(false)} maxWidth="md">
                <div className="bg-white dark:bg-gray-800 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Generate the RIS number?</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        This takes the next RIS number and moves the order on to SSMI. It cannot be undone from here.
                    </p>
                    <dl className="mt-4 divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                        {[
                            ['Purchase order', <span key="po" className="font-mono">{selected?.PO_Number}</span>],
                            ['Issued to', selected?.purchase_request?.requester_department || '—'],
                            ['Lines', `${lines.length}${shortLines ? ` (${shortLines} short of request)` : ''}`],
                            ['Total', <span key="t" className="tabular-nums font-semibold">{peso.format(total)}</span>],
                        ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                                <dd className="text-gray-900 dark:text-gray-100 text-right">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={issue}
                            disabled={processing || !canIssue}
                            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {processing ? 'Generating…' : 'Generate RIS number'}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

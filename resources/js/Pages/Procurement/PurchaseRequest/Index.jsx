import {Head, Link, router, usePage} from '@inertiajs/react';
import {useMemo, useState} from 'react';
import {ArrowRight, Check, Copy, FileText, Plus, Printer, Search, ShieldCheck, X} from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx';
import Modal from '@/Components/Modal';
import ItemDescription from '@/Components/ItemDescripiton.jsx';
import {Detail, QueueTabs, StatusBadge, peso, qty, useOrderQueue} from '@/Components/Inventory/OrderParts.jsx';
import {formatDate, formatDateTime, parseDate} from '@/Utils/formatDate.js';

/**
 * COST FIELDS
 * -----------
 * `estimated_unit_cost` is the price of one unit. `total_estimated_cost` is the
 * line total (quantity × unit cost), computed server-side — so sums add
 * `total_estimated_cost` directly and never multiply by quantity again.
 * Laravel's decimal cast serializes to a string, hence the Number() wrappers.
 */
const totalOf = (items) => (items || []).reduce((sum, item) => sum + Number(item.total_estimated_cost || 0), 0);

const STATUS_PENDING = 1;
const STATUS_DECLINED = 700;

function personName(user) {
    if (!user) return null;
    return [user.emp_fname, user.emp_lname].filter(Boolean).join(' ') || null;
}

/** Whole days since a date. */
function daysSince(value) {
    const date = parseDate(value);
    return date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000)) : null;
}

/** A week waiting is worth a look; two weeks is overdue. Same scale as the other pages. */
function ageStyle(days) {
    if (days >= 14) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    if (days >= 7) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300';
}

const inputClass = 'w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500';

export default function Index({purchaseRequests, focusOrder, filters, tabs = [], departments = []}) {
    const {auth} = usePage().props;
    const permissions = auth?.permissions ?? [];
    const can = (permission) => permissions.includes(permission);

    const rows = useMemo(() => purchaseRequests?.data ?? [], [purchaseRequests]);
    const {view, search, setSearch, selected, setSelectedId, switchTab} = useOrderQueue({
        routeName: 'purchase-requests.index', filters, defaultView: tabs[0]?.key, rows, focusOrder,
    });
    const counts = Object.fromEntries(tabs.map((tab) => [tab.key, tab.count]));

    const [processing, setProcessing] = useState(false);
    const [dialog, setDialog] = useState(null);   // 'verify' | 'decline' | 'create'
    const [reason, setReason] = useState('');
    const [createForm, setCreateForm] = useState({requester_department: '', remarks_or_notes: ''});
    const [createErrors, setCreateErrors] = useState({});
    const [created, setCreated] = useState(null);

    const items = selected?.items ?? [];
    const total = totalOf(items);
    const canDecide = selected?.status === STATUS_PENDING && can('pr.verify');

    function close() {
        if (!processing) setDialog(null);
    }

    function verify() {
        setProcessing(true);
        router.post(route('purchase-requests.verify', {purchase_request: selected.id}), {}, {
            preserveScroll: true,
            onSuccess: () => setDialog(null),
            onFinish: () => setProcessing(false),
        });
    }

    function decline() {
        if (!reason.trim()) return;
        setProcessing(true);
        router.post(route('purchase-requests.decline', {purchase_request: selected.id}), {reason_to_decline: reason.trim()}, {
            preserveScroll: true,
            onSuccess: () => setDialog(null),
            onFinish: () => setProcessing(false),
        });
    }

    function openCreate() {
        const section = auth?.user?.role?.section ?? '';
        setCreateErrors({});
        setCreateForm({requester_department: departments.includes(section) ? section : '', remarks_or_notes: ''});
        setDialog('create');
    }

    function submitCreate(e) {
        e.preventDefault();
        setProcessing(true);
        setCreateErrors({});
        router.post(route('purchase-requests.store'), {
            requester_department: createForm.requester_department.trim(),
            remarks_or_notes: createForm.remarks_or_notes.trim(),
        }, {
            preserveScroll: true,
            onSuccess: (page) => {
                setDialog(null);
                if (page.props.flash?.created_pr) setCreated(page.props.flash.created_pr);
            },
            onError: (errors) => setCreateErrors(errors),
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <AuthenticatedLayout>
            <Head title="Purchase Requests"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Purchase Requests</h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            File requests, and verify or decline the ones submitted by the departments.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {tabs.length > 0 && <QueueTabs tabs={tabs} active={view} counts={counts} onChange={switchTab}/>}
                        {can('pr.create') && (
                            <button
                                type="button"
                                onClick={openCreate}
                                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                            >
                                <Plus className="w-4 h-4"/>
                                New request
                            </button>
                        )}
                    </div>
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
                                    placeholder="Search PR number, office or purpose…"
                                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                            {rows.length > 0 ? rows.map((pr) => {
                                const isActive = selected?.id === pr.id;
                                const days = daysSince(pr.created_at);
                                const waiting = pr.status === STATUS_PENDING || pr.status === 0;
                                return (
                                    <button
                                        key={pr.id}
                                        type="button"
                                        onClick={() => setSelectedId(pr.id)}
                                        aria-current={isActive ? 'true' : undefined}
                                        className={`w-full text-left px-4 py-3.5 transition-colors border-l-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${isActive ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-600' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/20'}`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold font-mono text-gray-900 dark:text-white truncate">{pr.pr_number}</span>
                                            {waiting && days !== null ? (
                                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${ageStyle(days)}`}>
                                                    {days === 0 ? 'Today' : `${days}d`}
                                                </span>
                                            ) : (
                                                <span className="shrink-0 text-[10px] text-gray-400">{formatDate(pr.created_at)}</span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">{pr.requester_department || 'No department'}</p>
                                        <div className="mt-1.5 flex items-center gap-2 min-w-0">
                                            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 tabular-nums shrink-0">{peso.format(totalOf(pr.items))}</span>
                                            {view === 'verified' && <StatusBadge status={pr.status}/>}
                                        </div>
                                        {pr.remarks_or_notes && (
                                            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 truncate">{pr.remarks_or_notes}</p>
                                        )}
                                    </button>
                                );
                            }) : (
                                <div className="px-6 py-16 text-center">
                                    <FileText className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        {filters?.search ? 'No matches' : view === 'pending' ? 'Nothing waiting for verification' : 'Nothing here'}
                                    </p>
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        {filters?.search ? 'Try a different search.' : view === 'pending' ? 'Submitted requests appear here.' : 'Try another tab.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {purchaseRequests?.links && purchaseRequests.links.length > 3 && (
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-center gap-1">
                                {purchaseRequests.links.map((link, index) => (
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
                                    <FileText className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">No request selected</p>
                                    <p className="mt-1 text-xs text-gray-500">Choose a request from the list to review it.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">{selected.requester_department || 'No department'}</p>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white font-mono">{selected.pr_number}</h2>
                                        <div className="mt-1.5"><StatusBadge status={selected.status}/></div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <a
                                            href={route('purchase-requests.pdf', selected.id)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900/40"
                                        >
                                            <Printer className="w-3.5 h-3.5"/>
                                            PDF
                                        </a>
                                        {can('monitoring.view') && (
                                            <Link
                                                href={route('request-monitoring.show', selected.id)}
                                                className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                                            >
                                                Timeline
                                                <ArrowRight className="w-3.5 h-3.5"/>
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {selected.status === STATUS_DECLINED && (
                                        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/5 p-5">
                                            <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wider">Declined</p>
                                            <p className="mt-2 text-sm text-rose-900 dark:text-rose-200">{selected.reason_to_decline || 'No reason recorded.'}</p>
                                            <p className="mt-1 text-[11px] text-rose-700/80 dark:text-rose-300/80">
                                                {formatDateTime(selected.declined_At)}
                                                {personName(selected.declined_by) && ` by ${personName(selected.declined_by)}`}
                                            </p>
                                        </div>
                                    )}

                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Request</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <Detail label="Filed">
                                                {formatDate(selected.created_at)}
                                                <span className="block text-[11px] font-normal text-gray-500">
                                                    {daysSince(selected.created_at) === 0 ? 'Today' : `${daysSince(selected.created_at)} days ago`}
                                                </span>
                                            </Detail>
                                            <Detail label="Encoded by">
                                                {personName(selected.encoder) ?? '—'}
                                                {selected.encoded_at && <span className="block text-[11px] font-normal text-gray-500">{formatDate(selected.encoded_at)}</span>}
                                            </Detail>
                                            <Detail label="Verified by">
                                                {personName(selected.verified_by) ?? (selected.status === STATUS_PENDING ? 'Waiting' : '—')}
                                                {selected.verified_At && <span className="block text-[11px] font-normal text-gray-500">{formatDate(selected.verified_At)}</span>}
                                            </Detail>
                                            <Detail label="Mode of procurement">{selected.mode_of_procurement || 'Not yet tagged'}</Detail>
                                        </div>
                                        <div className="mt-4">
                                            <Detail label="Purpose">
                                                <span className="font-normal whitespace-pre-line">{selected.remarks_or_notes || '—'}</span>
                                            </Detail>
                                        </div>
                                    </div>

                                    {/* Items */}
                                    <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Items requested</p>
                                            <span className="text-[11px] text-gray-400">{items.length} {items.length === 1 ? 'line' : 'lines'}</span>
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
                                                {items.map((item, index) => (
                                                    <tr key={item.id ?? index}>
                                                        <td className="px-5 py-3 text-xs text-gray-400 tabular-nums align-top">{index + 1}</td>
                                                        <td className="px-5 py-3 text-xs align-top"><ItemDescription text={item.item_desc}/></td>
                                                        <td className="px-5 py-3 text-xs text-gray-900 dark:text-white text-right tabular-nums whitespace-nowrap align-top">
                                                            {qty.format(Number(item.quantity ?? 0))} {item.unit || ''}
                                                        </td>
                                                        <td className="px-5 py-3 text-xs text-gray-600 dark:text-gray-300 text-right tabular-nums align-top">
                                                            {peso.format(Number(item.estimated_unit_cost ?? 0))}
                                                        </td>
                                                        <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white text-right tabular-nums align-top">
                                                            {peso.format(Number(item.total_estimated_cost ?? 0))}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {items.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-5 py-6 text-center text-xs text-gray-400">
                                                            No line items yet — they are added when the request is encoded.
                                                        </td>
                                                    </tr>
                                                )}
                                                </tbody>
                                                <tfoot>
                                                <tr className="border-t border-gray-100 dark:border-gray-700/40">
                                                    <td colSpan={4} className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Estimated total</td>
                                                    <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white text-right tabular-nums">{peso.format(total)}</td>
                                                </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-end gap-3">
                                    {canDecide ? (
                                        <>
                                            <p className="mr-auto text-[11px] text-gray-500 dark:text-gray-400">
                                                Check the items and purpose, then verify or decline.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setReason('');
                                                    setDialog('decline');
                                                }}
                                                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 rounded-full hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                            >
                                                <X className="w-4 h-4"/>
                                                Decline…
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDialog('verify')}
                                                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm"
                                            >
                                                <ShieldCheck className="w-4 h-4"/>
                                                Verify…
                                            </button>
                                        </>
                                    ) : (
                                        <p className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                                            {selected.status === 0 && 'A draft. It reaches this queue once the encoder submits it.'}
                                            {selected.status === STATUS_PENDING && 'Waiting for someone with the verify permission.'}
                                            {selected.status === STATUS_DECLINED && 'Declined. The department can file a new request.'}
                                            {[100, 110, 120, 130, 200, 205].includes(selected.status) && 'Verified. It continues in Canvas Forms.'}
                                        </p>
                                    )}
                                    {[100, 110, 120, 130, 200, 205].includes(selected.status) && can('pr.canvass') && (
                                        <Link
                                            href={route('canvas.index')}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                        >
                                            Continue to Canvas Forms
                                            <ArrowRight className="w-4 h-4"/>
                                        </Link>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Verify */}
            <Modal show={dialog === 'verify' && Boolean(selected)} onClose={close} maxWidth="md">
                <div className="bg-white dark:bg-gray-800 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verify {selected?.pr_number}?</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">It is marked verified in your name and moves on to canvassing.</p>
                    <dl className="mt-4 divide-y divide-gray-100 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
                        {[
                            ['Office', selected?.requester_department || '—'],
                            ['Items', `${items.length} ${items.length === 1 ? 'line' : 'lines'}`],
                            ['Estimated total', <span key="t" className="tabular-nums font-semibold">{peso.format(total)}</span>],
                        ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
                                <dd className="text-gray-900 dark:text-gray-100 text-right">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={close} disabled={processing} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="button" onClick={verify} disabled={processing} className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                            {processing ? 'Verifying…' : 'Verify request'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Decline */}
            <Modal show={dialog === 'decline' && Boolean(selected)} onClose={close} maxWidth="md">
                <div className="bg-white dark:bg-gray-800 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Decline {selected?.pr_number}?</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The office sees your reason. A declined request cannot be reopened; they file a new one.</p>
                    <label htmlFor="decline-reason" className="mt-4 block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Reason</label>
                    <textarea
                        id="decline-reason"
                        rows={3}
                        autoFocus
                        maxLength={1000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Items are not in the approved procurement plan."
                        className={`${inputClass} focus:border-rose-500 focus:ring-rose-500`}
                    />
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={close} disabled={processing} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="button" onClick={decline} disabled={processing || !reason.trim()} className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50">
                            {processing ? 'Declining…' : 'Decline request'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* New request */}
            <Modal show={dialog === 'create'} onClose={close} maxWidth="lg">
                <form onSubmit={submitCreate} className="bg-white dark:bg-gray-800 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New purchase request</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Choose the requesting office and say what it is for. Items are added when it is encoded.</p>
                    <div className="mt-5 space-y-4">
                        <div>
                            <label htmlFor="pr-dept" className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Requesting office</label>
                            <select
                                id="pr-dept"
                                required
                                value={createForm.requester_department}
                                onChange={(e) => setCreateForm({...createForm, requester_department: e.target.value})}
                                className={inputClass}
                            >
                                <option value="">Select an office…</option>
                                {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                            </select>
                            {createErrors.requester_department && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{createErrors.requester_department}</p>}
                        </div>
                        <div>
                            <label htmlFor="pr-purpose" className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">Purpose</label>
                            <textarea
                                id="pr-purpose"
                                required
                                rows={3}
                                value={createForm.remarks_or_notes}
                                onChange={(e) => setCreateForm({...createForm, remarks_or_notes: e.target.value})}
                                placeholder="What this purchase is for…"
                                className={inputClass}
                            />
                            {createErrors.remarks_or_notes && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{createErrors.remarks_or_notes}</p>}
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={close} disabled={processing} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || !createForm.requester_department.trim() || !createForm.remarks_or_notes.trim()}
                            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {processing ? 'Creating…' : 'Create request'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* The number the new request was given */}
            <Modal show={created !== null} onClose={() => setCreated(null)} maxWidth="sm">
                <div className="bg-white dark:bg-gray-800 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400"/>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Request created</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">It was given this number, and is open in the Drafts tab.</p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <span className="font-mono text-base font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">{created?.pr_number}</span>
                        <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(created?.pr_number ?? '')}
                            aria-label="Copy the PR number"
                            className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-900/40"
                        >
                            <Copy className="h-3.5 w-3.5"/>
                        </button>
                    </div>
                    <button type="button" onClick={() => setCreated(null)} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                        Done
                    </button>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

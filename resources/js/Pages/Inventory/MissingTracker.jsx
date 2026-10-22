import {useEffect, useRef, useState} from 'react';
import {Head, Link, router, usePage} from '@inertiajs/react';
import {Bell, CheckCircle2, CircleAlert, Clock, Lock, Search} from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx';
import {QueueTabs, StatusBadge} from '@/Components/Inventory/OrderParts.jsx';
import {formatDate, parseDate} from '@/Utils/formatDate.js';
import {TAG_COLORS, TagChip, personName, tagHolds} from '@/Components/MissingTags.jsx';

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/**
 * Each stage an order can be tagged at: its short name, and where it is worked
 * on so a tag can be followed straight to the order. A link is only offered
 * when the viewer can open that page.
 */
const STAGES = [
    {code: 230, label: 'Incoming', permission: 'inventory.incoming', href: (po) => route('inventory.index', {order: po.id})},
    {code: 300, label: 'Inspection', permission: 'inventory.iar', href: (po) => route('inspection-acceptance-reports.index', {order: po.id})},
    {code: 400, label: 'RIS', permission: 'inventory.ris', href: (po) => route('ris.index', {order: po.id})},
    {code: 500, label: 'SSMI', permission: 'inventory.ssmi', href: (po) => route('ssmi.index', {order: po.id})},
    {code: 550, label: 'Outgoing', permission: 'inventory.outgoing', href: (po) => route('inventory.outgoings', {order: po.id})},
    {code: 600, label: 'Released', permission: 'inventory.outgoing', href: (po) => route('inventory.outgoings', {view: 'released', order: po.id})},
];

const TABS = [
    {key: 'open', label: 'Open'},
    {key: 'resolved', label: 'Resolved'},
];

const DAY = 86400000;

function daysSince(value) {
    const date = parseDate(value);
    return date ? Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY)) : null;
}

function ageLabel(days) {
    if (days === null) return '—';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
}

/** A week open is worth a look; two weeks is overdue. */
function ageStyle(days) {
    if (days >= 14) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
    if (days >= 7) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300';
}

function Stat({icon: Icon, label, value, hint, tone = 'text-gray-900 dark:text-white'}) {
    return (
        <div className="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800 shadow-sm px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <Icon className="w-3.5 h-3.5"/>
                {label}
            </p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
            {hint && <p className="text-[11px] text-gray-400 truncate">{hint}</p>}
        </div>
    );
}

const selectClass = 'text-xs rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 focus:border-indigo-400 focus:ring-indigo-500/40';

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */
export default function MissingTracker({entries, tags, stages = {}, stats, filters}) {
    const {auth} = usePage().props;
    const permissions = auth?.permissions ?? [];

    const [search, setSearch] = useState(filters.search ?? '');
    const [resolving, setResolving] = useState(null);
    const [resolutionNote, setResolutionNote] = useState('');
    const [processing, setProcessing] = useState(false);

    const isOpen = filters.state === 'open';
    const rows = entries?.data ?? [];
    const oldestDays = daysSince(stats?.oldest_open_at);

    function apply(changes) {
        const next = {...filters, search: search.trim(), ...changes, page: undefined};
        // Leave defaults out of the address bar.
        const query = Object.fromEntries(Object.entries(next).filter(([key, value]) =>
            value !== undefined && value !== null && value !== ''
            && !(key === 'state' && value === 'open')
            && !(key === 'sort' && value === (next.state === 'resolved' ? 'newest' : 'oldest'))));
        router.get(route('missing-tracker.index'), query, {preserveState: true, preserveScroll: true, replace: true});
    }

    // Search as you type, on the server, so it covers every page.
    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return undefined;
        }
        const timer = setTimeout(() => apply({}), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    function resolve(entry) {
        setProcessing(true);
        router.patch(route('missing-tracker.resolve', entry.id), {resolution_note: resolutionNote}, {
            preserveScroll: true,
            onSuccess: () => {
                setResolving(null);
                setResolutionNote('');
            },
            onFinish: () => setProcessing(false),
        });
    }

    function stageOf(po) {
        return STAGES.find((stage) => stage.code === Number(po?.status)) ?? null;
    }

    function linkTo(po) {
        const stage = stageOf(po);
        return stage && permissions.includes(stage.permission) ? stage.href(po) : null;
    }

    const filtered = Boolean(filters.tag || filters.stage || filters.search);

    return (
        <AuthenticatedLayout>
            <Head title="Missing Tracker"/>
            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Missing Tracker</h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            What each order is still missing. Tags with a <Lock className="inline w-3 h-3 -mt-0.5"/> hold
                            the order at its stage until resolved; tags with a <Bell className="inline w-3 h-3 -mt-0.5"/> are
                            reminders.
                        </p>
                    </div>
                    <QueueTabs
                        tabs={TABS}
                        active={filters.state}
                        counts={{open: stats?.open ?? 0, resolved: stats?.resolved ?? 0}}
                        onChange={(state) => apply({state, sort: undefined})}
                    />
                </div>

                {/* At a glance */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat icon={CircleAlert} label="Open tags" value={stats?.open ?? 0}/>
                    <Stat
                        icon={Lock}
                        label="Orders on hold"
                        value={stats?.held_orders ?? 0}
                        hint="Can't move to their next stage"
                        tone={(stats?.held_orders ?? 0) > 0 ? 'text-amber-700 dark:text-amber-400' : undefined}
                    />
                    <Stat
                        icon={Clock}
                        label="Oldest open"
                        value={oldestDays === null ? '—' : ageLabel(oldestDays)}
                        hint={stats?.oldest_open_at ? `Since ${formatDate(stats.oldest_open_at)}` : 'Nothing open'}
                        tone={oldestDays >= 14 ? 'text-rose-700 dark:text-rose-400' : oldestDays >= 7 ? 'text-amber-700 dark:text-amber-400' : undefined}
                    />
                    <Stat icon={CheckCircle2} label="Resolved, last 30 days" value={stats?.resolved_30d ?? 0}/>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                            <input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search PO, PR, office, supplier or note…"
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="sr-only" htmlFor="stage-filter">Stage</label>
                            <select
                                id="stage-filter"
                                value={filters.stage ?? ''}
                                onChange={(e) => apply({stage: e.target.value || undefined})}
                                className={selectClass}
                            >
                                <option value="">Every stage</option>
                                {STAGES.map((stage) => (
                                    <option key={stage.code} value={stage.code}>
                                        {stage.label}{isOpen && stages[stage.code] ? ` (${stages[stage.code]} open)` : ''}
                                    </option>
                                ))}
                            </select>
                            <label className="sr-only" htmlFor="sort">Sort</label>
                            <select
                                id="sort"
                                value={filters.sort}
                                onChange={(e) => apply({sort: e.target.value})}
                                className={selectClass}
                            >
                                <option value="oldest">{isOpen ? 'Waiting longest first' : 'Oldest first'}</option>
                                <option value="newest">{isOpen ? 'Newest first' : 'Most recently resolved'}</option>
                            </select>
                            {filtered && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        apply({tag: undefined, stage: undefined, search: undefined});
                                    }}
                                    className="text-xs text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:underline"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            type="button"
                            onClick={() => apply({tag: undefined})}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${!filters.tag ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white' : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`}
                        >
                            All tags
                        </button>
                        {tags.map((tag) => {
                            const Icon = tagHolds(tag) ? Lock : Bell;
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => apply({tag: tag.id})}
                                    aria-pressed={String(filters.tag) === String(tag.id)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border ${TAG_COLORS[tag.color] ?? TAG_COLORS.slate} ${String(filters.tag) === String(tag.id) ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-gray-800' : ''} ${tag.is_active ? '' : 'opacity-60'}`}
                                >
                                    <Icon className="w-3 h-3"/>
                                    {tag.name}
                                    <span className="tabular-nums font-semibold">{tag.open_count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm overflow-hidden">
                    {rows.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            {isOpen && !filtered
                                ? <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400 mb-3"/>
                                : <CircleAlert className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>}
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {filtered ? 'Nothing matches these filters' : isOpen ? 'Nothing is missing' : 'No resolved tags yet'}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {filtered
                                    ? 'Try clearing the filters.'
                                    : isOpen
                                        ? 'Every order has what it needs. Tag an order from its panel on any inventory page.'
                                        : 'Resolved tags are kept here as history.'}
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700/40">
                            {rows.map((entry) => {
                                const po = entry.purchase_order ?? {};
                                const pr = po.purchase_request ?? {};
                                const link = linkTo(po);
                                const stage = stageOf(po);
                                const age = daysSince(entry.created_at);
                                const took = entry.resolved_at ? daysSince(entry.created_at) - daysSince(entry.resolved_at) : null;
                                return (
                                    <li key={entry.id} className="px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-900/20">
                                        <div className="flex flex-col md:flex-row md:items-start gap-3">
                                            {/* What and how long */}
                                            <div className="md:w-56 shrink-0 space-y-1.5">
                                                <TagChip tag={entry.tag}/>
                                                {isOpen ? (
                                                    <p>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${ageStyle(age)}`}>
                                                            <Clock className="w-3 h-3"/>
                                                            Open {ageLabel(age)}
                                                        </span>
                                                    </p>
                                                ) : (
                                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                                        Resolved in {ageLabel(Math.max(0, took ?? 0)).toLowerCase()}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Which order, and where it is */}
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold font-mono text-gray-900 dark:text-white">
                                                        {po.PO_Number ?? po.PR_Number ?? '—'}
                                                    </span>
                                                    {stage ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                                                            At {stage.label}
                                                        </span>
                                                    ) : <StatusBadge status={po.status}/>}
                                                </div>
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                                    {[pr.requester_department, po.PO_Supplier].filter(Boolean).join(' · ') || '—'}
                                                </p>
                                                {entry.note && (
                                                    <p className="text-xs text-gray-700 dark:text-gray-300">“{entry.note}”</p>
                                                )}
                                                <p className="text-[11px] text-gray-400">
                                                    Tagged {formatDate(entry.created_at)}
                                                    {personName(entry.tagged_by) && ` by ${personName(entry.tagged_by)}`}
                                                    {entry.resolved_at && (
                                                        <>
                                                            {' · '}
                                                            <span className="text-emerald-700 dark:text-emerald-400">
                                                                Resolved {formatDate(entry.resolved_at)}
                                                                {personName(entry.resolved_by) && ` by ${personName(entry.resolved_by)}`}
                                                            </span>
                                                        </>
                                                    )}
                                                </p>
                                                {entry.resolution_note && (
                                                    <p className="text-xs text-emerald-800 dark:text-emerald-300">{entry.resolution_note}</p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                {link && (
                                                    <Link
                                                        href={link}
                                                        className="px-3 py-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                                    >
                                                        Open order
                                                    </Link>
                                                )}
                                                {isOpen && resolving !== entry.id && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setResolving(entry.id);
                                                            setResolutionNote('');
                                                        }}
                                                        className="px-3 py-1.5 text-[11px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                                                    >
                                                        Resolve
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {resolving === entry.id && (
                                            <form
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    resolve(entry);
                                                }}
                                                className="mt-3 md:ml-56 md:pl-3 flex flex-col sm:flex-row gap-2"
                                            >
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    maxLength={1000}
                                                    value={resolutionNote}
                                                    onChange={(e) => setResolutionNote(e.target.value)}
                                                    placeholder="How was it resolved? (optional)"
                                                    aria-label={`How "${entry.tag?.name}" was resolved`}
                                                    className="w-full text-xs rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                                />
                                                <div className="flex gap-2 shrink-0">
                                                    <button type="button" onClick={() => setResolving(null)} disabled={processing}
                                                            className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                                                        Cancel
                                                    </button>
                                                    <button type="submit" disabled={processing}
                                                            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                                                        {processing ? 'Saving…' : 'Mark resolved'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {entries?.links && entries.links.length > 3 && (
                        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {entries.from}–{entries.to} of {entries.total}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {entries.links.map((link, index) => (
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
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

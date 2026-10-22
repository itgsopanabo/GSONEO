import {useEffect, useRef, useState} from 'react';
import {router} from '@inertiajs/react';
import {Check} from 'lucide-react';
import {STATUS_MAP} from '@/Constants/statusConfig.js';

/**
 * Pieces shared by the inventory screens built as a queue beside a detail
 * panel with tabs (RIS, Outgoing), so they look and count the same way.
 */

export const peso = new Intl.NumberFormat('en-PH', {style: 'currency', currency: 'PHP', minimumFractionDigits: 2});
export const qty = new Intl.NumberFormat('en-PH', {maximumFractionDigits: 2});

// Where an order is in the inventory pipeline.
const PIPELINE = [
    {code: 230, label: 'Incoming'},
    {code: 300, label: 'Inspection'},
    {code: 400, label: 'RIS'},
    {code: 500, label: 'SSMI'},
    {code: 550, label: 'Outgoing'},
    {code: 600, label: 'Released'},
];

/* ------------------------------------------------------------------ *
 * Quantities
 * ------------------------------------------------------------------ */

/** Quantity received per request line, across every IAR on the order. */
export function receivedByLine(iars) {
    const totals = {};
    for (const iar of iars ?? []) {
        for (const row of iar.items ?? []) {
            totals[row.purchase_request_item_id] = (totals[row.purchase_request_item_id] ?? 0) + Number(row.quantity_received ?? 0);
        }
    }
    return totals;
}

/**
 * The order's lines with what was requested and what was issued. Issued is
 * what the IARs received — the same figure the SSMI prints — falling back to the
 * requested quantity for orders inspected before IARs recorded quantities.
 * Cost is the awarded price when there is one, the estimate otherwise.
 */
export function slipLines(order) {
    const items = order?.purchase_request?.items ?? [];
    const recorded = (order?.iars ?? []).some((iar) => (iar.items ?? []).length > 0);
    const received = receivedByLine(order?.iars);

    return items.map((item, index) => {
        const requested = Number(item.quantity ?? 0);
        const issued = recorded ? (received[item.id] ?? 0) : requested;
        const unitCost = Number(item.bidding_unit_cost ?? item.estimated_unit_cost ?? 0);
        return {
            id: item.id ?? index,
            line: index + 1,
            description: item.item_desc ?? item.item_name ?? '—',
            unit: item.unit ?? '',
            requested,
            issued,
            unitCost,
            amount: issued * unitCost,
        };
    });
}

export const totalOf = (lines) => lines.reduce((sum, line) => sum + line.amount, 0);

/* ------------------------------------------------------------------ *
 * Small pieces
 * ------------------------------------------------------------------ */
export function StatusBadge({status}) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[status]?.style || 'bg-gray-50 border-gray-200'}`}>
            <span className="w-1 h-1 rounded-full bg-current"></span>
            {STATUS_MAP[status]?.label || 'Unknown'}
        </span>
    );
}

export function Pipeline({status}) {
    const current = PIPELINE.findIndex((stage) => stage.code === status);
    if (current === -1) return null;   // cancelled or rejected: the badge says enough

    return (
        <ol className="flex items-center gap-1 overflow-x-auto" aria-label="Pipeline">
            {PIPELINE.map((stage, index) => {
                // The last stage is an end state, not a step still to take.
                const done = index < current || (index === current && index === PIPELINE.length - 1);
                const here = index === current && !done;
                return (
                    <li key={stage.code} className="flex items-center gap-1 shrink-0">
                        <span
                            aria-current={index === current ? 'step' : undefined}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                here ? 'bg-indigo-600 text-white'
                                    : done ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                                        : 'bg-gray-100 text-gray-400 dark:bg-gray-700/50 dark:text-gray-500'}`}
                        >
                            {done && <Check className="w-2.5 h-2.5"/>}
                            {stage.label}
                        </span>
                        {index < PIPELINE.length - 1 && <span className="w-2 h-px bg-gray-200 dark:bg-gray-700"/>}
                    </li>
                );
            })}
        </ol>
    );
}

export function Detail({label, children}) {
    return (
        <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <div className="text-xs font-medium text-gray-900 dark:text-white">{children ?? '—'}</div>
        </div>
    );
}

/** The tab switch in a page header: [{key, label}] with a count per key. */
export function QueueTabs({tabs, active, counts, onChange}) {
    return (
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 text-xs self-start sm:self-auto" role="tablist">
            {tabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active === tab.key}
                    onClick={() => onChange(tab.key)}
                    className={`px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 ${active === tab.key ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}
                >
                    {tab.label}
                    <span className={`tabular-nums rounded-full px-1.5 text-[10px] ${active === tab.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                        {counts?.[tab.key] ?? 0}
                    </span>
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

/**
 * Tabs, server-side search and the selected order for a queue screen.
 *
 * The page's controller takes `view`, `search` and `order` and answers with
 * `filters` and `focusOrder`. Search runs on the server so it covers every page;
 * `order` (from a redirect or a link elsewhere) opens that order even when it is
 * not on the current page.
 */
export function useOrderQueue({routeName, filters, defaultView, rows, focusOrder}) {
    const view = filters?.view ?? defaultView;
    const [search, setSearch] = useState(filters?.search ?? '');
    const [selectedId, setSelectedId] = useState(filters?.order ?? null);

    useEffect(() => {
        setSelectedId(filters?.order ?? null);
    }, [filters?.order, filters?.view]);

    function visit(changes) {
        const query = {view, search: filters?.search || undefined, ...changes};
        if (query.view === defaultView) delete query.view;
        router.get(route(routeName), query, {preserveState: true, preserveScroll: true, replace: true});
    }

    const firstRender = useRef(true);
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return undefined;
        }
        const timer = setTimeout(() => visit({search: search.trim() || undefined}), 350);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    function switchTab(key) {
        if (key === view) return;
        setSelectedId(null);
        visit({view: key});
    }

    const selected = selectedId !== null
        ? (rows.find((po) => po.id === selectedId) ?? (focusOrder?.id === selectedId ? focusOrder : null))
        : (rows[0] ?? null);

    return {view, search, setSearch, selected, setSelectedId, switchTab};
}

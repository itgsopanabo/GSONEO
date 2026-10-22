import { Head, Link, router, usePage } from '@inertiajs/react'
import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BarChart3, FileText, ListFilter, PackageCheck, Search, XCircle } from 'lucide-react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx'
import DateInput from '@/Components/DateInput.jsx'
import CancelProcurementModal from '@/Components/CancelProcurementModal.jsx'
import ChangeStatusModal from '@/Components/ChangeStatusModal.jsx'
import RowActionsMenu from '@/Components/RowActionsMenu.jsx'
import InfoHint from '@/Components/InfoHint.jsx'
import { getStatusConfig } from '@/Constants/statusConfig.js'
import { formatDate, formatMonthDay } from '@/Utils/formatDate.js'

/** Statuses after which a request is closed: its age is history, not a delay. */
const CLOSED = [600, 700, 800]

/** The status a row is at now: the order's once the request has reached PO generated. */
function currentStatus(r) {
    const usesOrder = Number(r.pr_status_code) === 230 && r.po_status_code !== null && r.po_status_code !== undefined
    return usesOrder
        ? { code: Number(r.po_status_code), label: r.po_status }
        : { code: Number(r.pr_status_code), label: r.pr_status }
}

function StatusBadge({ code, label }) {
    const config = getStatusConfig(code)
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.style}`}>
            <span className="h-1 w-1 rounded-full bg-current" />
            {label || config.label}
        </span>
    )
}

/** Minutes to a full days/hours/minutes/seconds duration. */
export function duration(minutes) {
    if (minutes === null || minutes === undefined) return '—'

    let remaining = Math.round(Number(minutes) * 60)
    if (!Number.isFinite(remaining)) return '—'
    if (remaining < 0) remaining = 0

    const days = Math.floor(remaining / 86400)
    remaining %= 86400
    const hours = Math.floor(remaining / 3600)
    remaining %= 3600
    const mins = Math.floor(remaining / 60)
    const seconds = remaining % 60

    return `${days} ${days === 1 ? 'day' : 'days'} ${hours} ${hours === 1 ? 'hr' : 'hrs'} ${mins} min ${seconds} sec`
}

/**
 * Minutes as the two largest units that carry meaning — "3d 4h", "2h 15m".
 *
 * The full form from duration() is right in a tooltip but too long to scan down
 * a column of stages, where the comparison between rows is the point.
 */
export function compactDuration(minutes) {
    if (minutes === null || minutes === undefined) return '—'

    const total = Math.max(Math.round(Number(minutes)), 0)
    if (!Number.isFinite(total)) return '—'
    if (total < 1) return 'under a minute'

    const days = Math.floor(total / 1440)
    const hours = Math.floor((total % 1440) / 60)
    const mins = total % 60

    if (days) return hours ? `${days}d ${hours}h` : `${days}d`
    if (hours) return mins ? `${hours}h ${mins}m` : `${hours}h`
    return `${mins}m`
}

/** Hours elapsed, shown as hours for young requests and days for old ones. */
function age(hours) {
    if (hours === null || hours === undefined) return '—'
    if (hours < 24) return `${hours}h`
    return `${Math.round(hours / 24)}d`
}

/** Same scale as the inventory pages: a week is worth a look, two weeks is overdue. */
function ageStyle(hours, closed) {
    if (closed) return 'text-gray-400 dark:text-gray-500'
    const days = (hours ?? 0) / 24
    if (days >= 14) return 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
    if (days >= 7) return 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300'
}

// ---------------------------------------------------------------------------
// Date range presets
// ---------------------------------------------------------------------------

/** Local YYYY-MM-DD. toISOString() would shift the date across the UTC boundary. */
function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgo(n) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d
}

const RANGE_PRESETS = [
    { key: 'any', label: 'Any time', range: () => ({ from: '', to: '' }) },
    { key: '7d', label: 'Last 7 days', range: () => ({ from: isoDate(daysAgo(7)), to: isoDate(new Date()) }) },
    { key: '30d', label: 'Last 30 days', range: () => ({ from: isoDate(daysAgo(30)), to: isoDate(new Date()) }) },
    {
        key: 'month',
        label: 'This month',
        range: () => {
            const now = new Date()
            return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) }
        },
    },
    { key: 'custom', label: 'Custom', range: () => null },
]

/** Which preset the incoming from/to values correspond to, if any. */
function detectPreset(from, to) {
    if (!from && !to) return 'any'
    const match = RANGE_PRESETS.find((p) => {
        const r = p.range()
        return r && r.from === from && r.to === to
    })
    return match?.key ?? 'custom'
}

function readableRange(from, to) {
    const short = (v) => formatMonthDay(v)
    if (from && to) return `${short(from)} – ${short(to)}`
    if (from) return `from ${short(from)}`
    return `until ${short(to)}`
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const VIEWS = [
    { key: 'requests', label: 'Requests', icon: ListFilter },
    { key: 'insights', label: 'Insights', icon: BarChart3 },
]

function Stat({ icon: Icon, label, value, hint, tone }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${tone ?? 'text-gray-900 dark:text-white'}`}>
                {Number(value ?? 0).toLocaleString()}
            </p>
            {hint && <p className="truncate text-[11px] text-gray-400">{hint}</p>}
        </div>
    )
}

function Card({ title, info, subtitle, children, className = '' }) {
    return (
        <section className={`rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800 ${className}`}>
            <header className="border-b border-gray-100 px-5 py-4 dark:border-gray-700/60">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                    <InfoHint text={info} />
                </h2>
                {subtitle && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
            </header>
            <div className="p-5">{children}</div>
        </section>
    )
}

const selectClass = 'rounded-lg border-gray-200 bg-gray-50 text-xs text-gray-700 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/40 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RequestMonitoring({
    requests,
    summary = {},
    prStatuses = [],
    poStatuses = [],
    stageAverages = [],
    departments = [],
    statusOptions = [],
    filters = {},
}) {
    const [form, setForm] = useState({
        search: filters.search ?? '',
        status: filters.status ?? '',
        department: filters.department ?? '',
        from: filters.from ?? '',
        to: filters.to ?? '',
    })
    const [preset, setPreset] = useState(detectPreset(filters.from ?? '', filters.to ?? ''))

    // The view lives in the address (#insights) so a refresh or a shared link opens
    // the same one — the dashboard does the same.
    const readView = () => {
        const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : ''
        return VIEWS.some((v) => v.key === hash) ? hash : 'requests'
    }
    const [view, setView] = useState(readView)
    const chooseView = (key) => {
        setView(key)
        window.history.replaceState(null, '', key === 'requests' ? window.location.pathname + window.location.search : `${window.location.search}#${key}`)
    }

    // Cancelling and moving a record's status are administrative actions: the
    // permission decides whether the buttons appear at all, and the server decides
    // which rows each one applies to.
    const { auth } = usePage().props
    const mayOverride = (auth?.permissions ?? []).includes('procurement.override')
    const [cancelling, setCancelling] = useState(null)
    const [moving, setMoving] = useState(null)

    /**
     * What the kebab offers on a row.
     *
     * The two administrative actions stay on the menu even when they cannot be
     * used, carrying the server's reason — "already cancelled", "nowhere to move
     * it" — because a button that silently disappears reads as a missing feature.
     */
    function rowActions(r) {
        const actions = [
            { label: 'View timeline', onSelect: () => router.visit(route('request-monitoring.show', r.id)) },
        ]

        if (!mayOverride) return actions

        const movable = (r.status_options ?? []).some((o) => !o.blocked && !o.current)
        const cancellable = !(r.cancel_request_refusal && r.cancel_order_refusal)

        actions.push({
            label: 'Change status',
            onSelect: () => setMoving(r),
            disabled: !movable,
            hint: movable ? undefined : 'There is nowhere this record can be moved right now.',
        })

        actions.push({
            label: 'Cancel…',
            onSelect: () => setCancelling(r),
            danger: true,
            disabled: !cancellable,
            hint: cancellable ? undefined : r.cancel_request_refusal,
        })

        return actions
    }

    function applyFilters(next) {
        const merged = { ...form, ...next }
        setForm(merged)
        const query = Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== ''))
        router.get(route('request-monitoring.index'), query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        })
    }

    // Search as you type, on the server, so it covers every page.
    const firstRender = useRef(true)
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false
            return undefined
        }
        const timer = setTimeout(() => applyFilters({}), 350)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.search])

    function choosePreset(p) {
        setPreset(p.key)
        const range = p.range()
        if (range) applyFilters(range)   // Custom waits for the person to pick dates
    }

    function clearFilters() {
        setForm({ search: '', status: '', department: '', from: '', to: '' })
        setPreset('any')
        router.get(route('request-monitoring.index'), {}, { preserveState: true, replace: true })
    }

    function removeFilter(keys) {
        const cleared = Object.fromEntries(keys.map((k) => [k, '']))
        if (keys.includes('from')) setPreset('any')
        applyFilters(cleared)
    }

    const total = Number(summary.total ?? 0)

    // The end-to-end row is shown on its own; the bars are scaled against the
    // slowest hand-off so the longest stage is obvious at a glance.
    const overall = stageAverages.find((s) => s.overall)
    const handoffs = stageAverages.filter((s) => !s.overall)
    const slowest = Math.max(0, ...handoffs.map((s) => s.avg_minutes ?? 0))

    // Only the stages the controller can actually count.
    const funnel = [
        { label: 'Submitted', value: total },
        { label: 'Verified', value: Number(summary.verified ?? 0) },
        { label: 'PO issued', value: Number(summary.with_po ?? 0) },
        { label: 'RIS issued', value: Number(summary.with_ris ?? 0) },
    ]

    const hasFilters = Object.values(form).some(Boolean)

    // Applied filters, described the way the person set them.
    const activePills = [
        form.search && { keys: ['search'], label: `Matching “${form.search}”` },
        form.status && {
            keys: ['status'],
            label:
                statusOptions.find((s) => String(s.status_code) === String(form.status))?.status_desc ??
                `Status ${form.status}`,
        },
        form.department && { keys: ['department'], label: form.department },
        (form.from || form.to) && { keys: ['from', 'to'], label: readableRange(form.from, form.to) },
    ].filter(Boolean)

    return (
        <AuthenticatedLayout>
            <Head title="Request Monitoring" />

            <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                {/* Header */}
                <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Request Monitoring</h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Where every purchase request sits now, and how long each hand-off takes.
                        </p>
                    </div>
                    <div role="tablist" aria-label="Monitoring views" className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-0.5 text-xs dark:border-gray-700 dark:bg-gray-800 sm:self-auto">
                        {VIEWS.map((v) => (
                            <button
                                key={v.key}
                                type="button"
                                role="tab"
                                aria-selected={view === v.key}
                                onClick={() => chooseView(v.key)}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${view === v.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900/40'}`}
                            >
                                <v.icon className="h-3.5 w-3.5" />
                                {v.label}
                            </button>
                        ))}
                    </div>
                </header>

                {/* At a glance */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Stat icon={FileText} label="Requests filed" value={total} hint={`${Number(summary.verified ?? 0).toLocaleString()} verified`} />
                    <Stat icon={PackageCheck} label="Reached a PO" value={summary.with_po} hint={`${Number(summary.with_ris ?? 0).toLocaleString()} issued (RIS)`} />
                    <Stat
                        icon={AlertTriangle}
                        label="Stalled past 14 days"
                        value={summary.stalled}
                        hint="No PO yet, not declined"
                        tone={Number(summary.stalled ?? 0) > 0 ? 'text-rose-700 dark:text-rose-400' : undefined}
                    />
                    <Stat icon={XCircle} label="Declined" value={summary.declined} hint="At verification" />
                </div>

                {view === 'requests' ? (
                    <>
                        {/* Filters */}
                        <section className="space-y-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="search"
                                        value={form.search}
                                        aria-label="Search requests"
                                        placeholder="Search PR number, PO number or supplier…"
                                        onChange={(e) => setForm({ ...form, search: e.target.value })}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={form.status}
                                        aria-label="Filter by status"
                                        onChange={(e) => applyFilters({ status: e.target.value })}
                                        className={selectClass}
                                    >
                                        <option value="">Every status</option>
                                        {statusOptions.map((s) => (
                                            <option key={s.status_code} value={s.status_code}>
                                                {s.status_desc}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={form.department}
                                        aria-label="Filter by department"
                                        onChange={(e) => applyFilters({ department: e.target.value })}
                                        className={selectClass}
                                    >
                                        <option value="">Every department</option>
                                        {departments.map((d) => (
                                            <option key={d.name} value={d.name}>
                                                {d.name} ({d.total})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Date range: presets first, exact dates only when asked for */}
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Filed</span>
                                <div role="group" aria-label="Filed within" className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5 text-xs dark:border-gray-700">
                                    {RANGE_PRESETS.map((p) => (
                                        <button
                                            key={p.key}
                                            type="button"
                                            aria-pressed={preset === p.key}
                                            onClick={() => choosePreset(p)}
                                            className={`rounded-md px-2.5 py-1 font-medium ${preset === p.key
                                                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900/40'}`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>

                                {preset === 'custom' && (
                                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                        <DateInput
                                            value={form.from}
                                            max={form.to || undefined}
                                            aria-label="Filed on or after"
                                            onChange={(e) => applyFilters({ from: e.target.value })}
                                            className="w-40"
                                        />
                                        to
                                        <DateInput
                                            value={form.to}
                                            min={form.from || undefined}
                                            aria-label="Filed on or before"
                                            onChange={(e) => applyFilters({ to: e.target.value })}
                                            className="w-40"
                                        />
                                    </div>
                                )}
                            </div>

                            {activePills.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        Showing {(requests?.total ?? 0).toLocaleString()} of {total.toLocaleString()}:
                                    </span>
                                    {activePills.map((pill) => (
                                        <button
                                            key={pill.keys.join()}
                                            type="button"
                                            onClick={() => removeFilter(pill.keys)}
                                            className="group inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-0.5 pl-2.5 pr-2 text-xs text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                                        >
                                            {pill.label}
                                            <span aria-hidden="true" className="text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-100">×</span>
                                            <span className="sr-only">Remove this filter</span>
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="text-xs text-gray-500 hover:text-indigo-600 hover:underline dark:text-gray-400 dark:hover:text-indigo-400"
                                    >
                                        Clear all
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* Requests */}
                        <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left">
                                    <thead className="bg-gray-50 dark:bg-gray-900/30">
                                        <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                            <th className="px-5 py-2.5">Request</th>
                                            <th className="px-4 py-2.5">Purchase order</th>
                                            <th className="px-4 py-2.5">Status</th>
                                            <th className="px-4 py-2.5">Verified by</th>
                                            <th className="px-4 py-2.5 text-right">Open for</th>
                                            <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                        {requests?.data?.length ? (
                                            requests.data.map((r) => {
                                                const status = currentStatus(r)
                                                const closed = CLOSED.includes(status.code)
                                                return (
                                                    <tr key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-900/20">
                                                        <td className="px-5 py-3">
                                                            <Link
                                                                href={route('request-monitoring.show', r.id)}
                                                                className="font-mono text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                                                            >
                                                                {r.pr_number}
                                                            </Link>
                                                            <p className="mt-0.5 max-w-[16rem] truncate text-[11px] text-gray-500 dark:text-gray-400">
                                                                {r.requester_department || '—'}
                                                                {r.created_at && ` · filed ${formatDate(r.created_at)}`}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {r.PO_Number ? (
                                                                <>
                                                                    <p className="font-mono text-xs text-gray-900 dark:text-white">{r.PO_Number}</p>
                                                                    {r.PO_Supplier && (
                                                                        <p className="mt-0.5 max-w-[12rem] truncate text-[11px] text-gray-500 dark:text-gray-400">{r.PO_Supplier}</p>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <StatusBadge code={status.code} label={status.label} />
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                                                            {r.verified_by?.trim() || <span className="text-gray-400 dark:text-gray-500">Not yet</span>}
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                                            <span
                                                                title={closed ? 'Closed — age since it was filed' : 'Time since it was filed'}
                                                                className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${ageStyle(r.age_hours, closed)}`}
                                                            >
                                                                {age(r.age_hours)}
                                                            </span>
                                                        </td>
                                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                                            <div className="flex justify-end">
                                                                <RowActionsMenu label={`Actions for ${r.pr_number}`} items={rowActions(r)} />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-16 text-center">
                                                    <FileText className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                        {hasFilters ? 'No requests match these filters' : 'No purchase requests yet'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {hasFilters ? 'Try a wider date range or clearing the status.' : 'Requests appear here once they are filed.'}
                                                    </p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {requests?.links?.length > 3 && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-900/20">
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {requests.from}–{requests.to} of {requests.total}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {requests.links.map((link, i) => (
                                            <Link
                                                key={i}
                                                href={link.url ?? '#'}
                                                preserveScroll
                                                preserveState
                                                className={`rounded-md border px-2.5 py-1 text-[11px] transition-all ${link.active
                                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-900/40'} ${!link.url ? 'pointer-events-none opacity-50' : ''}`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    </>
                ) : (
                    <div className="grid gap-5 lg:grid-cols-2">
                        {/* Pipeline — how many requests survive each stage */}
                        <Card
                            title="Pipeline"
                            info="How many requests reached each stage. A request counts at a stage once it has passed it, so the bars only fall — the drop between two of them is what has not got through yet."
                            subtitle="How many requests got through each stage"
                        >
                            <ol className="space-y-3">
                                {funnel.map((stage, i) => {
                                    const pct = total ? (stage.value / total) * 100 : 0
                                    const prev = i > 0 ? funnel[i - 1].value : null
                                    const waiting = prev !== null ? prev - stage.value : null
                                    return (
                                        <li key={stage.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3">
                                            <span className="text-xs text-gray-600 dark:text-gray-300">{stage.label}</span>
                                            <span className="relative h-6 overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900">
                                                <span className="block h-full rounded-md bg-indigo-500/80 dark:bg-indigo-400/70" style={{ width: `${pct}%` }} />
                                            </span>
                                            <span className="w-28 text-right text-xs tabular-nums">
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">{stage.value}</span>
                                                {waiting > 0 && <span className="ml-1.5 text-gray-500 dark:text-gray-400">· {waiting} waiting</span>}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ol>
                        </Card>

                        {/* How long each hand-off takes */}
                        <Card
                            title="How long each hand-off takes"
                            info="Average time between the two moments that bound each stage, across every record where both were recorded — n is how many. Bars are scaled against the slowest hand-off. Stages whose timestamps predate September 2026 read as not measured yet."
                            subtitle="The longest bar is where requests wait most"
                        >
                            {handoffs.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Nothing measured yet.</p>
                            ) : (
                                <ol className="space-y-1">
                                    {handoffs.map((s) => {
                                        const share = slowest > 0 && s.avg_minutes ? s.avg_minutes / slowest : 0
                                        const isSlowest = s.avg_minutes !== null && s.avg_minutes === slowest && slowest > 0
                                        return (
                                            <li key={s.key} className="grid grid-cols-[minmax(8rem,1fr)_2fr_auto] items-center gap-3 py-1">
                                                <span className="truncate text-xs text-gray-600 dark:text-gray-400">{s.stage}</span>
                                                <span className="h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                                                    {s.avg_minutes !== null && (
                                                        <span
                                                            className={`block h-2 rounded-full ${isSlowest ? 'bg-amber-500' : 'bg-indigo-500 dark:bg-indigo-400'}`}
                                                            style={{ width: `${Math.max(share * 100, 2)}%` }}
                                                        />
                                                    )}
                                                </span>
                                                <span
                                                    className="whitespace-nowrap text-right text-xs tabular-nums text-gray-900 dark:text-gray-100"
                                                    title={s.sample ? `${duration(s.avg_minutes)} average · longest ${duration(s.max_minutes)} · ${s.sample} measured` : 'Nothing has completed this stage yet'}
                                                >
                                                    {s.sample ? (
                                                        <>
                                                            {compactDuration(s.avg_minutes)}
                                                            <span className="ml-1.5 text-[10px] font-normal text-gray-400 dark:text-gray-500">n={s.sample}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-[11px] font-normal text-gray-400 dark:text-gray-500">not measured yet</span>
                                                    )}
                                                </span>
                                            </li>
                                        )
                                    })}
                                </ol>
                            )}

                            {overall && (
                                <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-900/40">
                                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{overall.stage}</p>
                                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                                        {overall.sample ? (
                                            <>
                                                <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{compactDuration(overall.avg_minutes)}</span>
                                                {' '}on average · longest {compactDuration(overall.max_minutes)} · {overall.sample} completed
                                            </>
                                        ) : (
                                            'No request has been released yet, so there is nothing to average.'
                                        )}
                                    </p>
                                </div>
                            )}
                        </Card>

                        {/* Status breakdowns */}
                        {[
                            {
                                title: 'Requests by status',
                                rows: prStatuses,
                                info: 'Every purchase request ever filed, grouped by the status it holds now — completed, declined and cancelled included. The filters on the Requests view do not affect these counts.',
                            },
                            {
                                title: 'Purchase orders by status',
                                rows: poStatuses,
                                info: 'Every purchase order, grouped by the status it holds now. An order only appears here once its request has reached the PO stage.',
                            },
                        ].map(({ title, rows, info }) => {
                            const sum = rows.reduce((acc, r) => acc + Number(r.total ?? 0), 0)
                            return (
                                <Card key={title} title={title} info={info} subtitle={`${sum.toLocaleString()} in total`}>
                                    {rows.length === 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Nothing recorded yet.</p>
                                    ) : (
                                        <ul className="space-y-2.5">
                                            {rows.map((r) => (
                                                <li key={r.status_code} className="grid grid-cols-[minmax(9rem,auto)_1fr_2.5rem] items-center gap-3">
                                                    <StatusBadge code={Number(r.status_code)} label={r.status_desc} />
                                                    <span className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
                                                        <span className="block h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: `${sum ? (r.total / sum) * 100 : 0}%` }} />
                                                    </span>
                                                    <span className="text-right text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">{r.total}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>

            <CancelProcurementModal
                open={!!cancelling}
                onClose={() => setCancelling(null)}
                prId={cancelling?.id}
                prNumber={cancelling?.pr_number}
                poId={cancelling?.po_id}
                poNumber={cancelling?.PO_Number}
                requestRefusal={cancelling?.cancel_request_refusal}
                orderRefusal={cancelling?.cancel_order_refusal}
            />

            <ChangeStatusModal
                open={!!moving}
                onClose={() => setMoving(null)}
                prId={moving?.id}
                prNumber={moving?.pr_number}
                poId={moving?.po_id}
                options={moving?.status_options ?? []}
            />
        </AuthenticatedLayout>
    )
}

import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx'

/**
 * Status descriptions come from the database, so colour is keyed off keywords
 * rather than codes. Anything unrecognised falls back to neutral — a wrong
 * colour is worse than no colour on a monitoring screen.
 */
function statusTone(desc = '') {
    const d = desc.toLowerCase()
    if (/declin|reject|cancel|void/.test(d)) return 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300 dark:ring-red-400/20'
    if (/complet|receiv|issued|done|closed|deliver/.test(d)) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/20'
    if (/verif|approv/.test(d)) return 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-400/20'
    if (/pending|waiting|process|canvas|draft/.test(d)) return 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/20'
    return 'bg-gray-100 text-gray-700 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-400/20'
}

function Badge({ children }) {
    if (!children) return <span className="text-gray-400 dark:text-gray-600">—</span>
    return (
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusTone(children)}`}>
            {children}
        </span>
    )
}

/** Minutes to the coarsest unit that still says something useful. */
export function duration(minutes) {
    if (minutes === null || minutes === undefined) return '—'
    if (minutes < 60) return `${minutes} min`
    const hours = minutes / 60
    if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} hrs`
    return `${(hours / 24).toFixed(1)} days`
}

/** Hours elapsed, shown as hours for young requests and days for old ones. */
function age(hours) {
    if (hours === null || hours === undefined) return '—'
    if (hours < 24) return `${hours}h`
    return `${Math.round(hours / 24)}d`
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
    const short = (v) =>
        new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    if (from && to) return `${short(from)} – ${short(to)}`
    if (from) return `from ${short(from)}`
    return `until ${short(to)}`
}

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

    function applyFilters(next) {
        const merged = { ...form, ...next }
        setForm(merged)
        router.get(route('request-monitoring.index'), merged, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        })
    }

    function choosePreset(p) {
        setPreset(p.key)
        const range = p.range()
        if (range) applyFilters(range)   // Custom waits for the person to pick dates
    }

    function clearFilters() {
        const empty = { search: '', status: '', department: '', from: '', to: '' }
        setForm(empty)
        setPreset('any')
        router.get(route('request-monitoring.index'), {}, { preserveState: true, replace: true })
    }

    function removeFilter(keys) {
        const cleared = Object.fromEntries(keys.map((k) => [k, '']))
        if (keys.includes('from')) setPreset('any')
        applyFilters(cleared)
    }

    const total = Number(summary.total ?? 0)

    // Only the stages the controller can actually count. Canvassing isn't here
    // because summary doesn't carry a count for it.
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

            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <header className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                            Request monitoring
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Where every purchase request currently sits, and how long it took to get there.
                        </p>
                    </div>
                    <div className="flex gap-6 text-sm">
                        <div>
                            <div className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                                {summary.stalled ?? 0}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">stalled past 14 days</div>
                        </div>
                        <div>
                            <div className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                                {summary.declined ?? 0}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">declined</div>
                        </div>
                    </div>
                </header>

                {/* Pipeline — how many requests survive each stage */}
                <section className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                    <div className="space-y-3">
                        {funnel.map((stage, i) => {
                            const pct = total ? (stage.value / total) * 100 : 0
                            const prev = i > 0 ? funnel[i - 1].value : null
                            const dropped = prev !== null ? prev - stage.value : null
                            return (
                                <div key={stage.label} className="flex items-center gap-4">
                                    <div className="w-28 shrink-0 text-sm text-gray-600 dark:text-gray-300">
                                        {stage.label}
                                    </div>
                                    <div className="relative h-7 flex-1 overflow-hidden rounded bg-gray-100 dark:bg-gray-900">
                                        <div
                                            className="h-full bg-blue-600/80 dark:bg-blue-500/70"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="w-32 shrink-0 text-right text-sm tabular-nums">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                            {stage.value}
                                        </span>
                                        {dropped > 0 && (
                                            <span className="ml-2 text-gray-500 dark:text-gray-400">
                                                −{dropped} waiting
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {stageAverages.length > 0 && (
                        <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {stageAverages.map((s) => (
                                    <div key={s.stage}>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">{s.stage}</div>
                                        <div className="mt-1 text-lg font-medium tabular-nums text-gray-900 dark:text-gray-100">
                                            {duration(s.avg_minutes)}
                                            <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">
                                                average
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                            longest {duration(s.max_minutes)} · {s.sample} measured
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* Status breakdowns */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {[
                        { title: 'Requests by status', rows: prStatuses },
                        { title: 'Purchase orders by status', rows: poStatuses },
                    ].map(({ title, rows }) => (
                        <section
                            key={title}
                            className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
                        >
                            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h2>
                            {rows.length === 0 ? (
                                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                    Nothing recorded yet.
                                </p>
                            ) : (
                                <ul className="mt-4 space-y-2">
                                    {rows.map((r) => (
                                        <li key={r.status_code} className="flex items-center justify-between gap-3">
                                            <Badge>{r.status_desc}</Badge>
                                            <span className="text-sm tabular-nums text-gray-700 dark:text-gray-300">
                                                {r.total}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}
                </div>

                {/* Filters */}
                <section className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-56 flex-1">
                            <input
                                type="search"
                                value={form.search}
                                aria-label="Search requests"
                                placeholder="Search PR number, PO number, requester, or supplier"
                                onChange={(e) => setForm({ ...form, search: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters({})}
                                className="w-full rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                            />
                        </div>

                        <select
                            value={form.status}
                            aria-label="Filter by status"
                            onChange={(e) => applyFilters({ status: e.target.value })}
                            className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        >
                            <option value="">All statuses</option>
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
                            className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        >
                            <option value="">All departments</option>
                            {departments.map((d) => (
                                <option key={d.name} value={d.name}>
                                    {d.name} ({d.total})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Date range: presets first, exact dates only when asked for */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div
                            role="group"
                            aria-label="Filed within"
                            className="inline-flex overflow-hidden rounded-md border border-gray-300 dark:border-gray-600"
                        >
                            {RANGE_PRESETS.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    aria-pressed={preset === p.key}
                                    onClick={() => choosePreset(p)}
                                    className={`border-r border-gray-300 px-3 py-1.5 text-sm last:border-r-0 dark:border-gray-600 ${
                                        preset === p.key
                                            ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                            : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {preset === 'custom' && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <input
                                    type="date"
                                    value={form.from}
                                    max={form.to || undefined}
                                    aria-label="Filed on or after"
                                    onChange={(e) => applyFilters({ from: e.target.value })}
                                    className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                />
                                to
                                <input
                                    type="date"
                                    value={form.to}
                                    min={form.from || undefined}
                                    aria-label="Filed on or before"
                                    onChange={(e) => applyFilters({ to: e.target.value })}
                                    className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                />
                            </div>
                        )}
                    </div>

                    {activePills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Showing {requests?.total ?? 0} of {total}:
                            </span>
                            {activePills.map((pill) => (
                                <button
                                    key={pill.keys.join()}
                                    type="button"
                                    onClick={() => removeFilter(pill.keys)}
                                    className="group inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-2 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    {pill.label}
                                    <span
                                        aria-hidden="true"
                                        className="text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-100"
                                    >
                                        ×
                                    </span>
                                    <span className="sr-only">Remove this filter</span>
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </section>

                {/* Requests */}
                <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                <th className="px-4 py-3">PR number</th>
                                <th className="px-4 py-3">Requester</th>
                                <th className="px-4 py-3">Department</th>
                                <th className="px-4 py-3">Request status</th>
                                <th className="px-4 py-3">Verified by</th>
                                <th className="px-4 py-3">PO number</th>
                                <th className="px-4 py-3">PO status</th>
                                <th className="px-4 py-3 text-right">Open for</th>
                                <th className="px-4 py-3" />
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {requests?.data?.length ? (
                                requests.data.map((r) => (
                                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                                            {r.pr_number}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                            {r.requester_name}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                                            {r.requester_department}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge>{r.pr_status}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                                            {r.verified_by?.trim() || (
                                                <span className="text-gray-400 dark:text-gray-600">
                                                        not yet verified
                                                    </span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                                            {r.PO_Number ?? (
                                                <span className="text-gray-400 dark:text-gray-600">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge>{r.po_status}</Badge>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                                            {age(r.age_hours)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            <Link
                                                href={route('request-monitoring.show', r.id)}
                                                className="text-blue-600 hover:underline dark:text-blue-400"
                                            >
                                                Timeline
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                                        {hasFilters
                                            ? 'No requests match these filters. Try a wider date range or clearing the status.'
                                            : 'No purchase requests have been filed yet.'}
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {requests?.links?.length > 3 && (
                        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {requests.from}–{requests.to} of {requests.total}
                            </p>
                            <div className="flex gap-1">
                                {requests.links.map((link, i) => (
                                    <Link
                                        key={i}
                                        href={link.url ?? '#'}
                                        preserveScroll
                                        className={`rounded px-3 py-1 text-sm ${
                                            link.active
                                                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                                : link.url
                                                    ? 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                                                    : 'cursor-default text-gray-300 dark:text-gray-600'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    )
}

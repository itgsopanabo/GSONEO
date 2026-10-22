import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Head, Link, router } from '@inertiajs/react'
import { Activity, ChevronDown, Eye, History, Search, Users } from 'lucide-react'
import Layout from '@/Layouts/AuthenticatedLayout'
import DateInput from '@/Components/DateInput.jsx'
import { formatDate, formatDateTime, formatTime, parseDate } from '@/Utils/formatDate.js'

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

/** Actions are logged in several styles — "verified", "Generate RIS Number", "document_branding_updated". */
function actionLabel(action) {
    if (!action) return '—'
    const words = action.replace(/_/g, ' ').trim()
    return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Colour by what kind of change it is, read off the wording since actions are
 * free text. Anything unrecognised stays neutral.
 */
function actionTone(action = '') {
    const a = action.toLowerCase()
    if (/view/.test(a)) return 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-700/60 dark:text-gray-400 dark:ring-gray-600'
    if (/delet|cancel|declin|reject|lock|void/.test(a)) return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30'
    if (/missing/.test(a)) return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'
    if (/resolv|verif|releas|accept|restor/.test(a)) return 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30'
    if (/creat|generat|added/.test(a)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
    return 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30'
}

const MODEL_NAMES = {
    PurchaseOrder: 'Purchase order',
    PurchaseRequest: 'Purchase request',
    CanvasForms: 'Canvass form',
    DocumentSetting: 'Document settings',
    Role: 'Role',
    User: 'User',
}

function modelName(type) {
    if (!type) return null
    const base = type.split('\\').pop()
    return MODEL_NAMES[base] ?? base
}

/** Field names as logged — "released_by_emp_id", "RIS_Number" — made readable. */
function fieldLabel(key) {
    const words = String(key).replace(/_/g, ' ').replace(/\bemp id\b/i, '').trim()
    return words.charAt(0).toUpperCase() + words.slice(1)
}

function fullStamp(value) {
    const date = parseDate(value)
    if (!date) return ''
    return `${date.toLocaleDateString(undefined, { weekday: 'long' })}, ${formatDateTime(date, { seconds: true })}`
}

function dayLabel(value) {
    const date = parseDate(value) ?? new Date(value)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    const absolute = formatDate(date)
    if (date.toDateString() === today.toDateString()) return `Today · ${absolute}`
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${absolute}`
    return `${date.toLocaleDateString(undefined, { weekday: 'long' })} · ${absolute}`
}

function userName(user) {
    if (!user) return 'System'
    return [user.emp_fname, user.emp_lname].filter(Boolean).join(' ') || `Employee ${user.emp_id}`
}

function initials(user) {
    if (!user) return 'SY'
    return [user.emp_fname, user.emp_lname].filter(Boolean).map((p) => p[0]).join('').toUpperCase() || '?'
}

function display(value) {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Stat({ icon: Icon, label, value, hint }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{Number(value ?? 0).toLocaleString()}</p>
            {hint && <p className="truncate text-[11px] text-gray-400">{hint}</p>}
        </div>
    )
}

function ActionPill({ action }) {
    return (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${actionTone(action)}`}>
            {actionLabel(action)}
        </span>
    )
}

function RecordRef({ log }) {
    const kind = modelName(log.auditable_type)
    if (!kind && !log.record) return null
    const label = log.record?.label ?? (log.auditable_id ? `#${log.auditable_id}` : null)

    return (
        <span className="inline-flex flex-wrap items-baseline gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            {kind && <span>{kind}</span>}
            {label && (log.record?.url ? (
                <Link href={log.record.url} className="font-mono font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    {label}
                </Link>
            ) : (
                <span className="font-mono text-gray-700 dark:text-gray-300">{label}</span>
            ))}
        </span>
    )
}

function Changes({ log }) {
    const oldValues = log.old_values ?? {}
    const newValues = log.new_values ?? {}
    const keys = [...new Set([...Object.keys(oldValues), ...Object.keys(newValues)])]

    return (
        <div className="space-y-3">
            {keys.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">This entry recorded no field-level values.</p>
            ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="hidden grid-cols-[11rem_1fr_1fr] gap-4 bg-gray-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sm:grid dark:bg-gray-900/40">
                        <span>Field</span>
                        <span>Before</span>
                        <span>After</span>
                    </div>
                    <dl className="divide-y divide-gray-100 bg-white dark:divide-gray-700/60 dark:bg-gray-800">
                        {keys.map((key) => {
                            const before = display(oldValues[key])
                            const after = display(newValues[key])
                            const changed = before !== after

                            return (
                                <div key={key} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[11rem_1fr_1fr] sm:gap-4">
                                    <dt className="font-medium text-gray-700 dark:text-gray-300">{fieldLabel(key)}</dt>
                                    <dd className="break-all text-gray-500 dark:text-gray-400">
                                        <span className="text-[10px] uppercase text-gray-400 sm:hidden">Before </span>
                                        {changed && before !== '—' ? <s className="decoration-rose-300">{before}</s> : before}
                                    </dd>
                                    <dd className={`break-all ${changed ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                        <span className="text-[10px] uppercase text-gray-400 sm:hidden">After </span>
                                        {after}
                                    </dd>
                                </div>
                            )
                        })}
                    </dl>
                </div>
            )}

            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                <span>{fullStamp(log.created_at)}</span>
                {log.ip_address && <span>IP {log.ip_address}</span>}
                {log.user_agent && <span className="break-all">{log.user_agent}</span>}
            </div>
        </div>
    )
}

const inputClass = 'rounded-lg border-gray-200 bg-gray-50 text-xs text-gray-700 shadow-sm focus:border-indigo-400 focus:ring-indigo-500/40 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200'

const EMPTY = { search: '', action: '', user: '', views: false, from: '', to: '' }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditIndex({ logs, filters = {}, actions = [], people = [], stats = {} }) {
    const [form, setForm] = useState({ ...EMPTY, ...filters, views: Boolean(filters.views) })
    const [openRow, setOpenRow] = useState(null)
    const [loading, setLoading] = useState(false)
    const isFirstRender = useRef(true)

    const rows = logs?.data ?? []

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        const timer = setTimeout(() => {
            const params = Object.fromEntries(Object.entries(form)
                .filter(([, value]) => value !== '' && value !== false)
                .map(([key, value]) => [key, value === true ? 1 : value]))

            router.get(route('audit-logs.index'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            })
        }, 300)

        return () => clearTimeout(timer)
    }, [form])

    const groups = useMemo(() => {
        const result = []
        let current = null

        for (const log of rows) {
            const key = (parseDate(log.created_at) ?? new Date(log.created_at)).toDateString()
            if (!current || current.key !== key) {
                current = { key, label: dayLabel(log.created_at), logs: [] }
                result.push(current)
            }
            current.logs.push(log)
        }

        return result
    }, [rows])

    const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
    const clearFilters = () => setForm(EMPTY)

    const pills = [
        form.search && { key: 'search', label: `Matching “${form.search}”` },
        form.action && { key: 'action', label: actionLabel(form.action) },
        form.user && { key: 'user', label: userName(people.find((p) => String(p.emp_id) === String(form.user))) },
        form.from && { key: 'from', label: `From ${formatDate(form.from, form.from)}` },
        form.to && { key: 'to', label: `Until ${formatDate(form.to, form.to)}` },
        form.views && { key: 'views', label: 'Including page views', clear: false },
    ].filter(Boolean)

    return (
        <Layout>
            <Head title="Audit Trail" />

            <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Audit Trail</h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Every change made in the system, who made it, and when.
                        </p>
                    </div>
                    {logs?.total > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
                            {loading ? 'Updating…' : `${logs.from}–${logs.to} of ${logs.total.toLocaleString()} ${form.views ? 'entries' : 'changes'}`}
                        </p>
                    )}
                </header>

                {/* At a glance */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Stat icon={Activity} label="Changes today" value={stats.changes_today} />
                    <Stat icon={History} label="Changes, last 7 days" value={stats.changes_week} />
                    <Stat icon={Users} label="People active today" value={stats.people_today} hint="Who made a change" />
                    <Stat icon={Eye} label="Page views today" value={stats.views_today} hint="Hidden unless included" />
                </div>

                {/* Filters */}
                <section className="space-y-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                            <label htmlFor="audit-search" className="sr-only">Search entries</label>
                            <input
                                id="audit-search"
                                type="search"
                                value={form.search}
                                onChange={update('search')}
                                placeholder="Search by person, record or description…"
                                className={`w-full py-2 pl-9 pr-3 ${inputClass}`}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label htmlFor="audit-user" className="sr-only">Who</label>
                            <select id="audit-user" value={form.user} onChange={update('user')} className={inputClass}>
                                <option value="">Everyone</option>
                                {people.map((p) => (
                                    <option key={p.emp_id} value={p.emp_id}>{userName(p)} ({p.total})</option>
                                ))}
                            </select>
                            <label htmlFor="audit-action" className="sr-only">Action</label>
                            <select id="audit-action" value={form.action} onChange={update('action')} className={inputClass}>
                                <option value="">Every action</option>
                                {actions.map((a) => (
                                    <option key={a.action} value={a.action}>{actionLabel(a.action)} ({a.total})</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <label htmlFor="audit-from">From</label>
                            <DateInput id="audit-from" value={form.from} max={form.to || undefined} onChange={update('from')} className="w-40" />
                            <label htmlFor="audit-to">until</label>
                            <DateInput id="audit-to" value={form.to} min={form.from || undefined} onChange={update('to')} className="w-40" />
                        </div>
                        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <input
                                type="checkbox"
                                checked={form.views}
                                onChange={(e) => setForm((prev) => ({ ...prev, views: e.target.checked, action: '' }))}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900"
                            />
                            Include page views
                        </label>
                    </div>

                    {pills.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700/60">
                            {pills.map((pill) => (
                                <button
                                    key={pill.key}
                                    type="button"
                                    onClick={() => setForm((prev) => ({ ...prev, [pill.key]: pill.key === 'views' ? false : '' }))}
                                    className="group inline-flex items-center gap-1.5 rounded-full bg-indigo-50 py-0.5 pl-2.5 pr-2 text-xs text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                                >
                                    {pill.label}
                                    <span aria-hidden="true" className="text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-100">×</span>
                                    <span className="sr-only">Remove this filter</span>
                                </button>
                            ))}
                            <button type="button" onClick={clearFilters} className="text-xs text-gray-500 hover:text-indigo-600 hover:underline dark:text-gray-400 dark:hover:text-indigo-400">
                                Clear all
                            </button>
                        </div>
                    )}
                </section>

                {/* Entries, grouped by day */}
                <section className={`overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-opacity dark:border-gray-700/60 dark:bg-gray-800 ${loading ? 'opacity-60' : ''}`}>
                    {rows.length === 0 ? (
                        <div className="px-6 py-16 text-center">
                            <History className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {pills.length > 0 ? 'No entries match these filters' : 'Nothing recorded yet'}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {pills.length > 0 ? 'Widen the date range or clear the search.' : 'Entries appear here as soon as people start changing records.'}
                            </p>
                        </div>
                    ) : (
                        groups.map((group) => (
                            <section key={group.key} aria-label={group.label}>
                                <h2 className="sticky top-0 z-10 border-b border-gray-100 bg-gray-50/95 px-5 py-2 text-[11px] font-semibold text-gray-600 backdrop-blur dark:border-gray-700/60 dark:bg-gray-900/80 dark:text-gray-300">
                                    {group.label}
                                    <span className="ml-2 font-normal text-gray-400">{group.logs.length}</span>
                                </h2>
                                <ul className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                    {group.logs.map((log) => {
                                        const isOpen = openRow === log.id
                                        const hasValues = Object.keys(log.old_values ?? {}).length + Object.keys(log.new_values ?? {}).length > 0
                                        return (
                                            <Fragment key={log.id}>
                                                <li className="grid grid-cols-[3.75rem_1fr_auto] items-start gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-gray-900/20 sm:grid-cols-[4.5rem_12rem_1fr_auto]">
                                                    <time
                                                        dateTime={log.created_at}
                                                        title={fullStamp(log.created_at)}
                                                        className="pt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400"
                                                    >
                                                        {formatTime(log.created_at)}
                                                    </time>
                                                    <div className="col-span-1 hidden min-w-0 items-center gap-2 sm:flex">
                                                        <span aria-hidden="true" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                            {initials(log.user)}
                                                        </span>
                                                        <span className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{userName(log.user)}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <ActionPill action={log.action} />
                                                            <RecordRef log={log} />
                                                            <span className="text-[11px] text-gray-500 sm:hidden dark:text-gray-400">· {userName(log.user)}</span>
                                                        </div>
                                                        {log.description && (
                                                            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">{log.description}</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-expanded={isOpen}
                                                        aria-controls={`audit-detail-${log.id}`}
                                                        aria-label={isOpen ? 'Hide details' : 'Show details'}
                                                        onClick={() => setOpenRow(isOpen ? null : log.id)}
                                                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${hasValues ? 'text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/40'}`}
                                                    >
                                                        <span className="hidden sm:inline">{hasValues ? 'Changes' : 'Details'}</span>
                                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </li>
                                                {isOpen && (
                                                    <li id={`audit-detail-${log.id}`} className="bg-gray-50/70 px-5 py-4 dark:bg-gray-900/30 sm:pl-[calc(4.5rem+12rem+2.75rem)]">
                                                        <Changes log={log} />
                                                    </li>
                                                )}
                                            </Fragment>
                                        )
                                    })}
                                </ul>
                            </section>
                        ))
                    )}

                    {logs?.links?.length > 3 && (
                        <nav aria-label="Audit trail pages" className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700/60 dark:bg-gray-900/20">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">{logs.from}–{logs.to} of {logs.total.toLocaleString()}</p>
                            <div className="flex flex-wrap gap-1">
                                {logs.links.map((link, index) => (
                                    <Link
                                        key={index}
                                        href={link.url ?? '#'}
                                        preserveState
                                        preserveScroll
                                        aria-current={link.active ? 'page' : undefined}
                                        className={`rounded-md border px-2.5 py-1 text-[11px] transition-all ${link.active
                                            ? 'border-indigo-600 bg-indigo-600 text-white'
                                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-900/40'} ${!link.url ? 'pointer-events-none opacity-50' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </nav>
                    )}
                </section>
            </div>
        </Layout>
    )
}

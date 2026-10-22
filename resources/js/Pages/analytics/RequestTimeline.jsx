import { Head, Link, usePage } from '@inertiajs/react'
import { useState } from 'react'
import {
    ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, ClipboardCheck, FileText, Package, PackageCheck, XCircle,
} from 'lucide-react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx'
import CancelProcurementModal from '@/Components/CancelProcurementModal.jsx'
import ChangeStatusModal from '@/Components/ChangeStatusModal.jsx'
import { getStatusConfig } from '@/Constants/statusConfig.js'
import { formatDate, formatDateTime } from '@/Utils/formatDate.js'

/**
 * Rows created before the timestamp migration carry a midnight time, which is
 * the absence of a time rather than a real one — so exact midnight prints as a
 * date alone instead of claiming work happened at 12:00 AM.
 */
function fmt(value) {
    if (!value) return null
    return formatDateTime(value, { dateOnlyAtMidnight: true }, String(value))
}

function gapLabel(a, b) {
    // A date-only stamp has no time to measure from.
    if (String(a).endsWith(' 00:00:00') || String(b).endsWith(' 00:00:00')) return null
    const ms = new Date(String(b).replace(' ', 'T')) - new Date(String(a).replace(' ', 'T'))
    if (isNaN(ms) || ms <= 0) return null

    const minutes = ms / 60_000
    if (minutes < 1) return 'moments later'
    if (minutes < 60) return `${Math.round(minutes)} min later`

    const hours = minutes / 60
    if (hours < 48) return `${Math.round(hours)} h later`

    return `${Math.round(hours / 24)} days later`
}

/** Icon and colour for each kind of event, so the story can be scanned by shape. */
const STOP_KEYS = ['declined', 'cancelled', 'po_cancelled']
function markerFor(event) {
    if (STOP_KEYS.includes(event.key)) return { icon: XCircle, style: 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30' }
    if (event.key === 'released') return { icon: PackageCheck, style: 'bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30' }
    switch (event.source) {
        case 'Inspection': return { icon: ClipboardCheck, style: 'bg-teal-50 text-teal-600 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30' }
        case 'Missing': return { icon: CircleAlert, style: 'bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30' }
        case 'Resolved': return { icon: CheckCircle2, style: 'bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30' }
        case 'Purchase Order': return { icon: Package, style: 'bg-sky-50 text-sky-600 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30' }
        default: return { icon: FileText, style: 'bg-indigo-50 text-indigo-600 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30' }
    }
}

/** Where an order at each status is worked on, so the timeline can link to it. */
const STAGE_PAGES = {
    230: ['inventory.incoming', (po) => route('inventory.index', { order: po.id }), 'Incoming'],
    300: ['inventory.iar', (po) => route('inspection-acceptance-reports.index', { order: po.id }), 'Inspection & Acceptance'],
    400: ['inventory.ris', (po) => route('ris.index', { order: po.id }), 'RIS'],
    500: ['inventory.ssmi', (po) => route('ssmi.index', { order: po.id }), 'SSMI'],
    550: ['inventory.outgoing', (po) => route('inventory.outgoings', { order: po.id }), 'Outgoing'],
    600: ['inventory.outgoing', (po) => route('inventory.outgoings', { view: 'released', order: po.id }), 'Outgoing'],
}

function Fact({ label, children, mono = false }) {
    return (
        <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</dt>
            <dd className={`text-xs font-medium text-gray-900 dark:text-white ${mono ? 'font-mono' : ''}`}>{children ?? '—'}</dd>
        </div>
    )
}

export default function RequestTimeline({
    request,
    po,
    timeline = [],
    status,
    ageInDays,
    cancellation = {},
    statusOptions = [],
}) {
    const { auth } = usePage().props
    const permissions = auth?.permissions ?? []
    const mayOverride = permissions.includes('procurement.override')
    const canCancelSomething = !(cancellation.requestRefusal && cancellation.orderRefusal)
    const canMove = statusOptions.some((o) => !o.blocked && !o.current)
    const [cancelOpen, setCancelOpen] = useState(false)
    const [moveOpen, setMoveOpen] = useState(false)

    const statusConfig = getStatusConfig(status?.status_code)
    const stagePage = po ? STAGE_PAGES[Number(po.status)] : null
    const stageLink = stagePage && permissions.includes(stagePage[0]) ? stagePage[1](po) : null

    return (
        <AuthenticatedLayout>
            <Head title={`Timeline · ${request.pr_number}`} />

            <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <Link
                    href={route('request-monitoring.index')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Request Monitoring
                </Link>

                {/* Header */}
                <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                    <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">{request.requester_department || 'No department'}</p>
                            <h1 className="mt-0.5 font-mono text-xl font-semibold text-gray-900 dark:text-white">{request.pr_number}</h1>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusConfig.style}`}>
                                    <span className="h-1 w-1 rounded-full bg-current" />
                                    {status?.status_desc ?? statusConfig.label}
                                </span>
                                <span>Filed {formatDate(request.created_at)} · open {ageInDays} {ageInDays === 1 ? 'day' : 'days'}</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {stageLink && (
                                <Link
                                    href={stageLink}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                                >
                                    Open in {stagePage[2]}
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            )}
                            {mayOverride && canMove && (
                                <button
                                    type="button"
                                    onClick={() => setMoveOpen(true)}
                                    className="rounded-full border border-gray-300 px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    Change status…
                                </button>
                            )}
                            {mayOverride && canCancelSomething && (
                                <button
                                    type="button"
                                    onClick={() => setCancelOpen(true)}
                                    className="rounded-full border border-red-300 px-3.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-950/40"
                                >
                                    Cancel…
                                </button>
                            )}
                        </div>
                    </div>

                    {request.cancellation_reason && (
                        <div className="border-t border-gray-100 bg-rose-50/60 px-6 py-3 text-xs dark:border-gray-700/60 dark:bg-rose-500/5">
                            <span className="font-semibold text-rose-800 dark:text-rose-300">Cancelled:</span>{' '}
                            <span className="text-rose-700 dark:text-rose-300/90">{request.cancellation_reason}</span>
                        </div>
                    )}

                    <dl className="grid grid-cols-2 gap-4 border-t border-gray-100 px-6 py-5 sm:grid-cols-3 lg:grid-cols-6 dark:border-gray-700/60">
                        <Fact label="Mode">{request.mode_of_procurement ?? 'Not yet tagged'}</Fact>
                        <Fact label="Supplier">{po?.PO_Supplier ?? 'Not yet awarded'}</Fact>
                        <Fact label="PO No." mono>{po?.PO_Number}</Fact>
                        <Fact label="RIS No." mono>{po?.RIS_Number}</Fact>
                        <Fact label="SSMI No." mono>{po?.SSMI_Number}</Fact>
                        <Fact label={po?.released_at ? 'Released to' : 'Delivery'}>
                            {po?.released_at
                                ? po.released_to
                                : po?.received_at ? `Accepted ${formatDate(po.received_at)}` : po?.PO_Number ? 'Not yet received' : null}
                        </Fact>
                    </dl>
                </section>

                {/* Timeline */}
                <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                    <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700/60">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Timeline</h2>
                        <span className="text-[11px] text-gray-400">{timeline.length} {timeline.length === 1 ? 'event' : 'events'}</span>
                    </header>

                    {timeline.length === 0 ? (
                        <p className="px-6 py-8 text-sm text-gray-500 dark:text-gray-400">
                            Nothing has been recorded on this request beyond its creation.
                        </p>
                    ) : (
                        <ol className="px-6 py-5">
                            {timeline.map((event, i) => {
                                const { icon: Icon, style } = markerFor(event)
                                const gap = i > 0 ? gapLabel(timeline[i - 1].date, event.date) : null
                                const last = i === timeline.length - 1
                                return (
                                    <li key={event.key} className="relative flex gap-4 pb-6 last:pb-0">
                                        {/* The line down to the next event */}
                                        {!last && <span aria-hidden="true" className="absolute left-4 top-9 -bottom-0 w-px bg-gray-200 dark:bg-gray-700" />}
                                        <span className={`relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${style}`}>
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1 pt-1">
                                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.label}</p>
                                                <time className="text-xs text-gray-500 dark:text-gray-400">{fmt(event.date)}</time>
                                            </div>
                                            {event.detail && (
                                                <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">{event.detail}</p>
                                            )}
                                            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                                {event.actor_name ? `by ${event.actor_name}` : event.source === 'Inspection' ? 'Inspection & Acceptance' : 'no recorded actor'}
                                                {gap && <span className="text-gray-400"> · {gap}</span>}
                                            </p>
                                        </div>
                                    </li>
                                )
                            })}
                        </ol>
                    )}
                </section>
            </div>

            <CancelProcurementModal
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                prId={request.id}
                prNumber={request.pr_number}
                poId={po?.id}
                poNumber={po?.PO_Number}
                requestRefusal={cancellation.requestRefusal}
                orderRefusal={cancellation.orderRefusal}
            />

            <ChangeStatusModal
                open={moveOpen}
                onClose={() => setMoveOpen(false)}
                prId={request.id}
                prNumber={request.pr_number}
                poId={po?.id}
                options={statusOptions}
            />
        </AuthenticatedLayout>
    )
}

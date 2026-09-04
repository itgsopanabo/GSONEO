import { Head, Link } from '@inertiajs/react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx'

/**
 * Rows created before the timestamp migration carry a midnight time, which is
 * the absence of a time rather than a real one — so exact midnight prints as a
 * date alone instead of claiming work happened at 12:00 AM.
 */
function fmt(value) {
    if (!value) return null
    const d = new Date(String(value).replace(' ', 'T'))
    if (isNaN(d)) return String(value)

    const midnight = d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0

    return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...(midnight ? {} : { hour: 'numeric', minute: '2-digit' }),
    })
}

function gapLabel(a, b) {
    const ms = new Date(String(b).replace(' ', 'T')) - new Date(String(a).replace(' ', 'T'))
    if (isNaN(ms) || ms <= 0) return null

    const minutes = ms / 60_000
    if (minutes < 60) return `${Math.round(minutes)} minutes later`

    const hours = minutes / 60
    if (hours < 48) return `${Math.round(hours)} hours later`

    return `${Math.round(hours / 24)} days later`
}

export default function RequestTimeline({ request, po, timeline = [], status, ageInDays }) {
    return (
        <AuthenticatedLayout>
            <Head title={`Timeline · ${request.pr_number}`} />

            <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
                <div>
                    <Link
                        href={route('request-monitoring.index')}
                        className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        Back to monitoring
                    </Link>
                    <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                        {request.pr_number}
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Filed by {request.requester_name} · {request.requester_department} · open {ageInDays} days
                    </p>
                </div>

                <dl className="grid gap-4 rounded-lg border border-gray-200 bg-white p-6 text-sm sm:grid-cols-3 dark:border-gray-700 dark:bg-gray-800">
                    <div>
                        <dt className="text-gray-500 dark:text-gray-400">Current status</dt>
                        <dd className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                            {status?.status_desc ?? 'Unknown'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-gray-500 dark:text-gray-400">Mode of procurement</dt>
                        <dd className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                            {request.mode_of_procurement ?? 'Not yet tagged'}
                        </dd>
                    </div>
                    <div>
                        <dt className="text-gray-500 dark:text-gray-400">Supplier</dt>
                        <dd className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                            {po?.PO_Supplier ?? 'Not yet awarded'}
                        </dd>
                    </div>
                </dl>

                <section>
                    <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Timeline</h2>

                    {timeline.length === 0 ? (
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                            Nothing has been recorded on this request beyond its creation.
                        </p>
                    ) : (
                        <ol className="mt-4 border-l border-gray-200 dark:border-gray-700">
                            {timeline.map((event, i) => {
                                const gap = i > 0 ? gapLabel(timeline[i - 1].date, event.date) : null
                                return (
                                    <li key={event.key} className="relative py-4 pl-6">
                                        <span className="absolute -left-[5px] top-6 h-2.5 w-2.5 rounded-full bg-gray-400 ring-4 ring-white dark:bg-gray-500 dark:ring-gray-900" />
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <span className="font-medium text-gray-900 dark:text-gray-100">
                                                {event.label}
                                            </span>
                                            <time className="text-sm text-gray-500 dark:text-gray-400">
                                                {fmt(event.date)}
                                            </time>
                                        </div>
                                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                            {event.actor_name ? `by ${event.actor_name}` : 'no recorded actor'}
                                            {gap && ` · ${gap}`}
                                        </p>
                                    </li>
                                )
                            })}
                        </ol>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    )
}

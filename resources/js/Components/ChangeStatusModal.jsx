import { useEffect, useMemo, useState } from 'react'
import { router } from '@inertiajs/react'

/**
 * Moving a request or an order to another status (administrators only).
 *
 * The repair tool for records that went the wrong way — a delivery that reached
 * SSMI when it belonged in Incoming. Every option comes from the server
 * (`status_options`), including the ones that are unavailable and the sentence
 * saying why, so the dialog never offers a move the route would refuse.
 *
 * `voids` lists the document numbers a move would cancel: going back below the
 * RIS or SSMI stage clears that number so the stage can be done again, because
 * neither module will issue a second one over an existing number.
 */
export default function ChangeStatusModal({ open, onClose, prId, prNumber, poId, options = [] }) {
    const available = useMemo(() => options.filter((o) => !o.blocked && !o.current), [options])
    const unavailable = useMemo(() => options.filter((o) => o.blocked), [options])

    const [choice, setChoice] = useState('')
    const [reason, setReason] = useState('')
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState(null)
    const [showBlocked, setShowBlocked] = useState(false)

    useEffect(() => {
        if (!open) return
        setChoice('')
        setReason('')
        setError(null)
        setProcessing(false)
        setShowBlocked(false)
    }, [open])

    if (!open) return null

    const selected = available.find((o) => `${o.record}:${o.code}` === choice)
    const current = options.find((o) => o.current)
    const ready = selected && reason.trim().length >= 5 && !processing

    function submit() {
        if (!ready) return

        setProcessing(true)
        setError(null)

        const target =
            selected.record === 'request'
                ? route('purchase-requests.status', prId)
                : route('purchase-orders.status', poId)

        router.post(
            target,
            { status: selected.code, reason: reason.trim() },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    // A refusal arrives as a flash message, not an error status.
                    const refused = page.props?.flash?.error
                    if (refused) {
                        setError(refused)
                        return
                    }
                    onClose()
                },
                onError: (errors) =>
                    setError(errors.status ?? errors.reason ?? 'The status could not be changed.'),
                onFinish: () => setProcessing(false),
            },
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-100 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Change status · {prNumber}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {current
                        ? `Currently ${current.label} (${current.record === 'order' ? 'purchase order' : 'purchase request'}).`
                        : 'Move this record to another stage.'}{' '}
                    The change is recorded in the audit trail.
                </p>

                <div className="mt-5">
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                        Move to
                    </label>
                    <select
                        value={choice}
                        onChange={(e) => setChoice(e.target.value)}
                        className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                        <option value="">Select a stage…</option>
                        {available.map((o) => (
                            <option key={`${o.record}:${o.code}`} value={`${o.record}:${o.code}`}>
                                {o.label} ({o.record === 'order' ? 'purchase order' : 'purchase request'})
                            </option>
                        ))}
                    </select>
                    {available.length === 0 && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            There is nowhere this record can be moved right now.
                        </p>
                    )}
                </div>

                {selected?.voids?.length > 0 && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        This voids {selected.voids.join(' and ')} so the stage can be done again. Any IAR already
                        issued is kept.
                    </p>
                )}

                <div className="mt-4">
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                        Reason
                    </label>
                    <textarea
                        required
                        rows={3}
                        placeholder="Why is this being moved? This is kept in the audit trail."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                </div>

                {unavailable.length > 0 && (
                    <div className="mt-4 text-sm">
                        <button
                            type="button"
                            onClick={() => setShowBlocked((v) => !v)}
                            className="text-gray-500 underline underline-offset-2 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            {showBlocked ? 'Hide' : `Why can't I pick ${unavailable.length} other stages?`}
                        </button>
                        {showBlocked && (
                            <ul className="mt-2 space-y-1 text-gray-500 dark:text-gray-400">
                                {unavailable.map((o) => (
                                    <li key={`${o.record}:${o.code}`}>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">{o.label}</span>{' '}
                                        — {o.blocked}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {error && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        {error}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={processing}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                        Leave it
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!ready}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {processing ? 'Moving…' : 'Move'}
                    </button>
                </div>
            </div>
        </div>
    )
}

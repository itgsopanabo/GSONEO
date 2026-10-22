import { useEffect, useState } from 'react'
import { router } from '@inertiajs/react'

/**
 * Cancelling a purchase request, or only its purchase order.
 *
 * Both choices are offered together because they are different decisions: the
 * whole request is void, or just the order is (a supplier backed out, a PO was
 * raised against the wrong request) and the request goes back to canvassing for
 * a new one.
 *
 * Whether either is allowed is decided on the server and arrives as
 * `requestRefusal` / `orderRefusal` — the sentence explaining why not, or null.
 * The modal never invents its own rules; it shows the server's.
 */
export default function CancelProcurementModal({
    open,
    onClose,
    prId,
    prNumber,
    poId,
    poNumber,
    requestRefusal = null,
    orderRefusal = null,
}) {
    const canCancelRequest = !requestRefusal
    const canCancelOrder = !orderRefusal

    const [scope, setScope] = useState(canCancelRequest ? 'request' : 'order')
    const [reason, setReason] = useState('')
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState(null)

    // A fresh dialog every time it opens, on whichever choice is available.
    useEffect(() => {
        if (!open) return
        setScope(canCancelRequest ? 'request' : 'order')
        setReason('')
        setError(null)
        setProcessing(false)
    }, [open, canCancelRequest])

    if (!open) return null

    const chosenAllowed = scope === 'request' ? canCancelRequest : canCancelOrder
    const ready = chosenAllowed && reason.trim().length >= 5 && !processing

    function submit() {
        if (!ready) return

        setProcessing(true)
        setError(null)

        const target =
            scope === 'request'
                ? route('purchase-requests.cancel', prId)
                : route('purchase-orders.cancel', poId)

        router.post(
            target,
            { reason: reason.trim() },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    // The server refuses through a flash message rather than an
                    // error status, so a "success" can still be a refusal.
                    const refused = page.props?.flash?.error
                    if (refused) {
                        setError(refused)
                        return
                    }
                    onClose()
                },
                onError: (errors) => setError(errors.reason ?? 'The cancellation could not be saved.'),
                onFinish: () => setProcessing(false),
            },
        )
    }

    const Option = ({ value, title, description, refusal }) => (
        <label
            className={`flex gap-3 rounded-lg border p-3 ${
                refusal
                    ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-70 dark:border-gray-700 dark:bg-gray-900/40'
                    : 'cursor-pointer border-gray-300 hover:border-red-400 dark:border-gray-600 dark:hover:border-red-500'
            } ${scope === value && !refusal ? 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950/30' : ''}`}
        >
            <input
                type="radio"
                name="cancel-scope"
                className="mt-1 text-red-600 focus:ring-red-500"
                checked={scope === value}
                disabled={!!refusal}
                onChange={() => setScope(value)}
            />
            <span className="text-sm">
                <span className="block font-medium text-gray-900 dark:text-gray-100">{title}</span>
                <span className="mt-0.5 block text-gray-500 dark:text-gray-400">{refusal || description}</span>
            </span>
        </label>
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl border border-gray-100 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Cancel {prNumber}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    The record is kept, with who cancelled it and why. It cannot be undone from the app.
                </p>

                <div className="mt-5 space-y-2">
                    <Option
                        value="request"
                        title="Cancel the whole request"
                        description={
                            poNumber
                                ? `The request and purchase order ${poNumber} are both cancelled.`
                                : 'The request, and its purchase order if it has one, are cancelled.'
                        }
                        refusal={requestRefusal}
                    />
                    <Option
                        value="order"
                        title={poNumber ? `Cancel purchase order ${poNumber} only` : 'Cancel the purchase order only'}
                        description="The order is cancelled and the request returns to canvassing, ready for a new purchase order."
                        refusal={orderRefusal}
                    />
                </div>

                <div className="mt-5">
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                        Reason for cancellation
                    </label>
                    <textarea
                        required
                        rows={3}
                        autoFocus
                        placeholder="Why is this being cancelled? This is kept on the record and in the audit trail."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-red-500 focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                </div>

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
                        Keep it
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!ready}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {processing ? 'Cancelling…' : scope === 'request' ? 'Cancel request' : 'Cancel order'}
                    </button>
                </div>
            </div>
        </div>
    )
}

import { Head, useForm } from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import { getStatusConfig } from "@/constants/statusConfig";

export default function IncomingShow({ purchaseOrder }) {
    const pr = purchaseOrder?.purchase_request;
    const items = pr?.items ?? [];

    // Calculate total from items
    const grandTotal = items.reduce((sum, item) => {
        const cost = parseFloat(item.total_bidding_unit_cost ?? item.total_estimated_cost ?? 0);
        return sum + cost;
    }, 0);

    // Get status styling and label
    const status = getStatusConfig(purchaseOrder?.status);

    // Inertia form initialized with PO_Number required by toIAR method
    const { data, post, processing, errors } = useForm({
        PO_Number: purchaseOrder?.PO_Number ?? '',
    });

    const handleToIAR = (e) => {
        e.preventDefault();
        post(route('inventory.toIAR'), {
            preserveScroll: true,
            onError: (err) => console.error('Error updating PO status:', err),
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title={`IAR — PO #${purchaseOrder?.PO_Number ?? purchaseOrder?.id}`} />

            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            Incoming — PO #{purchaseOrder?.PO_Number ?? '—'}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Review order details and update status to proceed to IAR
                        </p>
                    </div>
                </div>

                {errors.error && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                        {errors.error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left: Order Info Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4 h-fit">
                        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            Order Info
                        </h2>

                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 block mb-1">Status</span>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${status.style}`}>
                                {status.label}
                            </span>
                        </div>

                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 block">PO Number</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{purchaseOrder?.PO_Number ?? '—'}</span>
                        </div>

                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 block">PR Number</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{purchaseOrder?.PR_Number ?? '—'}</span>
                        </div>

                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 block">Supplier</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{purchaseOrder?.PO_Supplier ?? '—'}</span>
                        </div>

                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 block">PO Date</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{purchaseOrder?.PO_Date ?? '—'}</span>
                        </div>

                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 block">Date Received from Supplier</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{purchaseOrder?.supplier_receive_date ?? '—'}</span>
                        </div>

                        <hr className="my-2 border-gray-100 dark:border-gray-700" />

                        <div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 block">Requester</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                                {pr?.requester_name ?? '—'} {pr?.requester_department ? `(${pr.requester_department})` : ''}
                            </span>
                        </div>
                    </div>

                    {/* Right: Items Table & Actions */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
                            <div className="flex items-center space-x-2">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Items for Inspection</h2>
                                <span className="px-2.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                                    {items.length} items
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                                    <thead className="text-xs text-gray-400 dark:text-gray-500 uppercase border-b border-gray-100 dark:border-gray-700">
                                    <tr>
                                        <th className="py-3 px-2">Item</th>
                                        <th className="py-3 px-2 text-center">Qty</th>
                                        <th className="py-3 px-2 text-right">Unit Price</th>
                                        <th className="py-3 px-2 text-right">Total</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                    {items.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                                            <td className="py-3 px-2">
                                                <p className="font-medium text-gray-800 dark:text-gray-200">{item.item_name}</p>
                                                {item.item_desc && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">{item.item_desc}</p>
                                                )}
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                {item.quantity} {item.unit}
                                            </td>
                                            <td className="py-3 px-2 text-right">
                                                ₱{Number(item.estimated_unit_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-3 px-2 text-right font-medium text-gray-900 dark:text-gray-100">
                                                ₱{Number(item.total_estimated_cost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan="4" className="py-6 text-center text-gray-400 dark:text-gray-500">
                                                No items found for this order.
                                            </td>
                                        </tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <span className="text-sm font-semibold uppercase text-gray-400 dark:text-gray-500">Grand Total</span>
                                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                                    ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {/* Submit Action triggers toIAR */}
                        <form onSubmit={handleToIAR} className="flex justify-end items-center gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 shadow-sm transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processing ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Updating Status...
                                    </>
                                ) : (
                                    <>
                                        Proceed to IAR
                                        <svg className="ml-2 -mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

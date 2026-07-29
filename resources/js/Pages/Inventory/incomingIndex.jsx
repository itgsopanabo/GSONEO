import { Head, Link } from '@inertiajs/react'
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import { STATUS_MAP } from "@/Constants/statusConfig.js";

function StatusBadge({ status }) {
    const config = STATUS_MAP[status] ?? {
        label: 'Unknown', style: 'bg-gray-50 text-gray-600 border-gray-200'
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.style}`}>
            {config.label}
        </span>
    );
}

function formatDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

export default function incomingIndex({ purchaseOrders }) {
    const orders = purchaseOrders?.data ?? [];

    console.log(orders)
    return (
        <AuthenticatedLayout>
            <Head title="Inspection & Acceptance Reports" />

            <div className="py-10 bg-gray-50 min-h-screen">
                <div className="max-w-6xl mx-auto sm:px-6 lg:px-8">

                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-gray-900">
                            Incoming
                        </h1>
                        <p className="text-gray-500 mt-1">
                            Purchase orders ready for incoming
                        </p>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-5">
                            <h2 className="text-lg font-bold text-gray-900">Orders</h2>
                            <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                {purchaseOrders?.total ?? orders.length} total
                            </span>
                        </div>

                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-y border-gray-100 text-gray-500">
                                <th className="px-6 py-3 text-left font-medium">PO Number</th>
                                <th className="px-6 py-3 text-left font-medium">Supplier</th>
                                <th className="px-6 py-3 text-left font-medium">PR Number</th>
                                <th className="px-6 py-3 text-left font-medium">PO Date</th>
                                <th className="px-6 py-3 text-right font-medium">Items</th>
                                <th className="px-6 py-3 text-left font-medium">Status</th>
                                <th className="px-6 py-3 text-right font-medium">Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                                        No purchase orders awaiting inspection.
                                    </td>
                                </tr>
                            )}
                            {orders.map((po, idx) => (
                                <tr key={po.id} className={idx % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                                    <td className="px-6 py-4 font-semibold text-gray-900">
                                        {po.PO_Number ?? '—'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        {po.PO_Supplier ?? '—'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        {po.PR_Number ?? '—'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-700">
                                        {formatDate(po.PO_Date)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-700">
                                        {po.purchase_request?.items?.length ?? 0}
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={po.status} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={route('inventory.show', po.PO_Number)}
                                            className="text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {purchaseOrders?.links && purchaseOrders.links.length > 3 && (
                        <div className="flex justify-center gap-1 mt-6">
                            {purchaseOrders.links.map((link, idx) => (
                                <Link
                                    key={idx}
                                    href={link.url ?? '#'}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                    className={`px-3 py-1.5 text-sm rounded-lg ${
                                        link.active
                                            ? 'bg-indigo-600 text-white'
                                            : link.url
                                                ? 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                                : 'text-gray-300 cursor-not-allowed'
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    )
}

import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import { Head, Link } from '@inertiajs/react'

const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-800 ring-yellow-600/20',
    approved: 'bg-green-100 text-green-800 ring-green-600/20',
    rejected: 'bg-red-100 text-red-800 ring-red-600/20',
    draft: 'bg-gray-100 text-gray-800 ring-gray-500/20',
};

function StatusBadge({ status }) {
    const statusText = typeof status === 'string' ? status : String(status ?? '—');
    const style = statusStyles[statusText.toLowerCase()] ?? 'bg-gray-100 text-gray-800 ring-gray-500/20';
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>
            {statusText}
        </span>
    );
}

export default function Index({ purchaseOrders }) {
    const rows = purchaseOrders?.data ?? [];

    return (
        <AuthenticatedLayout>
            <Head title="Purchase Orders" />

            <div className="py-8">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">

                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">Requisition and Issue Slip</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                {rows.length} {rows.length === 1 ? 'slip' : 'slips'} on this page
                            </p>
                        </div>
                        {/* Uncomment when ready
                        <Link
                            href={route('purchase-orders.create')}
                            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
                        >
                            New Purchase Order
                        </Link>
                        */}
                    </div>

                    <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">PO #</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date Created</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                            {rows.map((po) => (
                                <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        {po.PO_Number ?? '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge status={po.status} />
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">
                                        {po.created_at
                                            ? new Date(po.created_at).toLocaleDateString()
                                            : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Link
                                            href={route('ris.show', po.id)}
                                            className="text-sm font-medium text-indigo-600 hover:text-indigo-900"
                                        >
                                            View &rarr;
                                        </Link>
                                    </td>
                                </tr>
                            ))}

                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-12 text-center">
                                        <p className="text-sm text-gray-400">No purchase orders found.</p>
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {purchaseOrders?.links?.length > 3 && (
                        <div className="mt-4 flex justify-center gap-1">
                            {purchaseOrders.links.map((link, i) => (
                                <Link
                                    key={i}
                                    href={link.url || '#'}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                                        link.active
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
                                    } ${!link.url ? 'opacity-50 pointer-events-none' : ''}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    )
}

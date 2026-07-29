import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import { Head, Link } from '@inertiajs/react'

export default function Index({ purchaseOrders }) {
    return (
        <AuthenticatedLayout>
            <Head title="Purchase Orders" />

            <div className="py-6">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    {/*<div className="flex items-center justify-between mb-4">*/}
                    {/*    <h1 className="text-xl font-semibold">Purchase Orders</h1>*/}
                    {/*    <Link*/}
                    {/*        href={route('purchase-orders.create')}*/}
                    {/*        className="px-4 py-2 bg-blue-600 text-white rounded"*/}
                    {/*    >*/}
                    {/*        New Purchase Order*/}
                    {/*    </Link>*/}
                    {/*</div>*/}

                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                            <tr>
                                {/*<th className="px-4 py-2 text-left text-xs font-medium text-gray-500">PO #</th>*/}
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">PR #</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                                {/*<th className="px-4 py-2 text-left text-xs font-medium text-gray-500"># of Items</th>*/}
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date Receive</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                            {purchaseOrders.data.map((po) => (
                                <tr key={po.id}>
                                    {/*<td className="px-4 py-2">{po.PO_NUMBER}</td>*/}
                                    <td className="px-4 py-2">
                                        {po.PR_Number ?? '—'}
                                    </td>
                                    <td className="px-4 py-2">
                                            <span className="px-2 py-1 text-xs rounded bg-gray-100">
                                                {po.status}
                                            </span>
                                    </td>

                                    <td className="px-4 py-2">
                                        {new Date(po.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <Link
                                            href={route('purchase-orders.show', po.id)}
                                            className="text-blue-600 hover:underline"
                                        >
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}

                            {purchaseOrders.data.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                                        No purchase orders found.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="mt-4 flex justify-center gap-2">
                        {purchaseOrders.links.map((link, i) => (
                            <Link
                                key={i}
                                href={link.url || '#'}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                                className={`px-3 py-1 rounded text-sm ${
                                    link.active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                                } ${!link.url ? 'opacity-50 pointer-events-none' : ''}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    )
}

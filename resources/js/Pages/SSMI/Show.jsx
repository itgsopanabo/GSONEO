import {Head, Link, router, usePage} from '@inertiajs/react'
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";

const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    draft: 'bg-gray-100 text-gray-800',
};

function StatusBadge({status}) {
    // Coerce to a safe string regardless of what status actually is
    const statusText = typeof status === 'string' ? status : status?.label ?? status?.name ?? status?.value ?? String(status ?? '');

    const style = statusStyles[statusText.toLowerCase()] ?? 'bg-gray-100 text-gray-800';

    return (<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
            {statusText}
        </span>);
}

export default function Show({purchaseOrder}) {
    const items = purchaseOrder?.purchase_request?.items ?? [];
    const {flash} = usePage().props;

    const handleGenerateRIS = () => {
        router.post(route('ris.generateNumber', purchaseOrder.id), {}, {
            preserveScroll: true,
        });
    };

    return (<AuthenticatedLayout>
        <Head title={`PO ${purchaseOrder.PO_Number}`}/>

        <div className="py-8">
            <div className="mx-auto max-w-5xl sm:px-6 lg:px-8">

                <div className="mb-4 flex items-center justify-between">
                    <Link
                        href={route('ris.index')}
                        className="text-sm text-indigo-600 hover:text-indigo-900"
                    >
                        &larr; Back to List
                    </Link>
                </div>

                {flash?.success && (<div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-800">
                        {flash.success}
                    </div>)}
                {flash?.error && (<div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
                        {flash.error}
                    </div>)}

                <div className="overflow-hidden bg-white shadow-sm sm:rounded-lg">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-gray-200 p-6">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900">
                                Purchase Order {purchaseOrder.PO_Number}
                            </h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Linked to PR {purchaseOrder.PR_Number}
                            </p>
                        </div>
                        <StatusBadge status={purchaseOrder.status}/>
                    </div>

                    {/* Details */}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-6 sm:grid-cols-2">
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Supplier</dt>
                            <dd className="mt-1 text-sm text-gray-900">{purchaseOrder.PO_Supplier}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Status</dt>
                            <dd className="mt-1 text-sm text-gray-900">{purchaseOrder.status}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Date Created</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                                {purchaseOrder.created_at ? new Date(purchaseOrder.created_at).toLocaleDateString() : '—'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Purchase Request</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                                {purchaseOrder.PR_Number}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">RIS Number</dt>
                            <dd className="mt-1 flex items-center gap-3 text-sm text-gray-900">
                                {purchaseOrder.RIS_Number ? (<span>{purchaseOrder.RIS_Number}</span>) : (<button
                                        type="button"
                                        onClick={handleGenerateRIS}
                                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
                                    >
                                        Generate RIS Number
                                    </button>)}
                            </dd>
                        </div>
                    </dl>

                    {/* Items */}
                    <div className="border-t border-gray-200 p-6">
                        <h2 className="mb-4 text-sm font-semibold text-gray-900">Items</h2>

                        {items.length === 0 ? (
                            <p className="text-sm text-gray-500">No items found for this purchase request.</p>) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Item</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Quantity</th>
                                        <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Unit</th>
                                        <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Unit
                                            Price
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Subtotal</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                    {items.map((item) => (<tr key={item.id}>
                                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-900">{item.name}</td>
                                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{item.quantity}</td>
                                        <td className="whitespace-nowrap px-4 py-2 text-sm text-gray-500">{item.unit}</td>
                                        <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-gray-500">
                                            {Number(item.unit_price ?? 0).toFixed(2)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-gray-900">
                                            {(Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)).toFixed(2)}
                                        </td>
                                    </tr>))}
                                    </tbody>
                                </table>
                            </div>)}
                    </div>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>)
}

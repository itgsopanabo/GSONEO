import {Head, Link, useForm, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {STATUS_MAP} from "@/Constants/statusConfig.js";
import {useState} from 'react';

function StatusBadge({status}) {
    const config = STATUS_MAP[status] ?? {
        label: 'Unknown', style: 'bg-gray-50 text-gray-600 border-gray-200'
    };

    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.style}`}>
            {config.label}
        </span>);
}

function formatCurrency(value) {
    return `₱${Number(value ?? 0).toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

export default function Show({purchaseOrder}) {
    const {csrf_token} = usePage().props;
    const pr = purchaseOrder.purchase_request;
    const items = pr?.items ?? [];

    const grandTotal = items.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.estimated_unit_cost ?? 0), 0);

    // Form state for the generate-PO-number modal
    const {data, setData, post, processing} = useForm({
        po_number_mode: 'auto', // 'auto' or 'manual'
        po_number_input: '', supplier: '', date_received: '',
    });

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false, title: '', message: '', actionType: '',
    });

    const [poResultModal, setPoResultModal] = useState({
        isOpen: false, poNumber: null, supplier: null, dateReceived: null,
    });

    const closeModal = () => {
        setConfirmModal(prev => ({...prev, isOpen: false}));
    };

    const triggerPOGenerateNumberConfirmation = () => {
        setData({
            po_number_mode: 'auto', po_number_input: '', supplier: '', date_received: '',
        });
        setConfirmModal({
            isOpen: true,
            title: 'Generate Purchase Order Number',
            message: 'Choose to auto-generate a PO number or enter one manually, and provide the supplier details.',
            actionType: 'generatePONumber',
        });
    };

    const handleModalConfirm = () => {
        if (confirmModal.actionType === 'generatePONumber') {
            post(route('purchase-orders.generatePONumber', {purchase_order: purchaseOrder.id}), {
                preserveScroll: true, onSuccess: (page) => {
                    closeModal();

                    const updatedPO = page.props.purchaseOrder;
                    const poNumber = updatedPO?.po_number ?? page.props.flash?.po_number ?? (data.po_number_mode === 'manual' ? data.po_number_input : null) ?? purchaseOrder.po_number ?? null;

                    const supplier = updatedPO?.supplier ?? page.props.flash?.supplier ?? data.supplier ?? null;

                    const dateReceived = updatedPO?.date_received ?? page.props.flash?.date_received ?? data.date_received ?? null;

                    if (poNumber) {
                        setPoResultModal({isOpen: true, poNumber, supplier, dateReceived});
                    } else {
                        console.warn('[generatePONumber] No po_number found in response. Check that the controller returns purchaseOrder.po_number or flash.po_number in the redirect/response props.');
                    }

                    setData({
                        po_number_mode: 'auto', po_number_input: '', supplier: '', date_received: '',
                    });
                }, onError: (errors) => {
                    console.error('[generatePONumber] request failed:', errors);
                },
            });
        }
    };

    return (<AuthenticatedLayout>
        <Head title={`Purchase Order #${purchaseOrder.id}`}/>

        <div className="py-10 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto sm:px-6 lg:px-8">

                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Purchase Order #{purchaseOrder.id}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            View order details and line items
                        </p>
                    </div>
                    <Link
                        href={route('purchase-orders.index')}
                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Back to List
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

                    {/* Sidebar: order info */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <p className="text-xs font-semibold tracking-wider text-gray-400 mb-4">
                            ORDER INFO
                        </p>

                        <div className="space-y-5">
                            <div>
                                <p className="text-sm text-gray-500">Status</p>
                                <div className="mt-1">
                                    <StatusBadge status={purchaseOrder.status}/>
                                </div>
                            </div>

                            <div>
                                <p className="text-sm text-gray-500">Date Recieve</p>
                                <p className="font-semibold text-gray-900 mt-0.5">
                                    {new Date(purchaseOrder.created_at).toLocaleDateString('en-US', {
                                        year: 'numeric', month: 'long', day: 'numeric'
                                    })}
                                </p>
                            </div>

                            {purchaseOrder.po_number && (<div>
                                <p className="text-sm text-gray-500">PO Number</p>
                                <p className="font-semibold text-gray-900 mt-0.5">
                                    {purchaseOrder.po_number}
                                </p>
                            </div>)}

                            {purchaseOrder.supplier && (<div>
                                <p className="text-sm text-gray-500">Supplier</p>
                                <p className="font-semibold text-gray-900 mt-0.5">
                                    {purchaseOrder.supplier}
                                </p>
                            </div>)}

                            {purchaseOrder.date_received && (<div>
                                <p className="text-sm text-gray-500">Date Received from Supplier</p>
                                <p className="font-semibold text-gray-900 mt-0.5">
                                    {formatDate(purchaseOrder.date_received)}
                                </p>
                            </div>)}

                            {pr && (<div>
                                <p className="text-sm text-gray-500">Source PR</p>
                                <p className="font-semibold text-gray-900 mt-0.5">
                                    {purchaseOrder.PR_Number}
                                </p>
                            </div>)}
                        </div>
                    </div>

                    {/* Items */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-5">
                            <h2 className="text-lg font-bold text-gray-900">Order Items</h2>
                            <span
                                className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                    {items.length} items
                                </span>
                        </div>

                        <table className="w-full text-sm">
                            <thead>
                            <tr className="border-y border-gray-100 text-gray-500">
                                <th className="px-6 py-3 text-left font-medium">Item</th>
                                <th className="px-6 py-3 text-right font-medium">Qty</th>
                                <th className="px-6 py-3 text-right font-medium">Unit Price</th>
                                <th className="px-6 py-3 text-right font-medium">Total</th>
                            </tr>
                            </thead>
                            <tbody>
                            {items.map((item, idx) => {
                                const lineTotal = Number(item.quantity ?? 0) * Number(item.estimated_unit_cost ?? 0);
                                return (<tr key={item.id} className={idx % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-gray-900">
                                            {item.item_name ?? item.product_id}
                                        </p>
                                        {item.description && (<p className="text-gray-500 text-sm mt-0.5">
                                            {item.description}
                                        </p>)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-700">
                                        {item.quantity} {item.unit ?? ''}
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-700">
                                        {formatCurrency(item.estimated_unit_cost)}
                                    </td>
                                    <td className="px-6 py-4 text-right font-semibold text-gray-900">
                                        {formatCurrency(lineTotal)}
                                    </td>
                                </tr>);
                            })}
                            </tbody>
                        </table>

                        <div
                            className="flex items-center justify-between px-6 py-5 bg-gray-50 border-t border-gray-100">
                            <p className="text-xs font-semibold tracking-wider text-gray-400">
                                GRAND TOTAL
                            </p>
                            <p className="text-xl font-bold text-indigo-600">
                                {formatCurrency(grandTotal)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                {!purchaseOrder.po_number && (<div className="flex justify-end mt-6">
                    <button
                        type="button"
                        onClick={triggerPOGenerateNumberConfirmation}
                        className="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm"
                    >
                        Generate PO Number
                    </button>
                </div>)}
            </div>
        </div>

        {/* PO Number Result Modal */}
        {poResultModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                    className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-100 text-center">
                    <div
                        className="mx-auto mb-4 flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
                        <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24"
                             stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">
                        PO Number Generated
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        A new purchase order number was generated.
                    </p>
                    <div className="bg-gray-50 rounded-lg py-3 mb-6 space-y-2">
                        <p className="text-xl font-bold text-indigo-600 tracking-wide">
                            {poResultModal.poNumber}
                        </p>
                        {poResultModal.supplier && (<p className="text-sm text-gray-600">
                            Supplier: <span className="font-semibold">{poResultModal.supplier}</span>
                        </p>)}
                        {poResultModal.dateReceived && (<p className="text-sm text-gray-600">
                            Date Received: <span
                            className="font-semibold">{formatDate(poResultModal.dateReceived)}</span>
                        </p>)}
                    </div>
                    <button
                        type="button"
                        onClick={() => setPoResultModal({
                            isOpen: false, poNumber: null, supplier: null, dateReceived: null
                        })}
                        className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                    >
                        Done
                    </button>
                </div>
            </div>)}

        {/* Confirmation Modal */}
        {confirmModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                    className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden p-6 border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">
                        {confirmModal.title}
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        {confirmModal.message}
                    </p>

                    {confirmModal.actionType === 'generatePONumber' && (
                        <div className="space-y-4 mb-6 border-t border-b border-gray-100 py-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">
                                    PO Number
                                </label>
                                <div className="flex gap-2 mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setData(prev => ({
                                            ...prev, po_number_mode: 'auto', po_number_input: ''
                                        }))}
                                        className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${data.po_number_mode === 'auto' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    >
                                        Auto-generate
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setData(prev => ({...prev, po_number_mode: 'manual'}))}
                                        className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${data.po_number_mode === 'manual' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    >
                                        Enter manually
                                    </button>
                                </div>

                                {data.po_number_mode === 'manual' && (<input
                                    type="text"
                                    required
                                    placeholder="e.g., PO-2026-0001"
                                    value={data.po_number_input}
                                    onChange={e => setData('po_number_input', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />)}
                                {data.po_number_mode === 'auto' && (<p className="text-xs text-gray-400 italic">
                                    A PO number will be generated automatically upon confirmation.
                                </p>)}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                    Supplier:
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Supplier name"
                                    value={data.supplier}
                                    onChange={e => setData('supplier', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                    Date Received from Supplier:
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={data.date_received}
                                    onChange={e => setData('date_received', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>
                        </div>)}

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeModal}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleModalConfirm}
                            disabled={processing || !data.supplier || !data.date_received || (data.po_number_mode === 'manual' && !data.po_number_input)}
                            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700"
                        >
                            {processing ? 'Processing...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>)}
    </AuthenticatedLayout>);
}

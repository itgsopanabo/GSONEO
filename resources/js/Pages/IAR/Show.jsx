import {Head, Link, useForm} from '@inertiajs/react';
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

function formatDate(dateString) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

export default function Show({auth, purchaseOrder}) {
    const pr = purchaseOrder.purchase_request;
    const initialItems = pr?.items ?? [];

    // Acceptance Form
    const {data, setData, post, processing, reset} = useForm({
        inspector_name: '',
        date_inspected: '',
        invoice_number: '',
        invoice_date: '',
        remarks: '',
        selected_item_ids: initialItems.map(item => item.id), // Default: all selected
    });

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pdfModalOpen, setPdfModalOpen] = useState(false);

    // Modal state for PDF generation
    const [pdfDetails, setPdfDetails] = useState({
        invoice_number: '', invoice_date: '', selected_item_ids: initialItems.map(item => item.id),
    });

    // Toggle item selection helper
    const toggleItemSelection = (itemId, targetStateSetter) => {
        targetStateSetter(prev => {
            const currentIds = prev.selected_item_ids;
            const updatedIds = currentIds.includes(itemId) ? currentIds.filter(id => id !== itemId) : [...currentIds, itemId];

            return {...prev, selected_item_ids: updatedIds};
        });
    };

    const handleAccept = () => {
        post(route('inspection-acceptance-reports.accept', purchaseOrder.id), {
            preserveScroll: true, onSuccess: () => {
                setConfirmOpen(false);
            },
        });
    };

    // Generate PDF with query parameters (Invoice + Items)
    const handleConfirmPrintPdf = () => {
        const poId = purchaseOrder?.id;

        console.log("Purchase Order ID:", poId);
        console.log("Generated Route:", route('inspection-acceptance-reports.pdf', {purchaseOrder: poId}));

        if (!poId) {
            console.error("Cannot generate PDF: Purchase Order ID is missing.");
            return;
        }

        const queryParams = new URLSearchParams({
            invoice_number: pdfDetails.invoice_number,
            invoice_date: pdfDetails.invoice_date,
            item_ids: pdfDetails.selected_item_ids.join(','),
        });

        const url = `${route('inspection-acceptance-reports.pdf', {purchaseOrder: poId})}?${queryParams.toString()}`;
        window.open(url, '_blank');

        setPdfModalOpen(false);
        setPdfDetails({
            invoice_number: '', invoice_date: '', selected_item_ids: initialItems.map(item => item.id)
        });
    };


    return (<AuthenticatedLayout user={auth?.user}>
            <Head title={`IAR — PO #${purchaseOrder.PO_Number ?? purchaseOrder.id}`}/>

            <div className="py-10 bg-gray-50 min-h-screen">
                <div className="max-w-6xl mx-auto sm:px-6 lg:px-8">

                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Inspection & Acceptance — {purchaseOrder.PO_Number ?? `PO #${purchaseOrder.id}`}
                            </h1>
                            <p className="text-gray-500 mt-1">
                                Review order details, accept inspection, or print report
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link
                                href={route('inspection-acceptance-reports.index')}
                                className="inline-flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Back to List
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

                        {/* Sidebar: order info */}
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                            <p className="text-xs font-semibold tracking-wider text-gray-400 mb-4 uppercase">
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
                                    <p className="text-sm text-gray-500">PO Number</p>
                                    <p className="font-semibold text-gray-900 mt-0.5">
                                        {purchaseOrder.PO_Number ?? '—'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-500">Supplier</p>
                                    <p className="font-semibold text-gray-900 mt-0.5">
                                        {purchaseOrder.PO_Supplier ?? '—'}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-500">PO Date</p>
                                    <p className="font-semibold text-gray-900 mt-0.5">
                                        {formatDate(purchaseOrder.PO_Date)}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-500">Date Received from Supplier</p>
                                    <p className="font-semibold text-gray-900 mt-0.5">
                                        {formatDate(purchaseOrder.supplier_receive_date)}
                                    </p>
                                </div>

                                {pr && (<div>
                                        <p className="text-sm text-gray-500">Source PR</p>
                                        <p className="font-semibold text-gray-900 mt-0.5">
                                            {purchaseOrder.PR_Number}
                                        </p>
                                    </div>)}
                            </div>
                        </div>

                        {/* Items */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="flex items-center gap-3 px-6 py-5">
                                <h2 className="text-lg font-bold text-gray-900">Items for Inspection</h2>
                                <span
                                    className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                    {initialItems.length} items
                                </span>
                            </div>

                            <table className="w-full text-sm">
                                <thead>
                                <tr className="border-y border-gray-100 text-gray-500">
                                    <th className="px-6 py-3 text-left font-medium">Item</th>
                                    <th className="px-6 py-3 text-right font-medium">Qty</th>
                                </tr>
                                </thead>
                                <tbody>
                                {initialItems.map((item, idx) => (
                                    <tr key={item.id} className={idx % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold text-gray-900">
                                                {item.item_name ?? item.product_id}
                                            </p>
                                            {item.item_desc && (<p className="text-gray-500 text-sm mt-0.5">
                                                    {item.item_desc}
                                                </p>)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-700">
                                            {item.quantity} {item.unit ?? ''}
                                        </td>
                                    </tr>))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Action Section */}
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={() => setPdfModalOpen(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-full shadow-sm transition-colors"
                        >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                            </svg>
                            Print / Download PDF
                        </button>

                        {purchaseOrder.status === 230 && (<button
                                type="button"
                                onClick={() => setConfirmOpen(true)}
                                className="inline-flex items-center px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                            >
                                Accept for Inspection
                            </button>)}
                    </div>
                </div>
            </div>

            {/* Print / PDF Modal with Invoice and Item Selection */}
            {pdfModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 mb-1">
                            Print Options — Invoice & Items
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Provide the invoice number and select which items are included in this PDF report.
                        </p>

                        <div className="space-y-4 mb-6 border-t border-b border-gray-100 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Invoice No.
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. INV-2026-001"
                                        value={pdfDetails.invoice_number}
                                        onChange={e => setPdfDetails({...pdfDetails, invoice_number: e.target.value})}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Invoice Date
                                    </label>
                                    <input
                                        type="date"
                                        value={pdfDetails.invoice_date}
                                        onChange={e => setPdfDetails({...pdfDetails, invoice_date: e.target.value})}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">
                                    Included Items ({pdfDetails.selected_item_ids.length} of {initialItems.length})
                                </label>
                                <div
                                    className="max-h-40 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                                    {initialItems.map(item => (<label key={item.id}
                                                                      className="flex items-center gap-3 text-sm p-1.5 rounded hover:bg-white cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={pdfDetails.selected_item_ids.includes(item.id)}
                                                onChange={() => toggleItemSelection(item.id, setPdfDetails)}
                                                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="flex-1 font-medium text-gray-800">
                                                {item.item_name ?? item.product_id}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {item.quantity} {item.unit}
                                            </span>
                                        </label>))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPdfModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPrintPdf}
                                disabled={pdfDetails.selected_item_ids.length === 0}
                                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                            >
                                Generate PDF
                            </button>
                        </div>
                    </div>
                </div>)}

            {/* Confirm / Acceptance modal */}
            {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900 mb-2">
                            Confirm Inspection & Acceptance
                        </h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Record inspector details and invoice information before marking as accepted.
                        </p>

                        <div
                            className="space-y-4 mb-6 border-t border-b border-gray-100 py-4 max-h-[60vh] overflow-y-auto px-1">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                    Inspector Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={data.inspector_name}
                                    onChange={e => setData('inspector_name', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Date Inspected
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={data.date_inspected}
                                        onChange={e => setData('date_inspected', e.target.value)}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                        Invoice No.
                                    </label>
                                    <input
                                        type="text"
                                        value={data.invoice_number}
                                        onChange={e => setData('invoice_number', e.target.value)}
                                        className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                    Invoice Date
                                </label>
                                <input
                                    type="date"
                                    value={data.invoice_date}
                                    onChange={e => setData('invoice_date', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                                    Remarks (optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={data.remarks}
                                    onChange={e => setData('remarks', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmOpen(false)}
                                disabled={processing}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAccept}
                                disabled={processing || !data.inspector_name || !data.date_inspected}
                                className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700"
                            >
                                {processing ? 'Saving...' : 'Confirm Acceptance'}
                            </button>
                        </div>
                    </div>
                </div>)}
        </AuthenticatedLayout>);
}

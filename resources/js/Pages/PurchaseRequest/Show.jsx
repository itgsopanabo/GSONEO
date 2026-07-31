import {Head, Link, useForm, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {STATUS_MAP} from '@/constants/statusConfig';
import {useState} from 'react';

export default function Show({purchaseRequest}) {
    const {auth, csrf_token} = usePage().props;

    // Initialize useForm hook for modal inputs
    const {data, setData, post, processing} = useForm({
        opened_on: '', delivery_period: '', bac_date: '', supplier: '', date_received: '', po_number_mode: 'auto', // 'auto' or 'manual'
        po_number_input: '', poNumber: null, reason_to_decline: '', // TODO Add this for decline purpose
    });

    // Track modal state lifecycle
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false, title: '', message: '', actionType: '', // 'verify', 'decline', 'canvassing', 'PO Proceeding', 'generatePONumber', or 'canvass'
    });

    // PO numbering result modal
    const [poResultModal, setPoResultModal] = useState({
        isOpen: false, poNumber: null, supplier: null, dateReceived: null,
    });

    // Calculations
    const grandTotal = purchaseRequest.items.reduce((sum, item) => {
        return sum + (item.quantity * item.estimated_unit_cost);
    }, 0);

    const statusObj = STATUS_MAP[purchaseRequest.status] || {
        label: 'Unknown', style: 'bg-gray-100 text-gray-800 border-gray-200'
    };

    const isActionable = purchaseRequest.status === 0;
    const isVerified = purchaseRequest.status === 100;
    const isCanvassing = purchaseRequest.status === 200;
    const isPOReady = purchaseRequest.status === 210;

    // Formatters
    const formatCurrency = (value) => `₱${parseFloat(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // Modal Controllers
    const closeModal = () => {
        setConfirmModal(prev => ({...prev, isOpen: false}));
    };

    const triggerVerifyConfirmation = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Accept Purchase Request',
            message: 'Are you sure you want to accept this purchase request? This action will accept the request.',
            actionType: 'verify',
        });
    };

    const triggerProceedCanvasConfirmation = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Proceed Purchase Request for canvasing',
            message: 'Are you sure you want to proceed this purchase request to canvasing process?',
            actionType: 'canvassing',
        });
    };

    {/*TODO Add reason_to_decline*/}
    const triggerDeclineConfirmation = () => {
        setData(prev => ({...prev, reason_to_decline: ''}));
        setConfirmModal({
            isOpen: true,
            title: 'Decline Purchase Request',
            message: 'Are you sure you want to decline this purchase request? This action cannot be undone.',
            actionType: 'decline',
        });
    };

    const triggerPOProceedingConfirmation = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Purchase Order Proceedings',
            message: 'Are you sure you want to proceed this purchase request to Purchase Order proceedings.',
            actionType: 'PO Proceeding',
        });
    };

    const triggerPOGenerateNumberConfirmation = () => {
        setData(prev => ({
            ...prev, supplier: '', date_received: '', po_number_mode: 'auto', po_number_input: '',
        }));
        setConfirmModal({
            isOpen: true,
            title: 'Generate Purchase Order Number',
            message: 'Choose to auto-generate a PO number or enter one manually, and provide the supplier details.',
            actionType: 'generatePONumber',
        });
    };

    const triggerCanvassConfirmation = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Print Canvas Form',
            message: 'Please fill out the details below to append them to the printable canvas form.',
            actionType: 'canvass',
        });
    };

// Centralized Handler executing directly in component context scope
    const handleModalConfirm = () => {
        if (confirmModal.actionType === 'canvass') {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = route('purchase-requests.printCanvas', {purchase_request: purchaseRequest.pr_number});
            form.target = '_blank';

            // Inject CSRF Token directly from Inertia props
            const csrfInput = document.createElement('input');
            csrfInput.type = 'hidden';
            csrfInput.name = '_token';
            csrfInput.value = csrf_token;
            form.appendChild(csrfInput);

            // Append payload parameters including BAC Date
            const payload = {
                opened_on: data.opened_on, delivery_period: data.delivery_period, bac_date: data.bac_date,
            };

            Object.keys(payload).forEach(key => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = payload[key];
                form.appendChild(input);
            });

            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);

            // Reset dashboard layout state
            closeModal();
            setData({opened_on: '', delivery_period: '', bac_date: ''});
            return;
        }

        if (confirmModal.actionType === 'verify') {
            post(route('purchase-requests.verify', {purchase_request: purchaseRequest.id}), {
                preserveScroll: true, onSuccess: () => closeModal()
            });
            return;
        }

        if (confirmModal.actionType === 'canvassing') {
            post(route('purchase-requests.proceedCanvas', {purchase_request: purchaseRequest}), {
                preserveScroll: true, onSuccess: () => closeModal()
            });
            return;
        }

        if (confirmModal.actionType === 'PO Proceeding') {
            post(route('purchase-requests.verifyPO', {purchase_request: purchaseRequest.id}), {
                preserveScroll: true, onSuccess: (page) => {
                    closeModal();

                    const updatedPR = page.props.purchaseRequest;
                    const flashPoNumber = page.props.flash?.po_number;
                    const poNumber = updatedPR?.po_number ?? flashPoNumber ?? purchaseRequest.po_number ?? null;

                    if (poNumber) {
                        setPoResultModal({isOpen: true, poNumber, supplier: null, dateReceived: null});
                    } else {
                        console.warn('[verifyPO] No po_number found in response. ' + 'Check that the controller returns purchaseRequest.po_number ' + 'or flash.po_number in the redirect/response props.');
                    }
                }, onError: (errors) => {
                    console.error('[verifyPO] request failed:', errors);
                },
            });
            return;
        }

        if (confirmModal.actionType === 'generatePONumber') {
            post(route('purchase-requests.generatePONumber', {purchase_request: purchaseRequest.id}), {
                preserveScroll: true, onSuccess: (page) => {
                    closeModal();

                    const updatedPR = page.props.purchaseRequest;
                    const poNumber = updatedPR?.po_number ?? page.props.flash?.po_number ?? (data.po_number_mode === 'manual' ? data.po_number_input : null) ?? purchaseRequest.po_number ?? null;

                    const supplier = updatedPR?.supplier ?? page.props.flash?.supplier ?? data.supplier ?? null;

                    const dateReceived = updatedPR?.date_received ?? page.props.flash?.date_received ?? data.date_received ?? null;

                    if (poNumber) {
                        setPoResultModal({isOpen: true, poNumber, supplier, dateReceived});
                    } else {
                        console.warn('[generatePONumber] No po_number found in response. ' + 'Check that the controller returns purchaseRequest.po_number ' + 'or flash.po_number in the redirect/response props.');
                    }

                    setData({
                        supplier: '', date_received: '', po_number_mode: 'auto', po_number_input: '',
                    });
                }, onError: (errors) => {
                    console.error('[generatePONumber] request failed:', errors);
                },
            });
            return;
        }

        if (confirmModal.actionType === 'decline') {
            post(route('purchase-requests.decline', {purchase_request: purchaseRequest.id}), {
                preserveScroll: true, onSuccess: () => {
                    closeModal();
                    setData('reason_to_decline', '');
                }
            });
            return;
        }
    };

    return (<AuthenticatedLayout>
        <Head title={`PR #${purchaseRequest.id}`}/>

        <div className="py-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Purchase Request #{purchaseRequest.id}
                    </h1>
                    <p className="text-sm text-gray-500">View procurement details and line items</p>
                </div>

                <div className="flex gap-2">
                    {!isVerified && !isCanvassing && !isPOReady && (<a
                        href={route('purchase-requests.pdf', purchaseRequest.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors inline-flex items-center text-center"
                    >
                        Export PR to PDF
                    </a>)}
                    <Link
                        href={route('purchase-requests.index')}
                        className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                        Back to List
                    </Link>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {/* Metadata Column */}
                <div className="md:col-span-1 h-full">
                    <div
                        className="sticky top-6 space-y-4 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                            Request Info
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-[11px] text-gray-500">PR Number</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {purchaseRequest.pr_number}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-500">Status</p>
                                <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusObj.style}`}>
                                        {statusObj.label}
                                    </span>
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-500">Requester</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {purchaseRequest.requester_name}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-500">Department</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {purchaseRequest.requester_department}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] text-gray-500">Needed By</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {formatDate(purchaseRequest.needed_by_date)}
                                </p>
                            </div>
                            {purchaseRequest.po_number && (<div>
                                <p className="text-[11px] text-gray-500">PO Number</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {purchaseRequest.po_number}
                                </p>
                            </div>)}
                            {purchaseRequest.supplier && (<div>
                                <p className="text-[11px] text-gray-500">Supplier</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {purchaseRequest.supplier}
                                </p>
                            </div>)}
                            {purchaseRequest.date_received && (<div>
                                <p className="text-[11px] text-gray-500">Date Received from Supplier</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {formatDate(purchaseRequest.date_received)}
                                </p>
                            </div>)}
                        </div>
                    </div>
                </div>

                {/* Items Table Column */}
                <div className="md:col-span-2">
                    <div
                        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                Requested Items
                                <span
                                    className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                        {purchaseRequest.items.length} items
                                    </span>
                            </h3>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 text-xs">
                            <tr>
                                <th className="px-5 py-3 font-medium">Item</th>
                                <th className="px-5 py-3 font-medium text-right">Qty</th>
                                <th className="px-5 py-3 font-medium text-right">Unit Price</th>
                                <th className="px-5 py-3 font-medium text-right">Total</th>
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {purchaseRequest.items.map((item) => (<tr key={item.id}
                                                                      className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                <td className="px-5 py-4">
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {item.item_name}
                                    </p>
                                    <p className="text-[11px] text-gray-500">
                                        {item.item_desc || item.description}
                                    </p>
                                </td>
                                <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-300">
                                    {item.quantity} {item.unit}
                                </td>
                                <td className="px-5 py-4 text-right text-gray-600 dark:text-gray-300">
                                    {formatCurrency(item.estimated_unit_cost)}
                                </td>
                                <td className="px-5 py-4 text-right font-semibold text-gray-900 dark:text-white">
                                    {formatCurrency(item.quantity * item.estimated_unit_cost)}
                                </td>
                            </tr>))}
                            </tbody>
                        </table>
                        <div
                            className="p-5 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center border-t border-gray-100 dark:border-gray-700">
                            <span className="text-xs font-bold text-gray-500 uppercase">Grand Total</span>
                            <span className="text-lg font-bold text-indigo-600">
                                    {formatCurrency(grandTotal)}
                                </span>
                        </div>
                    </div>

                    {/* Action Buttons Depending on Status and Permissions */}
                    {auth.can.verify_pr && isActionable && (<div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={triggerDeclineConfirmation}
                            disabled={processing}
                            className="px-6 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all shadow-sm"
                        >
                            Decline
                        </button>
                        <button
                            type="button"
                            onClick={triggerVerifyConfirmation}
                            disabled={processing}
                            className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                        >
                            Accept
                        </button>
                    </div>)}

                    {auth.can.canvass && isVerified && (<div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={triggerProceedCanvasConfirmation}
                            disabled={processing}
                            className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-sm"
                        >
                            Proceed Canvassing
                        </button>
                    </div>)}

                    {auth.can.canvass && isCanvassing && (<div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={triggerCanvassConfirmation}
                            className="px-6 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                        >
                            Print Canvas Form
                        </button>
                    </div>)}

                    {auth.can.proceedPO && isCanvassing && (<div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={triggerPOProceedingConfirmation}
                            className="px-6 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                        >
                            Proceed to PO
                        </button>
                    </div>)}

                    {auth.can.proceedPO && isPOReady && !purchaseRequest.po_number && (
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={triggerPOGenerateNumberConfirmation}
                                className="px-6 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                            >
                                Generate PO number
                            </button>
                        </div>)}
                </div>
            </div>
        </div>


        {/* PO Number Result Modal */}
        {poResultModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-700 text-center">
                    <div
                        className="mx-auto mb-4 flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                        PO Number Generated
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        A new purchase order number was generated.
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg py-3 mb-6 space-y-2">
                        <p className="text-xl font-bold text-indigo-600 tracking-wide">
                            {poResultModal.poNumber}
                        </p>
                        {poResultModal.supplier && (<p className="text-sm text-gray-600 dark:text-gray-300">
                            Supplier: <span className="font-semibold">{poResultModal.supplier}</span>
                        </p>)}
                        {poResultModal.dateReceived && (<p className="text-sm text-gray-600 dark:text-gray-300">
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

        {/* Custom Confirmation and Mini-Form Modal */}
        {confirmModal.isOpen && (<div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity animate-fade-in">
            <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden transform scale-100 transition-transform p-6 border border-gray-100 dark:border-gray-700">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    {confirmModal.title}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {confirmModal.message}
                </p>

                {/* Conditional Inputs injected for 'canvass' workflow */}
                {confirmModal.actionType === 'canvass' && (
                    <div className="space-y-4 mb-6 border-t border-b border-gray-100 dark:border-gray-700 py-4">
                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                To be opened on:
                            </label>
                            <input
                                type="date"
                                required
                                value={data.opened_on}
                                onChange={e => setData('opened_on', e.target.value)}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                Delivery Period:
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g., 7 Calendar Days, 2 Weeks"
                                value={data.delivery_period}
                                onChange={e => setData('delivery_period', e.target.value)}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                BAC Date:
                            </label>
                            <input
                                type="date"
                                required
                                value={data.bac_date}
                                onChange={e => setData('bac_date', e.target.value)}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                        </div>
                    </div>)}

                {/* Conditional Inputs injected for 'generatePONumber' workflow */}
                {confirmModal.actionType === 'generatePONumber' && (
                    <div className="space-y-4 mb-6 border-t border-b border-gray-100 dark:border-gray-700 py-4">
                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
                                PO Number
                            </label>
                            <div className="flex gap-2 mb-3">
                                <button
                                    type="button"
                                    onClick={() => setData(prev => ({
                                        ...prev, po_number_mode: 'auto', po_number_input: ''
                                    }))}
                                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${data.po_number_mode === 'auto' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
                                >
                                    Auto-generate
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setData(prev => ({...prev, po_number_mode: 'manual'}))}
                                    className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${data.po_number_mode === 'manual' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
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
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />)}
                            {data.po_number_mode === 'auto' && (<p className="text-xs text-gray-400 italic">
                                A PO number will be generated automatically upon confirmation.
                            </p>)}
                        </div>

                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                Supplier:
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="Supplier name"
                                value={data.supplier}
                                onChange={e => setData('supplier', e.target.value)}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                Date Received from Supplier:
                            </label>
                            <input
                                type="date"
                                required
                                value={data.date_received}
                                onChange={e => setData('date_received', e.target.value)}
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                            />
                        </div>
                    </div>)}

                {/* Conditional Inputs injected for 'decline' workflow */}
                {confirmModal.actionType === 'decline' && (
                    <div className="space-y-2 mb-6 border-t border-b border-gray-100 dark:border-gray-700 py-4">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                            Reason for Decline:
                        </label>
                        <textarea
                            required
                            rows={3}
                            placeholder="Explain why this purchase request is being declined..."
                            value={data.reason_to_decline}
                            onChange={e => setData('reason_to_decline', e.target.value)}
                            className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500"
                        />
                    </div>)}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={closeModal}
                        disabled={processing}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleModalConfirm}
                        disabled={processing || (confirmModal.actionType === 'decline' && !data.reason_to_decline.trim()) || (confirmModal.actionType === 'canvass' && (!data.opened_on || !data.delivery_period || !data.bac_date)) || (confirmModal.actionType === 'generatePONumber' && (!data.supplier || !data.date_received || (data.po_number_mode === 'manual' && !data.po_number_input)))}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${confirmModal.actionType === 'decline' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : confirmModal.actionType === 'canvass' || confirmModal.actionType === 'generatePONumber' ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'}`}
                    >
                        {processing ? 'Processing...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>)}
    </AuthenticatedLayout>);
}

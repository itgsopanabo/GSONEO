import {Head, Link, router, usePage} from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {STATUS_MAP} from '@/Constants/statusConfig.js';
// import {PROCUREMENT_MODES} from '@/constants/ProcMode';

import {useEffect, useMemo, useState} from "react";
import {
    Search, History, Printer, Share2, ChevronRight, ShieldCheck, X, Check, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import ItemDescription from "@/Components/ItemDescripiton.jsx";

/**
 * COST FIELDS
 * -----------
 * `unit_cost` is the price of one unit. `total_estimated_cost` is the line
 * total (quantity × unit_cost) and is computed server-side in the controller —
 * the client never sends it. So any sum over items adds `total_estimated_cost`
 * directly and does NOT multiply by quantity again.
 *
 * Laravel's `decimal:2` cast serializes to a string, hence the Number()
 * wrappers in the reduces.
 */

/**
 * Department options for the Create PR dropdown.
 *
 * If the controller passes a `departments` prop (an array of strings), that
 * wins over this list — see `departmentOptions` below.
 */
const DEPARTMENTS = ['Administration', 'Accounting', 'Human Resources', 'Information Technology', 'Engineering', 'Operations', 'Procurement', 'Records',];

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function formatCurrency(value) {
    const num = Number(value);
    if (Number.isNaN(num)) return '—';
    return `₱${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

function sumItems(items) {
    return (items || []).reduce((sum, item) => sum + Number(item.total_estimated_cost || 0), 0);
}

export default function Index({purchaseRequests, departments}) {
    const requests = purchaseRequests?.data || [];
    const departmentOptions = departments?.length ? departments : DEPARTMENTS;
    const {flash, auth, csrf_token} = usePage().props;
    const userSection = auth?.user?.role?.section;

    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(requests[0]?.id ?? null);
    const [processing, setProcessing] = useState(false);

    const [declineModal, setDeclineModal] = useState({isOpen: false, reason: ''});
    const [approveModal, setApproveModal] = useState({isOpen: false});
    const [createModal, setCreateModal] = useState({
        isOpen: false, requester_name: '', requester_department: '', remarks_or_notes: '',
    });
    const [createErrors, setCreateErrors] = useState({});
    const [successModal, setSuccessModal] = useState({isOpen: false, prNumber: '', id: null});

    const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({
                only: ['purchaseRequests'], preserveScroll: true, preserveState: true
            });
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // Keep a valid selection as the polled list changes.
    useEffect(() => {
        if (requests.length === 0) {
            setSelectedId(null);
            return;
        }
        if (!requests.some(r => r.id === selectedId)) {
            setSelectedId(requests[0].id);
        }
    }, [requests, selectedId]);

    const filteredRequests = useMemo(() => {
        if (!search.trim()) return requests;
        const q = search.trim().toLowerCase();
        return requests.filter(pr => pr.pr_number?.toLowerCase().includes(q) || pr.requester_name?.toLowerCase().includes(q) || pr.requester_department?.toLowerCase().includes(q));
    }, [requests, search]);

    const pendingCount = useMemo(() => requests.filter(pr => pr.status === 0).length, [requests]);
    const selected = requests.find(r => r.id === selectedId) || null;

    function triggerApproveConfirmation() {
        if (!selected) return;
        setApproveModal({isOpen: true});
    }

    function closeApproveModal() {
        if (processing) return;
        setApproveModal({isOpen: false});
    }

    function handleApprove() {
        if (!selected) return;

        setProcessing(true);
        router.post(route('purchase-requests.verify', {purchase_request: selected.id}), {}, {
            preserveScroll: true,
            onSuccess: () => setApproveModal({isOpen: false}),
            onFinish: () => setProcessing(false),
        });
    }

    function triggerDeclineConfirmation() {
        if (!selected) return;
        setDeclineModal({isOpen: true, reason: ''});
    }

    function closeDeclineModal() {
        setDeclineModal({isOpen: false, reason: ''});
    }

    function submitDecline() {
        if (!selected || !declineModal.reason.trim()) return;
        setProcessing(true);
        router.post(route('purchase-requests.decline', {purchase_request: selected.id}), {
            reason_to_decline: declineModal.reason,
        }, {
            preserveScroll: true, onSuccess: () => {
                closeDeclineModal();
            }, onFinish: () => setProcessing(false),
        });
    }

    // --- Create PR ---------------------------------------------------------

    function openCreateModal() {
        const userDept = auth?.user?.role?.section ?? '';
        setCreateErrors({});
        setCreateModal({
            isOpen: true,
            requester_name: auth?.user?.name ?? '',
            requester_department: departmentOptions.includes(userDept) ? userDept : '',
            remarks_or_notes: '',
        });
    }

    function closeCreateModal() {
        if (processing) return;
        setCreateModal(prev => ({...prev, isOpen: false}));
    }

    function setCreateField(field, value) {
        setCreateModal(prev => ({...prev, [field]: value}));
    }

    const isCreateValid = Boolean(createModal.requester_name.trim() && createModal.requester_department.trim() && createModal.remarks_or_notes.trim());

    function submitCreate() {
        if (!isCreateValid) return;
        setProcessing(true);
        setCreateErrors({});
        router.post(route('purchase-requests.store'), {
            requester_name: createModal.requester_name.trim(),
            requester_department: createModal.requester_department.trim(),
            remarks_or_notes: createModal.remarks_or_notes.trim(),
        }, {
            preserveScroll: true,
            onSuccess: (page) => {
                setCreateModal(prev => ({...prev, isOpen: false}));
                const created = page.props.flash?.created_pr;
                if (created) {
                    setSuccessModal({isOpen: true, prNumber: created.pr_number, id: created.id});
                    setSelectedId(created.id);
                    setIsPanelCollapsed(false);
                }
            },
            onError: (errors) => setCreateErrors(errors),
            onFinish: () => setProcessing(false),
        });
    }

    return (<AuthenticatedLayout>
        <Head title="Procurement Section - Purchase Request Management"/>

        <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                        Purchase Requests
                    </h1>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Manage, monitor, and process procurement tracks.
                    </p>
                </div>

                {/*
                    Was: {userSection === 'Administration' && ( ... )}
                    Guard removed so the button always shows. Once you've confirmed
                    what auth.user.role.section actually returns, wrap this back up —
                    and back it with a policy on the store route, since hiding the
                    button isn't a permission.
                */}
                <div>
                    <button
                        type="button"
                        onClick={openCreateModal}
                        className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold tracking-wide text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 transition duration-150 ease-in-out shadow-sm"
                    >
                        Create Request
                    </button>
                </div>
            </div>

            {/* Master-detail layout */}
            <div
                className={`grid grid-cols-1 gap-6 h-[calc(100vh-220px)] min-h-[560px] transition-[grid-template-columns] duration-300 ease-in-out ${isPanelCollapsed ? 'lg:grid-cols-[1fr_56px]' : 'lg:grid-cols-[360px_1fr]'}`}
            >

                {/* Left: Verify Queue */}
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden">
                    <div
                        className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Verify Requests</h2>
                        <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                            {pendingCount} Pending
                        </span>
                    </div>

                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search PR ID, Vendor..."
                                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/40">
                        {filteredRequests.length > 0 ? filteredRequests.map((pr) => {
                            const isActive = pr.id === selectedId;
                            return (<button
                                key={pr.id}
                                onClick={() => {
                                    setSelectedId(pr.id);
                                    if (isPanelCollapsed) setIsPanelCollapsed(false);
                                }}
                                className={`w-full text-left px-4 py-3.5 transition-colors border-l-2 ${isActive ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-600' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-900/20'}`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                        <span
                                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                                            {pr.pr_number}
                                        </span>
                                    <span className="text-[10px] text-gray-400">
                                            {formatRelativeTime(pr.created_at)}
                                        </span>
                                </div>
                                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                                    {pr.requester_name || 'Untitled request'}
                                </p>
                                <div className="mt-1.5 flex items-center gap-2">
                                    {pr.items != null && (<span
                                        className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                                        {formatCurrency(sumItems(pr.items))}
                                    </span>)}
                                    <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_MAP[pr.status]?.style || 'bg-gray-50 border-gray-200'}`}>
                                            <span className="w-1 h-1 rounded-full bg-current"></span>
                                        {STATUS_MAP[pr.status]?.label || 'Unknown'}
                                        </span>
                                </div>
                                {pr.remarks_or_notes && (
                                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                                        {pr.remarks_or_notes}
                                    </p>)}
                            </button>);
                        }) : (<div className="px-6 py-16 text-center">
                            <p className="text-xs font-medium text-gray-900 dark:text-white">No requests found</p>
                            <p className="mt-1 text-[11px] text-gray-500">Try a different search.</p>
                        </div>)}
                    </div>

                    {purchaseRequests?.links && purchaseRequests.links.length > 3 && (<div
                        className="px-4 py-3 bg-gray-50 dark:bg-gray-900/20 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-center gap-1">
                        {purchaseRequests.links.map((link, index) => (<Link
                            key={index}
                            href={link.url || '#'}
                            dangerouslySetInnerHTML={{__html: link.label}}
                            className={`px-2.5 py-1 text-[11px] rounded-md border transition-all ${link.active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'} ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />))}
                    </div>)}
                </div>

                {/* Right: Detail panel */}
                {isPanelCollapsed ? (/* Collapsed strip */
                    <div
                        className="hidden lg:flex bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex-col items-center py-4">
                        <button
                            onClick={() => setIsPanelCollapsed(false)}
                            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                            title="Expand details panel"
                        >
                            <PanelRightOpen className="w-4 h-4"/>
                        </button>
                    </div>) : (<div
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm flex flex-col overflow-hidden">
                    {!selected ? (<div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">No request selected</p>
                            <p className="mt-1 text-xs text-gray-500">Choose a request from the queue to review
                                it.</p>
                        </div>
                    </div>) : (<>
                        {/* Header */}
                        <div
                            className="px-6 py-5 border-b border-gray-100 dark:border-gray-700/60 flex items-start justify-between">
                            <div>
                                <div
                                    className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">

                                    <span>Created by {selected.requester_name || 'N/A'}</span>
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {selected.pr_number || selected.requester_department || 'Purchase Request'}
                                </h2>
                            </div>
                            <div className="flex items-center gap-1">

                                <button
                                    onClick={() => setIsPanelCollapsed(true)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors hidden lg:inline-flex"
                                    title="Collapse panel">
                                    <PanelRightClose className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Request Summary */}
                                <div
                                    className="md:col-span-3 border border-gray-100 dark:border-gray-700/40 rounded-xl p-5">
                                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                                        Request Summary
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                Requester
                                            </p>
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                {selected.requester_name || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                Department
                                            </p>
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                {selected.requester_department || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                                Date Created
                                            </p>
                                            <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                {selected.created_at ? new Date(selected.created_at).toLocaleDateString(undefined, {
                                                    year: 'numeric', month: 'short', day: 'numeric'
                                                }) : '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            Purpose/Reason:
                                        </p>
                                        <p className={'text-xs font-medium text-gray-900 dark:text-white'}>{selected.remarks_or_notes}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items */}
                            <div
                                className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
                                <div
                                    className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Line Items
                                    </p>
                                    <span className="text-[11px] text-gray-400">
                                            {(selected.items?.length ?? 0)} Items Total
                                        </span>
                                </div>
                                <table className="w-full table-fixed text-left">
                                    <thead>
                                    <tr className="border-b border-gray-100 dark:border-gray-700/40">
                                        <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Item
                                            Description
                                        </th>
                                        <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Qty</th>
                                        <th className="px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Total</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                    {(selected.items || []).map((item, idx) => (<tr key={item.id ?? idx}>
                                        <td className="px-5 py-3 text-xs align-top">
                                            <div
                                                className="font-medium text-gray-900 dark:text-white break-words">{item.item_name}</div>
                                            <ItemDescription text={item.item_desc}/>
                                        </td>
                                        <td className="px-5 py-3 text-xs text-gray-700 dark:text-gray-300 text-right">
                                            {item.quantity} {item.unit || ''}
                                        </td>
                                        <td className="px-5 py-3 text-xs font-medium text-gray-900 dark:text-white text-right">
                                            {formatCurrency(item.total_estimated_cost)}
                                        </td>
                                    </tr>))}
                                    {(!selected.items || selected.items.length === 0) && (<tr>
                                        <td colSpan="3" className="px-5 py-6 text-center text-xs text-gray-400">
                                            No line items on this request.
                                        </td>
                                    </tr>)}
                                    </tbody>
                                    <tfoot>
                                    <tr className="border-t border-gray-100 dark:border-gray-700/40">
                                        <td colSpan="2"
                                            className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">
                                            Grand Total
                                        </td>
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 dark:text-white text-right">
                                            {formatCurrency(sumItems(selected.items))}
                                        </td>
                                    </tr>
                                    </tfoot>
                                </table>
                            </div>

                        </div>

                        {/* Actions Buttons */}
                        <div
                            className="px-6 py-4 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-end gap-4">
                            <div className="flex items-center gap-2 shrink-0">

                                <div className="flex items-center gap-2 shrink-0">
                                    {selected.status === 1 && (<>

                                        {/*From 0 -> 700 (Reject/Decline)*/}
                                        <button
                                            type="button"
                                            onClick={triggerDeclineConfirmation}
                                            disabled={processing}
                                            className="inline-flex items-center px-5 py-2.5 bg-red-800 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                                        >
                                            Decline PR
                                        </button>

                                        {/* From 0 ->  100 (Verified) */}
                                        <button
                                            type="button"
                                            onClick={triggerApproveConfirmation}
                                            disabled={processing}
                                            className="inline-flex items-center px-5 py-2.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full shadow-sm transition-colors"
                                        >
                                            Accept PR
                                        </button>
                                    </>)}
                                </div>
                            </div>
                        </div>

                    </>)}
                </div>)}

            </div>
        </div>

        {/* Create PR Modal */}
        {createModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        Create Purchase Request
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                        Fill in the requester details, the purpose of this request, and the items being requested.
                    </p>

                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label
                                    className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                    Requester Name
                                </label>
                                <input
                                    type="text"
                                    autoFocus
                                    value={createModal.requester_name}
                                    onChange={(e) => setCreateField('requester_name', e.target.value)}
                                    placeholder="Juan Dela Cruz"
                                    className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                                {createErrors.requester_name && (
                                    <p className="mt-1 text-xs text-red-600">{createErrors.requester_name}</p>)}
                            </div>

                            <div>
                                <label
                                    className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                    Requester Department
                                </label>
                                <select
                                    value={createModal.requester_department}
                                    onChange={(e) => setCreateField('requester_department', e.target.value)}
                                    className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="">Select a department</option>
                                    {departmentOptions.map((dept) => (
                                        <option key={dept} value={dept}>{dept}</option>))}
                                </select>
                                {createErrors.requester_department && (
                                    <p className="mt-1 text-xs text-red-600">{createErrors.requester_department}</p>)}
                            </div>
                        </div>

                        <div>
                            <label
                                className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                                Purpose / Reason
                            </label>
                            <textarea
                                rows={3}
                                value={createModal.remarks_or_notes}
                                onChange={(e) => setCreateField('remarks_or_notes', e.target.value)}
                                placeholder="Explain what this purchase request is for..."
                                className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                            {createErrors.remarks_or_notes && (
                                <p className="mt-1 text-xs text-red-600">{createErrors.remarks_or_notes}</p>)}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeCreateModal}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitCreate}
                            disabled={processing || !isCreateValid}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            {processing ? 'Creating...' : 'Create Request'}
                        </button>
                    </div>
                </div>
            </div>)}

        {/* Created PR Modal */}
        {successModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-700 text-center">
                    <div
                        className="mx-auto w-10 h-10 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center mb-3">
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400"/>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                        Request Created
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        This request has been assigned the number below.
                    </p>

                    <div className="flex items-center justify-center gap-2 mb-6">
                        <span
                            className="font-mono text-base font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">
                            {successModal.prNumber}
                        </span>
                        <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(successModal.prNumber)}
                            className="text-[11px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors"
                        >
                            Copy
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => setSuccessModal({isOpen: false, prNumber: '', id: null})}
                        className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>)}

        {/* Decline Reason Modal */}
        {declineModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        Decline Purchase Request
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Are you sure you want to decline {selected?.pr_number || 'this request'}? Please provide a
                        reason below.
                    </p>

                    <div className="space-y-2 mb-6">
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1">
                            Reason for Decline:
                        </label>
                        <textarea
                            required
                            rows={3}
                            autoFocus
                            placeholder="Explain why this purchase request is being declined..."
                            value={declineModal.reason}
                            onChange={(e) => setDeclineModal(prev => ({...prev, reason: e.target.value}))}
                            className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeDeclineModal}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={submitDecline}
                            disabled={processing || !declineModal.reason.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                        >
                            {processing ? 'Declining...' : 'Confirm Decline'}
                        </button>
                    </div>
                </div>
            </div>)}

        {/*Approve PR Modal*/}
        {approveModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        Accept Purchase Request
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Are you sure you want to accept {selected?.pr_number || 'this request'}?
                        This will mark the request as verified and move it forward for approval.
                    </p>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeApproveModal}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                            {processing ? 'Accepting...' : 'Confirm Accept'}
                        </button>
                    </div>
                </div>
            </div>)}

    </AuthenticatedLayout>);
}

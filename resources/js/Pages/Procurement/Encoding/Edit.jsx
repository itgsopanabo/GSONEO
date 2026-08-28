import {useState, useRef, useEffect} from 'react';
import {Head, useForm, Link, router} from '@inertiajs/react';
import axios from 'axios';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import PasteGrid from "@/Components/PasteGrid.jsx";

const blankItem = () => ({
    id: null,
    item_name: '',
    description: '',
    quantity: 1,
    unit: 'pcs',
    estimated_unit_price: 0,
});

const emptyOcr = {open: false, busy: false, error: null, text: ''};

// Column headers the scan picks up. They carry no item data, so parsing skips them.
const LABEL_LINES = [
    'qty', 'quantity', 'unit', 'units', 'particulars', 'description',
    'country of origin', 'country of', 'origin',
    'unit cost', 'cost', 'total', 'amount', 'remarks', 'item', 'no', 'no.',
];

const isLabelLine = (line) => LABEL_LINES.includes(line.trim().toLowerCase().replace(/:$/, ''));
const isBareNumber = (line) => /^\d+(\.\d+)?$/.test(line.trim());
const isMoney = (line) => /^[₱P]?\s?\d{1,3}(,\d{3})+(\.\d{2})?$|^[₱P]?\s?\d+\.\d{2}$/.test(line.trim());
const toNumber = (line) => parseFloat(String(line).replace(/[^\d.]/g, '')) || 0;
const isHeadingLine = (line) => /[A-Z]/.test(line) && line === line.toUpperCase() && !/^\d/.test(line.trim());

// Turn one block of scanned lines into a single item row.
const parseBlock = (block) => {
    const lines = block
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !isLabelLine(line));

    let quantity = null;
    let unit = null;
    let price = 0;
    const body = [];

    for (const line of lines) {
        if (quantity === null && isBareNumber(line)) {
            quantity = parseInt(line) || 1;
            continue;
        }
        if (unit === null && quantity !== null && /^[a-zA-Z.]{1,12}$/.test(line)) {
            unit = line;
            continue;
        }
        if (!price && isMoney(line)) {
            price = toNumber(line);
            continue;
        }
        body.push(line);
    }

    const nameLines = [];
    let cut = 0;
    while (cut < body.length && isHeadingLine(body[cut]) && nameLines.length < 4) {
        nameLines.push(body[cut]);
        cut++;
    }

    if (nameLines.length === 0 && body.length > 0) {
        nameLines.push(body[0]);
        cut = 1;
    }

    return {
        id: null,
        item_name: nameLines.join(' ').replace(/\s+/g, ' ').trim(),
        description: body.slice(cut).join('\n').trim(),
        quantity: quantity ?? 1,
        unit: unit ?? 'pcs',
        estimated_unit_price: price,
    };
};

const parseOcrText = (text) =>
    text
        .split(/^\s*-{3,}\s*$/m)
        .map(block => block.trim())
        .filter(Boolean)
        .map(parseBlock)
        .filter(item => item.item_name);

const rowsToText = (rows = []) =>
    rows.map(row => [
        'QTY',
        parseInt(row.quantity) || 1,
        'UNIT',
        (row.unit || 'pcs').trim(),
        'PARTICULARS',
        (row.item_name || '').trim().toUpperCase(),
        (row.description || '').trim(),
        row.estimated_unit_price > 0 ? 'UNIT COST' : null,
        row.estimated_unit_price > 0 ? Number(row.estimated_unit_price).toFixed(2) : null,
    ].filter(value => value !== null && value !== '').join('\n')).join('\n---\n');

// The record stores item_desc / estimated_unit_cost; the form works in
// description / estimated_unit_price. Map on the way in, map back on the server.
const toFormItem = (item) => ({
    id: item.id ?? null,
    item_name: item.item_name ?? '',
    description: item.item_desc ?? item.description ?? '',
    quantity: item.quantity ?? 1,
    unit: item.unit ?? 'pcs',
    estimated_unit_price: item.estimated_unit_cost ?? item.estimated_unit_price ?? 0,
});

export default function Edit({purchaseRequest, departments = [], isDraft = false}) {
    const {data, setData, put, transform, processing, errors} = useForm({
        // Set at creation and shown read-only below, but still sent on save so
        // the server keeps receiving the full record.
        requester_name: purchaseRequest?.requester_name ?? '',
        requester_department: purchaseRequest?.requester_department ?? '',
        remarks_or_notes: purchaseRequest?.remarks_or_notes ?? '',
        items: (purchaseRequest?.items || []).length
            ? purchaseRequest.items.map(toFormItem)
            : [blankItem()],
        // Rows removed here are deleted server-side on save.
        removed_item_ids: [],
    });

    const [ocr, setOcr] = useState(emptyOcr);
    const [engineMenu, setEngineMenu] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const fileRef = useRef(null);

    // The record stores the department code, so look up the readable name for display.
    const selectedDepartment = departments.find(
        dept => String(dept.Department_Code) === String(data.requester_department)
    );
    const departmentLabel = selectedDepartment
        ? `${selectedDepartment.Department_Code} - ${selectedDepartment.Department_Name}`
        : (data.requester_department || '—');

    // Derive the pending label from Inertia's own flag rather than a callback,
    // so a failed request can't leave a button stuck on "Saving...".
    useEffect(() => {
        if (!processing) setPendingAction(null);
    }, [processing]);

    const addItemRow = () => {
        setData('items', [...data.items, blankItem()]);
    };

    const removeItemRow = (index) => {
        if (data.items.length <= 1) return;
        const target = data.items[index];
        const remaining = data.items.filter((_, i) => i !== index);
        setData(prev => ({
            ...prev,
            items: remaining,
            removed_item_ids: target.id
                ? [...prev.removed_item_ids, target.id]
                : prev.removed_item_ids,
        }));
    };

    // Replaces the row rather than writing into it, so previous state is never
    // edited in place.
    const handleItemChange = (index, field, value) => {
        setData('items', data.items.map((item, i) =>
            i === index ? {...item, [field]: value} : item
        ));
    };

    const handleOcrFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        setOcr({open: true, busy: true, error: null, text: ''});

        const payload = new FormData();
        payload.append('document', file);

        try {
            const {data: res} = await axios.post(route('purchase-requests.ocr'), payload);
            setOcr({
                open: true,
                busy: false,
                error: null,
                text: res.text ?? res.raw_text ?? rowsToText(res.rows ?? []),
            });
        } catch (err) {
            setOcr({
                open: true,
                busy: false,
                text: '',
                error: err.response?.data?.message
                    ?? 'That file could not be read. Use a JPG, PNG, or PDF under 1 MB.',
            });
        }
    };

    const scanHere = () => {
        setEngineMenu(false);
        fileRef.current?.click();
    };

    const openOcrSpace = () => {
        setEngineMenu(false);
        window.open('https://ocr.space/', '_blank', 'noopener,noreferrer');
        setOcr({open: true, busy: false, error: null, text: ''});
    };

    // Opens the grid on its own, for pasting straight out of Excel.
    const openPasteGrid = () => {
        setEngineMenu(false);
        setOcr({open: true, busy: false, error: null, text: ''});
    };

    const closeOcr = () => setOcr(emptyOcr);

    const parsedOcrRows = parseOcrText(ocr.text);

    // Rows arrive from the grid without an id, marking them as new to the server.
    const appendItems = (rows) => {
        if (!rows.length) return;
        const incoming = rows.map(row => ({...row, id: null}));
        const startedEmpty = data.items.length === 1 && !data.items[0].item_name;
        setData('items', startedEmpty ? incoming : [...data.items, ...incoming]);
    };

    const grandTotal = data.items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.estimated_unit_price) || 0;
        return sum + (qty * price);
    }, 0);

    const submitAs = (status) => {
        setPendingAction(status);
        transform(payload => ({...payload, status}));

        put(route('encode.update', purchaseRequest.id), {
            preserveScroll: true,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        submitAs('submitted');
    };

    // Drafts save half-finished work, so this deliberately bypasses the browser's
    // required-field check by not being a submit button.
    const saveDraft = () => submitAs('draft');

    const destroy = () => {
        setDeleting(true);
        router.delete(route('encode.destroy', purchaseRequest.id), {
            onFinish: () => setDeleting(false),
        });
    };

    const busy = processing || deleting;

    return (
        <AuthenticatedLayout>
            <Head title={`Edit ${purchaseRequest?.pr_number ?? 'Request'}`}/>

            <div className="py-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                                Edit {purchaseRequest?.pr_number ?? 'Purchase Request'}
                            </h1>
                            {isDraft && (
                                <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-900/50">
                                    Draft
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Correct the line items before submitting. Requester details were set when the request was
                            created.
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Request details, set at creation and shown here read-only */}
                    <div
                        className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Requester Name
                            </label>
                            <p className="w-full text-xs py-2 text-gray-500 dark:text-gray-400">
                                {data.requester_name || '—'}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Requester Department
                            </label>
                            <p className="w-full text-xs py-2 text-gray-500 dark:text-gray-400">
                                {departmentLabel}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Date Created
                            </label>
                            <p className="w-full text-xs py-2 text-gray-500 dark:text-gray-400">
                                {purchaseRequest?.created_at
                                    ? new Date(purchaseRequest.created_at).toLocaleDateString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                    })
                                    : '—'}
                            </p>
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Remarks or Notes
                            </label>
                            <p className="w-full text-xs py-2 text-gray-500 dark:text-gray-400 whitespace-pre-line">
                                {data.remarks_or_notes || '—'}
                            </p>
                        </div>
                    </div>

                    {/* Dynamic Items Section */}
                    <div
                        className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4">
                        <div
                            className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Requested Line
                                Items</h2>

                            <div className="flex items-center gap-4">
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/jpeg,image/png,application/pdf"
                                    className="hidden"
                                    onChange={handleOcrFile}
                                />

                                {/* Bulk entry: scan a document, read it elsewhere, or paste a range */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setEngineMenu(open => !open)}
                                        disabled={ocr.busy}
                                        aria-haspopup="menu"
                                        aria-expanded={engineMenu}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-colors"
                                    >
                                        {ocr.busy ? 'Reading...' : 'Add items in bulk'}
                                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                            <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5"
                                                  strokeLinecap="round"/>
                                        </svg>
                                    </button>

                                    {engineMenu && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setEngineMenu(false)}/>
                                            <div
                                                role="menu"
                                                className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
                                            >
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={openPasteGrid}
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                                >
                                                    <span
                                                        className="block text-xs font-medium text-gray-900 dark:text-white">
                                                        Paste from a spreadsheet
                                                    </span>
                                                    <span
                                                        className="block text-[11px] text-gray-500 dark:text-gray-400">
                                                        Copy a range in Excel, paste it into the grid.
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={scanHere}
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                                >
                                                    <span
                                                        className="block text-xs font-medium text-gray-900 dark:text-white">
                                                        Upload an image
                                                    </span>
                                                    <span
                                                        className="block text-[11px] text-gray-500 dark:text-gray-400">
                                                        Upload the scanned PR to extract data.
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    onClick={openOcrSpace}
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                                >
                                                    <span
                                                        className="flex items-center gap-1 text-xs font-medium text-gray-900 dark:text-white">
                                                        Open OCR.space
                                                        <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"
                                                             aria-hidden="true">
                                                            <path d="M4.5 2.5H9.5V7.5M9.5 2.5L3 9" stroke="currentColor"
                                                                  strokeWidth="1.5" strokeLinecap="round"/>
                                                        </svg>
                                                    </span>
                                                    <span
                                                        className="block text-[11px] text-gray-500 dark:text-gray-400">
                                                        Read it on their site, then paste it into the grid.
                                                    </span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={addItemRow}
                                    className="inline-flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                                >
                                    + Add Item
                                </button>
                            </div>
                        </div>

                        {/* Staging grid, held for review before it enters the form */}
                        {ocr.open && (
                            <div
                                className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-3">
                                {ocr.busy && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        Reading the document. Long forms can take up to a minute.
                                    </p>
                                )}

                                {ocr.error && (
                                    <div className="flex items-start justify-between gap-4">
                                        <p className="text-xs text-red-600 dark:text-red-400">{ocr.error}</p>
                                        <button
                                            type="button"
                                            onClick={closeOcr}
                                            className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                )}

                                {/* Keyed on the scan text so fresh OCR output reseeds the grid */}
                                {!ocr.busy && !ocr.error && (
                                    <PasteGrid
                                        key={ocr.text}
                                        initialRows={parsedOcrRows}
                                        onAdd={rows => {
                                            appendItems(rows);
                                            closeOcr();
                                        }}
                                        onCancel={closeOcr}
                                    />
                                )}
                            </div>
                        )}

                        {data.items.map((item, index) => (
                            <div key={item.id ?? `new-${index}`}
                                 className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/40 relative">
                                {/* Row 1: name, qty, unit, price, remove */}
                                <div className="md:col-span-7">
                                    <label
                                        className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Item
                                        Name</label>
                                    <input
                                        type="text"
                                        value={item.item_name}
                                        onChange={e => handleItemChange(index, 'item_name', e.target.value)}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    />
                                    {errors[`items.${index}.item_name`] &&
                                        <p className="mt-0.5 text-[11px] text-red-500">Required</p>}
                                </div>

                                <div className="md:col-span-1">
                                    <label
                                        className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={e => handleItemChange(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    />
                                </div>

                                <div className="md:col-span-1">
                                    <label
                                        className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Unit</label>
                                    <input
                                        type="text"
                                        value={item.unit}
                                        onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        placeholder="pcs"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label
                                        className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Est.
                                        Unit Price</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={item.estimated_unit_price}
                                        onChange={e => handleItemChange(index, 'estimated_unit_price', parseFloat(e.target.value) || 0)}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    />
                                </div>

                                <div className="md:col-span-1 flex items-center justify-end h-9">
                                    {data.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItemRow(index)}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>

                                {/* Row 2: full-width description */}
                                <div className="md:col-span-12">
                                    <label
                                        className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Description/Specs</label>
                                    <textarea
                                        value={item.description}
                                        onChange={e => handleItemChange(index, 'description', e.target.value)}
                                        rows={2}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white resize-y"
                                        placeholder="Brand, model, specifications, or other notes..."
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Grand Total Bar */}
                        <div
                            className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <span
                                className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estimated Grand Total:</span>
                            <span className="text-base font-bold text-gray-900 dark:text-white">
                                ₱{grandTotal.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            })}
                            </span>
                        </div>
                    </div>

                    {/* Bottom Action Submits */}
                    <div className="space-y-2">
                        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(true)}
                                disabled={busy}
                                className="sm:mr-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                    <path d="M2.5 3.5h9M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8M6 6v3.5M8 6v3.5"
                                          stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                                          strokeLinejoin="round"/>
                                </svg>
                                Delete request
                            </button>

                            <Link
                                href={route('encode.index')}
                                className="px-4 py-2 text-xs font-medium text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                Cancel
                            </Link>

                            <button
                                type="button"
                                onClick={saveDraft}
                                disabled={busy}
                                className="px-4 py-2 text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-all"
                            >
                                {pendingAction === 'draft' ? 'Saving...' : 'Save as draft'}
                            </button>

                            <button
                                type="submit"
                                disabled={busy}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold tracking-wide text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {pendingAction === 'submitted' ? 'Submitting...' : 'Submit for approval'}
                                {pendingAction !== 'submitted' && (
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                        <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" stroke="currentColor"
                                              strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )}
                            </button>
                        </div>

                        <p className="text-right text-[11px] text-gray-500 dark:text-gray-400">
                            A draft keeps your changes here. Submitting sends the request onward and closes
                            editing.
                        </p>
                    </div>
                </form>

                {/* Deletion is permanent, so it asks once before going through */}
                {confirmDelete && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/50" onClick={() => setConfirmDelete(false)}/>
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="delete-title"
                            className="relative w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-5 space-y-3"
                        >
                            <h3 id="delete-title" className="text-sm font-semibold text-gray-900 dark:text-white">
                                Delete {purchaseRequest?.pr_number ?? 'this request'}?
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                This removes the request and all {data.items.length} line
                                item{data.items.length === 1 ? '' : 's'}. It can't be undone.
                            </p>
                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setConfirmDelete(false)}
                                    disabled={deleting}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
                                >
                                    Keep it
                                </button>
                                <button
                                    type="button"
                                    onClick={destroy}
                                    disabled={deleting}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-500 disabled:opacity-50"
                                >
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

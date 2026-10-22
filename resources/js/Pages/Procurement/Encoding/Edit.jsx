import {useState, useRef, useEffect, useMemo, useCallback} from 'react';
import {Head, useForm, Link, router} from '@inertiajs/react';
import axios from 'axios';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import {formatDate} from "@/Utils/formatDate.js";
import PasteGrid from "@/Components/PasteGrid.jsx";

// Stable React keys for rows that have no id yet. Index keys made a row lose
// focus and its cursor position whenever a row above it was removed.
let rowSeq = 0;
const nextKey = () => `row-${++rowSeq}`;

const blankItem = () => ({
    _key: nextKey(),
    id: null,
    description: '',
    quantity: '1',
    unit: 'pcs',
    estimated_unit_price: '',
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

const peso = (value) => `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;

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
        .map(parseBlock);

const rowsToText = (rows = []) =>
    rows.map(row => [
        'QTY',
        parseInt(row.quantity) || 1,
        'UNIT',
        (row.unit || 'pcs').trim(),
        'PARTICULARS',

        (row.description || '').trim(),
        row.estimated_unit_price > 0 ? 'UNIT COST' : null,
        row.estimated_unit_price > 0 ? Number(row.estimated_unit_price).toFixed(2) : null,
    ].filter(value => value !== null && value !== '').join('\n')).join('\n---\n');

// The record stores item_desc / estimated_unit_cost; the form works in
// description / estimated_unit_price. Numbers are held as strings so a field
// can be cleared or half-typed ("1." on the way to "1.50") without the input
// fighting the person entering it. transform() converts them back on save.
const toFormItem = (item) => {
    const price = item.estimated_unit_cost ?? item.estimated_unit_price;

    return {
        _key: nextKey(),
        id: item.id ?? null,
        description: item.item_desc ?? item.description ?? '',
        quantity: String(item.quantity ?? 1),
        unit: item.unit ?? 'pcs',
        estimated_unit_price: price === null || price === undefined || price === ''
            ? ''
            : String(price),
    };
};

// Shared column template: number, description, qty, unit, unit price, line total, remove.
const ROW_GRID = 'grid grid-cols-1 md:grid-cols-[1.75rem_minmax(0,1fr)_4.5rem_5rem_7rem_7rem_2rem] md:items-start gap-x-3 gap-y-2';

const FIELD_LABELS = {
    description: 'description',
    quantity: 'quantity',
    unit: 'unit',
    estimated_unit_price: 'unit price',
};

export default function Edit({purchaseRequest, departments = [], isDraft = false}) {
    const {data, setData, put, transform, processing, errors, clearErrors, isDirty, recentlySuccessful} = useForm({
        // Set at creation and shown read-only below, but still sent on save so
        // the server keeps receiving the full record.
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
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const fileRef = useRef(null);
    const menuButtonRef = useRef(null);
    const cancelDeleteRef = useRef(null);
    const errorSummaryRef = useRef(null);

    // Requests store the office name; older ones encoded here may hold the code.
    const selectedDepartment = departments.find(
        dept => dept.Department_Name === data.requester_department || String(dept.Department_Code) === String(data.requester_department)
    );
    const departmentLabel = selectedDepartment
        ? `${selectedDepartment.Department_Name} (${selectedDepartment.Department_Code})`
        : (data.requester_department || '—');

    // Derive the pending label from Inertia's own flag rather than a callback,
    // so a failed request can't leave a button stuck on "Saving...".
    useEffect(() => {
        if (!processing) setPendingAction(null);
    }, [processing]);

    // Server-side validation used to fail silently: the page just sat there.
    // Now a rejected save moves focus to a summary of what needs fixing.
    const errorEntries = Object.entries(errors);
    useEffect(() => {
        if (errorEntries.length) errorSummaryRef.current?.focus();
    }, [errorEntries.length]);

    // A half-edited request is easy to lose to a stray tab close.
    useEffect(() => {
        if (!isDirty) return;
        const warn = (event) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [isDirty]);

    // Escape closes whatever is on top, in the order a person expects.
    useEffect(() => {
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            if (confirmDelete) return setConfirmDelete(false);
            if (confirmLeave) return setConfirmLeave(false);
            if (engineMenu) {
                setEngineMenu(false);
                menuButtonRef.current?.focus();
                return;
            }
            if (ocr.open && !ocr.busy) closeOcr();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [confirmDelete, confirmLeave, engineMenu, ocr.open, ocr.busy]);

    useEffect(() => {
        if (confirmDelete) cancelDeleteRef.current?.focus();
    }, [confirmDelete]);

    const addItemRow = () => {
        setData('items', [...data.items, blankItem()]);
    };

    const removeItemRow = (index) => {
        const target = data.items[index];
        setData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index),
            removed_item_ids: target.id
                ? [...prev.removed_item_ids, target.id]
                : prev.removed_item_ids,
        }));
    };

    // Repeat orders are common, so copying a row beats retyping it.
    const duplicateItemRow = (index) => {
        setData('items', data.items.flatMap((item, i) =>
            i === index ? [item, {...item, _key: nextKey(), id: null}] : [item]
        ));
    };

    // Replaces the row rather than writing into it, so previous state is never
    // edited in place.
    const handleItemChange = (index, field, value) => {
        if (errors[`items.${index}.${field}`]) clearErrors(`items.${index}.${field}`);
        setData('items', data.items.map((item, i) =>
            i === index ? {...item, [field]: value} : item
        ));
    };

    // Accept anything that could still become a number, including "" and "12.".
    const handleNumericChange = (index, field, raw) => {
        if (raw === '' || /^\d*\.?\d*$/.test(raw)) handleItemChange(index, field, raw);
    };

    const normalizeQuantity = (index, raw) => {
        const parsed = parseInt(raw, 10);
        handleItemChange(index, 'quantity', String(Number.isFinite(parsed) && parsed > 0 ? parsed : 1));
    };

    const normalizePrice = (index, raw) => {
        if (raw.trim() === '') return;
        const parsed = parseFloat(raw);
        handleItemChange(index, 'estimated_unit_price', Number.isFinite(parsed) ? parsed.toFixed(2) : '');
    };

    const lineTotal = (item) =>
        (parseFloat(item.quantity) || 0) * (parseFloat(item.estimated_unit_price) || 0);

    const grandTotal = data.items.reduce((sum, item) => sum + lineTotal(item), 0);

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

    const closeOcr = useCallback(() => setOcr(emptyOcr), []);

    const parsedOcrRows = useMemo(() => parseOcrText(ocr.text), [ocr.text]);

    // Rows arrive from the grid without an id, marking them as new to the server.
    // A single untouched starter row is replaced; anything typed is kept.
    const appendItems = (rows) => {
        if (!rows.length) return;
        const incoming = rows.map(row => ({
            _key: nextKey(),
            id: null,
            description: row.description ?? '',
            quantity: String(row.quantity ?? 1),
            unit: row.unit || 'pcs',
            estimated_unit_price: row.estimated_unit_price ? String(row.estimated_unit_price) : '',
        }));
        const startedEmpty = data.items.length === 1
            && !data.items[0].id
            && !data.items[0].description.trim()
            && !data.items[0].estimated_unit_price;
        setData('items', startedEmpty ? incoming : [...data.items, ...incoming]);
    };

    const submitAs = (status) => {
        setPendingAction(status);
        transform(payload => ({
            ...payload,
            status,
            // _key is a client-side concern; numbers go back to the server as numbers.
            items: payload.items.map(({_key, ...item}) => ({
                ...item,
                quantity: parseInt(item.quantity, 10) || 1,
                estimated_unit_price: parseFloat(item.estimated_unit_price) || 0,
            })),
        }));

        put(route('encode.update', purchaseRequest.id), {
            preserveScroll: true,
        });
    };

    const emptyDescriptions = data.items.filter(item => !item.description.trim()).length;

    const handleSubmit = (e) => {
        e.preventDefault();
        submitAs('submitted');
    };

    // Drafts save half-finished work, so this deliberately skips the checks that
    // guard a real submission.
    const saveDraft = () => submitAs('draft');

    // Enter inside a one-line field shouldn't fire off the whole request.
    const guardEnter = (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
    };

    const leaveHref = route('encode.index');
    const handleCancel = (e) => {
        if (!isDirty) return;
        e.preventDefault();
        setConfirmLeave(true);
    };

    const destroy = () => {
        setDeleting(true);
        router.delete(route('encode.destroy', purchaseRequest.id), {
            onFinish: () => setDeleting(false),
        });
    };

    const busy = processing || deleting;
    const canSubmit = data.items.length > 0 && emptyDescriptions === 0 && !busy;

    const inputClass = (invalid) =>
        `w-full text-xs rounded-md dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
            invalid
                ? 'border-red-400 dark:border-red-500/70'
                : 'border-gray-200 dark:border-gray-700'
        }`;

    const describeError = ([key, message]) => {
        const match = key.match(/^items\.(\d+)\.(\w+)$/);
        if (!match) return message;
        return `Line ${Number(match[1]) + 1} ${FIELD_LABELS[match[2]] ?? match[2]}: ${message}`;
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Edit ${purchaseRequest?.pr_number ?? 'Request'}`}/>

            <div className="py-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
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
                            {isDirty && !processing && (
                                <span className="text-[11px] text-gray-400 dark:text-gray-500">Unsaved changes</span>
                            )}
                            {recentlySuccessful && (
                                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Saved</span>
                            )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Correct the line items before submitting. Request details were set when the request was
                            created.
                        </p>
                    </div>

                    {/* Destructive and rare, so it sits away from the save path */}
                    <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 rounded-lg hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                            <path d="M2.5 3.5h9M5.5 3.5V2.5h3v1M3.5 3.5l.5 8h6l.5-8M6 6v3.5M8 6v3.5"
                                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                                  strokeLinejoin="round"/>
                        </svg>
                        Delete request
                    </button>
                </div>

                <form onSubmit={handleSubmit} onKeyDown={guardEnter} className="space-y-6">
                    {errorEntries.length > 0 && (
                        <div
                            ref={errorSummaryRef}
                            tabIndex={-1}
                            role="alert"
                            className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10 p-4"
                        >
                            <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                                This request wasn't saved. Fix {errorEntries.length === 1 ? 'this' : `these ${errorEntries.length}`} first:
                            </p>
                            <ul className="mt-1.5 space-y-0.5 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                                {errorEntries.map(entry => (
                                    <li key={entry[0]}>{describeError(entry)}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Request details, set at creation and shown here read-only */}
                    <div
                        className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">

                        <div>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Department</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{departmentLabel}</p>
                        </div>

                        <div>
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date created</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(purchaseRequest?.created_at)}
                            </p>
                        </div>

                        {data.remarks_or_notes && (
                            <div className="md:col-span-3">
                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-line">
                                    {data.remarks_or_notes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Dynamic Items Section */}
                    <div
                        className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4">
                        <div
                            className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 pb-3">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                Line items
                                <span className="ml-2 font-normal text-xs text-gray-500 dark:text-gray-400">
                                    {data.items.length} {data.items.length === 1 ? 'item' : 'items'}
                                </span>
                            </h2>

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
                                        ref={menuButtonRef}
                                        type="button"
                                        onClick={() => setEngineMenu(open => !open)}
                                        disabled={ocr.busy}
                                        aria-haspopup="menu"
                                        aria-expanded={engineMenu}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 transition-colors"
                                    >
                                        {ocr.busy ? 'Reading…' : 'Add items in bulk'}
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
                                    + Add item
                                </button>
                            </div>
                        </div>

                        {/* Staging grid, held for review before it enters the form */}
                        {ocr.open && (
                            <div
                                className="rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-900/10 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                        Review before adding
                                    </p>
                                    <button
                                        type="button"
                                        onClick={closeOcr}
                                        className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    >
                                        Close
                                    </button>
                                </div>

                                {ocr.busy && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                        Reading the document. Long forms can take up to a minute.
                                    </p>
                                )}

                                {ocr.error && (
                                    <p className="text-xs text-red-600 dark:text-red-400">{ocr.error}</p>
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

                        {/* One header instead of a label on every field */}
                        {data.items.length > 0 && (
                            <div
                                className={`${ROW_GRID} hidden md:grid px-3 text-[11px] font-medium text-gray-500 dark:text-gray-400`}>
                                <span aria-hidden="true"/>
                                <span>Description and specs</span>
                                <span>Qty</span>
                                <span>Unit</span>
                                <span className="text-right">Unit price</span>
                                <span className="text-right">Line total</span>
                                <span aria-hidden="true"/>
                            </div>
                        )}

                        {data.items.length === 0 ? (
                            <div
                                className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    No items on this request yet.
                                </p>
                                <button
                                    type="button"
                                    onClick={addItemRow}
                                    className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                                >
                                    Add the first item
                                </button>
                            </div>
                        ) : data.items.map((item, index) => {
                            const descriptionError = errors[`items.${index}.description`];
                            const quantityError = errors[`items.${index}.quantity`];
                            const unitError = errors[`items.${index}.unit`];
                            const priceError = errors[`items.${index}.estimated_unit_price`];

                            return (
                                <div
                                    key={item._key ?? item.id}
                                    className={`${ROW_GRID} bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/40`}
                                >
                                    <span
                                        className="hidden md:block pt-2 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                                        {index + 1}
                                    </span>

                                    <div>
                                        <label
                                            htmlFor={`item-${index}-description`}
                                            className="md:hidden block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5"
                                        >
                                            Description and specs
                                        </label>
                                        <textarea
                                            id={`item-${index}-description`}
                                            value={item.description}
                                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                                            rows={2}
                                            aria-invalid={Boolean(descriptionError)}
                                            className={`${inputClass(descriptionError)} resize-y`}
                                            placeholder="Brand, model, specifications, or other notes…"
                                        />
                                        {descriptionError && (
                                            <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{descriptionError}</p>
                                        )}
                                    </div>

                                    <div>
                                        <label
                                            htmlFor={`item-${index}-quantity`}
                                            className="md:hidden block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5"
                                        >
                                            Qty
                                        </label>
                                        <input
                                            id={`item-${index}-quantity`}
                                            type="text"
                                            inputMode="numeric"
                                            value={item.quantity}
                                            onChange={e => handleNumericChange(index, 'quantity', e.target.value)}
                                            onBlur={e => normalizeQuantity(index, e.target.value)}
                                            aria-invalid={Boolean(quantityError)}
                                            className={`${inputClass(quantityError)} tabular-nums`}
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor={`item-${index}-unit`}
                                            className="md:hidden block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5"
                                        >
                                            Unit
                                        </label>
                                        <input
                                            id={`item-${index}-unit`}
                                            type="text"
                                            value={item.unit}
                                            onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                            aria-invalid={Boolean(unitError)}
                                            className={inputClass(unitError)}
                                            placeholder="pcs"
                                        />
                                    </div>

                                    <div>
                                        <label
                                            htmlFor={`item-${index}-price`}
                                            className="md:hidden block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5"
                                        >
                                            Unit price
                                        </label>
                                        <div className="relative">
                                            <span
                                                className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-xs text-gray-400">₱</span>
                                            <input
                                                id={`item-${index}-price`}
                                                type="text"
                                                inputMode="decimal"
                                                value={item.estimated_unit_price}
                                                onChange={e => handleNumericChange(index, 'estimated_unit_price', e.target.value)}
                                                onBlur={e => normalizePrice(index, e.target.value)}
                                                aria-invalid={Boolean(priceError)}
                                                className={`${inputClass(priceError)} pl-5 text-right tabular-nums`}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex md:block items-baseline justify-between md:pt-2">
                                        <span
                                            className="md:hidden text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                            Line total
                                        </span>
                                        <span
                                            className="block text-xs text-right tabular-nums text-gray-700 dark:text-gray-300">
                                            {peso(lineTotal(item))}
                                        </span>
                                    </div>

                                    <div className="flex md:justify-end gap-1 md:pt-1">
                                        <button
                                            type="button"
                                            onClick={() => duplicateItemRow(index)}
                                            title="Duplicate this line"
                                            aria-label={`Duplicate line ${index + 1}`}
                                            className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"
                                                 aria-hidden="true">
                                                <rect x="4.5" y="4.5" width="7" height="7" rx="1.2"
                                                      stroke="currentColor" strokeWidth="1.2"/>
                                                <path d="M9.5 2.5h-7v7" stroke="currentColor" strokeWidth="1.2"
                                                      strokeLinecap="round"/>
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeItemRow(index)}
                                            title="Remove this line"
                                            aria-label={`Remove line ${index + 1}`}
                                            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"
                                                 aria-hidden="true">
                                                <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor"
                                                      strokeWidth="1.3" strokeLinecap="round"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Follows the page so the total and the save actions are always reachable */}
                    <div
                        className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
                            <div className="sm:mr-auto">
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">Estimated total</p>
                                <p className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
                                    {peso(grandTotal)}
                                </p>
                            </div>

                            <Link
                                href={leaveHref}
                                onClick={handleCancel}
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
                                {pendingAction === 'draft' ? 'Saving…' : 'Save draft'}
                            </button>

                            <button
                                type="submit"
                                disabled={!canSubmit}
                                title={emptyDescriptions > 0 ? 'Every line needs a description' : undefined}
                                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold tracking-wide text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                            >
                                {pendingAction === 'submitted' ? 'Submitting…' : 'Submit for approval'}
                            </button>
                        </div>

                        <p className="mt-1 text-right text-[11px] text-gray-500 dark:text-gray-400">
                            {emptyDescriptions > 0
                                ? `${emptyDescriptions} ${emptyDescriptions === 1 ? 'line needs' : 'lines need'} a description before you can submit.`
                                : 'A draft keeps your changes here. Submitting sends the request onward and closes editing.'}
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
                                    ref={cancelDeleteRef}
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
                                    {deleting ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Leaving with edits still in the form loses them */}
                {confirmLeave && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/50" onClick={() => setConfirmLeave(false)}/>
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="leave-title"
                            className="relative w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl p-5 space-y-3"
                        >
                            <h3 id="leave-title" className="text-sm font-semibold text-gray-900 dark:text-white">
                                Leave without saving?
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                Your changes to this request will be discarded.
                            </p>
                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setConfirmLeave(false)}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                >
                                    Keep editing
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setConfirmLeave(false);
                                        router.visit(leaveHref);
                                    }}
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 dark:bg-gray-700 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600"
                                >
                                    Discard changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

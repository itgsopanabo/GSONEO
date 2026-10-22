import {useState, useRef, useMemo} from 'react';
import {Head, useForm, Link} from '@inertiajs/react';
import axios from 'axios';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";
import PasteGrid from "@/Components/PasteGrid.jsx";

// Stable React keys for rows. Index keys made a row lose focus and its cursor
// position whenever a row above it was removed.
let rowSeq = 0;
const nextKey = () => `row-${++rowSeq}`;

const blankItem = () => ({
    _key: nextKey(),
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

// A bare count: "1", "12", "144"
const isBareNumber = (line) => /^\d+(\.\d+)?$/.test(line.trim());

// A price: has a comma group or two decimals — "111,392.00", "180.00"
const isMoney = (line) => /^[₱P]?\s?\d{1,3}(,\d{3})+(\.\d{2})?$|^[₱P]?\s?\d+\.\d{2}$/.test(line.trim());

const toNumber = (line) => parseFloat(String(line).replace(/[^\d.]/g, '')) || 0;

const peso = (value) => `₱${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})}`;

// Turn one block of scanned lines into a single item row. The heading and the
// specs under it are one field now, so the block stays in the order it was read.
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

    return {
        description: body.join('\n').trim(),
        quantity: quantity ?? 1,
        unit: unit ?? 'pcs',
        estimated_unit_price: price,
    };
};

// Blocks are split on a line of dashes. No dashes means the whole scan is one item.
const parseOcrText = (text) =>
    text
        .split(/^\s*-{3,}\s*$/m)
        .map(block => block.trim())
        .filter(Boolean)
        .map(parseBlock)
        .filter(item => item.description);

// Fallback when the OCR endpoint returns structured rows instead of raw text.
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

// Notice 'departments' is now passed in as a prop from Laravel
export default function Create({departments = []}) {
    const {data, setData, post, transform, processing, errors} = useForm({
        requester_department: '',
        // needed_by_date: '',
        remarks_or_notes: '',
        items: [blankItem()]
    });

    const [ocr, setOcr] = useState(emptyOcr);
    const [engineMenu, setEngineMenu] = useState(false);
    // Which button is in flight, so only that one shows its pending label.
    const [pendingAction, setPendingAction] = useState(null);
    const fileRef = useRef(null);

    const addItemRow = () => {
        setData('items', [...data.items, blankItem()]);
    };

    const removeItemRow = (index) => {
        if (data.items.length > 1) {
            setData('items', data.items.filter((_, i) => i !== index));
        }
    };

    // Replaces the row rather than writing into it, so previous state is never
    // edited in place.
    const handleItemChange = (index, field, value) => {
        setData('items', data.items.map((item, i) =>
            i === index ? {...item, [field]: value} : item
        ));
    };

    // Send the scanned document to Laravel, which calls the OCR service server-side
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

    // Read it on their site instead, then paste the text back into the panel.
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

    const parsedOcrRows = useMemo(() => parseOcrText(ocr.text), [ocr.text]);

    // Rows arrive from the grid already cleaned. A single untouched starter row
    // is replaced; anything typed is kept.
    const appendItems = (rows) => {
        if (!rows.length) return;
        const incoming = rows.map(row => ({
            _key: nextKey(),
            description: row.description ?? '',
            quantity: row.quantity ?? 1,
            unit: row.unit || 'pcs',
            estimated_unit_price: row.estimated_unit_price ?? 0,
        }));
        const startedEmpty = data.items.length === 1 && !data.items[0].description.trim();
        setData('items', startedEmpty ? incoming : [...data.items, ...incoming]);
    };

    // Calculate dynamic running grand total
    const grandTotal = data.items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.estimated_unit_price) || 0;
        return sum + (qty * price);
    }, 0);

    // A draft needs something in it, but not everything.
    const hasAnything = data.requester_department !== ''
        || data.remarks_or_notes.trim() !== ''
        || data.items.some(item => item.description.trim() !== '');

    const submitAs = (status) => {
        setPendingAction(status);
        // _key is a client-side concern and never goes to the server.
        transform(payload => ({
            ...payload,
            status,
            items: payload.items.map(({_key, ...item}) => item),
        }));

        const target = status === 'draft'
            ? route('encode.draft')
            : route('encode.store');

        post(target, {
            preserveScroll: true,
            onFinish: () => setPendingAction(null),
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        submitAs('submitted');
    };

    // Drafts save half-finished work, so this deliberately bypasses the browser's
    // required-field check by not being a submit button.
    const saveDraft = () => submitAs('draft');

    return (
        <AuthenticatedLayout>
            <Head title="Create a new request "/>

            <div className="py-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            New Purchase Request
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Fill out the procurement details and add request line items.
                        </p>
                    </div>

                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Primary Header Details Card */}
                    <div
                        className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Requester
                                Department</label>
                            <select
                                value={data.requester_department}
                                onChange={e => setData('requester_department', e.target.value)}
                                className="w-full text-xs rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="">Select a department...</option>
                                {/* Now mapping over the 'departments' prop from Laravel */}
                                {/* The name is stored, as everywhere else; the code only helps pick. */}
                                {departments.map((dept) => (
                                    <option key={dept.Department_Code} value={dept.Department_Name}>
                                        {dept.Department_Name} ({dept.Department_Code})
                                    </option>
                                ))}
                            </select>
                            {errors.requester_department &&
                                <p className="mt-1 text-xs text-red-500">{errors.requester_department}</p>}
                        </div>

                        {/*<div>*/}
                        {/*    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Needed By*/}
                        {/*        Date</label>*/}
                        {/*    <input*/}
                        {/*        type="date"*/}
                        {/*        value={data.needed_by_date}*/}
                        {/*        onChange={e => setData('needed_by_date', e.target.value)}*/}
                        {/*        className="w-full text-xs rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"*/}
                        {/*    />*/}
                        {/*    {errors.needed_by_date &&*/}
                        {/*        <p className="mt-1 text-xs text-red-500">{errors.needed_by_date}</p>}*/}
                        {/*</div>*/}

                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks
                                or Notes</label>
                            <textarea
                                value={data.remarks_or_notes}
                                onChange={e => setData('remarks_or_notes', e.target.value)}
                                rows={3}
                                className="w-full text-xs rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
                                placeholder="State core details, purpose, or additional notes here..."
                            />
                            {errors.remarks_or_notes &&
                                <p className="mt-1 text-xs text-red-500">{errors.remarks_or_notes}</p>}
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

                                {/* Bulk entry: paste a range, scan a document, or read it elsewhere */}
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

                        {data.items.map((item, index) => {
                            const descriptionError = errors[`items.${index}.description`];
                            const priceError = errors[`items.${index}.estimated_unit_price`];

                            return (
                                <div key={item._key}
                                     className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/40">
                                    <div className="md:col-span-7">
                                        <label
                                            htmlFor={`item-${index}-description`}
                                            className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5"
                                        >
                                            Description and specs
                                        </label>
                                        <textarea
                                            id={`item-${index}-description`}
                                            value={item.description}
                                            onChange={e => handleItemChange(index, 'description', e.target.value)}
                                            rows={2}
                                            aria-invalid={Boolean(descriptionError)}
                                            className={`w-full text-xs rounded-md dark:bg-gray-900 dark:text-white resize-y ${
                                                descriptionError
                                                    ? 'border-red-400 dark:border-red-500/70'
                                                    : 'border-gray-200 dark:border-gray-700'
                                            }`}
                                            placeholder="Item, brand, model, specifications, or other notes..."
                                        />
                                        {descriptionError &&
                                            <p className="mt-0.5 text-[11px] text-red-500">{descriptionError}</p>}
                                    </div>

                                    <div className="md:col-span-1">
                                        <label
                                            htmlFor={`item-${index}-quantity`}
                                            className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5"
                                        >
                                            Qty
                                        </label>
                                        <input
                                            id={`item-${index}-quantity`}
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="md:col-span-1">
                                        <label
                                            htmlFor={`item-${index}-unit`}
                                            className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5"
                                        >
                                            Unit
                                        </label>
                                        <input
                                            id={`item-${index}-unit`}
                                            type="text"
                                            value={item.unit}
                                            onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                            className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                            placeholder="pcs"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label
                                            htmlFor={`item-${index}-price`}
                                            className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5"
                                        >
                                            Est. unit price
                                        </label>
                                        <input
                                            id={`item-${index}-price`}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={item.estimated_unit_price}
                                            onChange={e => handleItemChange(index, 'estimated_unit_price', parseFloat(e.target.value) || 0)}
                                            aria-invalid={Boolean(priceError)}
                                            className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white text-right tabular-nums"
                                        />
                                    </div>

                                    <div className="md:col-span-1 flex flex-col items-end gap-1 pt-4">
                                        <span className="text-[11px] tabular-nums text-gray-600 dark:text-gray-400">
                                            {peso((parseFloat(item.quantity) || 0) * (parseFloat(item.estimated_unit_price) || 0))}
                                        </span>
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
                                </div>
                            );
                        })}

                        {/* Grand Total Bar */}
                        <div
                            className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <span
                                className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estimated Grand Total:</span>
                            <span className="text-base font-bold text-gray-900 dark:text-white">
                                {peso(grandTotal)}
                            </span>
                        </div>
                    </div>

                    {/* Bottom Action Submits */}
                    <div className="flex justify-end items-center gap-3">
                        <p className="mr-auto text-[11px] text-gray-500 dark:text-gray-400">
                            A draft is saved to your account and stays out of the approval queue until you submit it.
                        </p>

                        <Link
                            href={route('purchase-requests.index')}
                            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </Link>

                        <button
                            type="button"
                            onClick={saveDraft}
                            disabled={processing || !hasAnything}
                            title={hasAnything ? undefined : 'Select a department or add an item first.'}
                            className="px-4 py-2 text-xs font-semibold tracking-wide text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 transition-all"
                        >
                            {pendingAction === 'draft' ? 'Saving...' : 'Save as draft'}
                        </button>

                        <button
                            type="submit"
                            disabled={processing}
                            className="px-4 py-2 text-xs font-semibold tracking-wide text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                        >
                            {pendingAction === 'submitted' ? 'Submitting...' : 'Submit Purchase Request'}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

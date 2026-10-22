import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import UnitCell from '../Components/PasteGridComponents/UnitCell.jsx';
import AutoGrowTextarea from '../Components/PasteGridComponents/AutoGrowTextarea.jsx';
import { normalizeUnit } from '../Constants/Units.jsx';

/* ------------------------------------------------------------------ */
/* Clipboard parsing                                                   */
/* ------------------------------------------------------------------ */

/**
 * Parses clipboard text the way a spreadsheet writes it:
 *   - tab separates columns, newline separates rows
 *   - a cell containing tabs, newlines or quotes is wrapped in "..."
 *   - a literal quote inside a quoted cell is doubled ("")
 *
 * Returns a 2D array of raw strings. A single column of numbers comes
 * back as [['144'], ['144'], ['144']] - one column, three rows.
 */
export function parseClipboard(text) {
    const s = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < s.length; i++) {
        const ch = s[i];

        if (inQuotes) {
            if (ch === '"') {
                if (s[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += ch;
            }
            continue;
        }

        if (ch === '"' && cell === '') {
            inQuotes = true;
        } else if (ch === '\t') {
            row.push(cell);
            cell = '';
        } else if (ch === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += ch;
        }
    }
    row.push(cell);
    rows.push(row);

    // Excel leaves a trailing newline on a copied range.
    while (rows.length > 1 && rows[rows.length - 1].every(c => c.trim() === '')) {
        rows.pop();
    }
    return rows;
}

/** Strips currency marks, commas and stray spaces. Returns '' when there is no number. */
function toNumericString(raw) {
    const cleaned = String(raw).replace(/[₱P$,\s]/gi, '').replace(/[()]/g, '');
    if (cleaned === '' || Number.isNaN(Number(cleaned))) return '';
    return cleaned;
}

/* ------------------------------------------------------------------ */
/* Grid shape                                                          */
/* ------------------------------------------------------------------ */

// Description carries the whole item: name, brand, model, specs. It is the one
// field the request form itself keeps, so there is no separate name to fill in.
const COLUMNS = [
    { key: 'quantity', label: 'Qty', kind: 'number', className: 'w-20' },
    { key: 'unit', label: 'Unit', kind: 'unit', className: 'w-28' },
    { key: 'description', label: 'Description and specs', kind: 'multiline', className: 'min-w-[24rem]' },
    { key: 'estimated_unit_price', label: 'Unit cost', kind: 'number', className: 'w-28' },
];

const LAST_COL = COLUMNS.length - 1;

const emptyRow = () => ({
    quantity: '',
    unit: '',
    description: '',
    estimated_unit_price: '',
});

/**
 * Seeds a row from parsed OCR output. Zeros and the default quantity of 1
 * arrive as numbers from parseBlock; blanking them keeps the grid from
 * showing a "0" the encoder has to delete by hand.
 */
const seedRow = (r = {}) => ({
    quantity: Number(r.quantity) > 0 ? String(r.quantity) : '',
    unit: r.unit ?? '',
    // Older scans split a heading off the body; join them back into one field.
    description: [r.item_name, r.description].filter(Boolean).join('\n').trim(),
    estimated_unit_price: Number(r.estimated_unit_price) > 0 ? String(r.estimated_unit_price) : '',
});

const isRowEmpty = row => COLUMNS.every(col => String(row[col.key] ?? '').trim() === '');

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function PasteGrid({ initialRows = [], onAdd, onCancel, minRows = 4 }) {
    const [rows, setRows] = useState(() => {
        const seeded = initialRows.map(seedRow);
        while (seeded.length < minRows) seeded.push(emptyRow());
        return seeded;
    });

    // The highlighted block. r1/c1 is the cell the selection started from and
    // keeps keyboard focus; r2/c2 is the far corner. A paste is written inside
    // this block and nowhere else.
    const [sel, setSel] = useState({ r1: 0, c1: 0, r2: 0, c2: 0 });
    const [pasteNote, setPasteNote] = useState(null);

    const dragging = useRef(false);
    // Set just before we move focus ourselves, so the focus handler doesn't
    // collapse a selection we deliberately built.
    const keepSelection = useRef(false);

    const block = useMemo(() => ({
        top: Math.min(sel.r1, sel.r2),
        bottom: Math.max(sel.r1, sel.r2),
        left: Math.min(sel.c1, sel.c2),
        right: Math.max(sel.c1, sel.c2),
    }), [sel]);

    const blockHeight = block.bottom - block.top + 1;
    const blockWidth = block.right - block.left + 1;
    const hasBlock = blockHeight > 1 || blockWidth > 1;

    const inBlock = (r, c) =>
        r >= block.top && r <= block.bottom && c >= block.left && c <= block.right;

    useEffect(() => {
        const stop = () => { dragging.current = false; };
        window.addEventListener('mouseup', stop);
        return () => window.removeEventListener('mouseup', stop);
    }, []);

    const cellRefs = useRef({});
    const registerCell = (r, c) => el => {
        cellRefs.current[`${r}:${c}`] = el;
    };
    const focusCell = (r, c, { keepBlock = false } = {}) => {
        const el = cellRefs.current[`${r}:${c}`];
        if (!el) return;
        if (keepBlock && document.activeElement !== el) keepSelection.current = true;
        el.focus();
        if (!keepBlock && el.select) el.select();
    };

    const setCell = useCallback((rowIndex, key, value) => {
        setPasteNote(null);
        setRows(prev => {
            const next = prev.slice();
            next[rowIndex] = { ...next[rowIndex], [key]: value };
            return next;
        });
    }, []);

    /* --- selection -------------------------------------------------- */

    const handleCellMouseDown = (event, rowIndex, colIndex) => {
        if (event.shiftKey) {
            // Extend from the existing anchor. Blocking the default keeps focus
            // and the caret where the block started.
            event.preventDefault();
            setSel(prev => ({ ...prev, r2: rowIndex, c2: colIndex }));
            focusCell(sel.r1, sel.c1, { keepBlock: true });
            return;
        }
        dragging.current = true;
        setSel({ r1: rowIndex, c1: colIndex, r2: rowIndex, c2: colIndex });
    };

    const handleCellMouseEnter = (rowIndex, colIndex) => {
        if (!dragging.current) return;
        setSel(prev =>
            prev.r2 === rowIndex && prev.c2 === colIndex
                ? prev
                : { ...prev, r2: rowIndex, c2: colIndex });
    };

    const handleCellFocus = (rowIndex, colIndex) => {
        if (keepSelection.current) {
            keepSelection.current = false;
            return;
        }
        setSel({ r1: rowIndex, c1: colIndex, r2: rowIndex, c2: colIndex });
    };

    /** Clicking a row number highlights that whole row; shift extends to it. */
    const selectRow = (event, rowIndex) => {
        event.preventDefault();
        if (event.shiftKey) {
            setSel(prev => ({ ...prev, r2: rowIndex, c2: LAST_COL }));
            focusCell(sel.r1, sel.c1, { keepBlock: true });
            return;
        }
        setSel({ r1: rowIndex, c1: 0, r2: rowIndex, c2: LAST_COL });
        focusCell(rowIndex, 0, { keepBlock: true });
    };

    /* --- paste ------------------------------------------------------ */

    /**
     * The highlighted block is the whole target. Nothing is written outside it
     * and no rows are created, so a clipboard bigger than the block is clipped
     * and reported rather than spilling down the grid.
     */
    const handlePaste = (event, rowIndex, colIndex) => {
        const col = COLUMNS[colIndex];
        const text = event.clipboardData.getData('text/plain');
        if (!text) return;

        const matrix = parseClipboard(text);
        const target = hasBlock
            ? block
            : { top: rowIndex, bottom: rowIndex, left: colIndex, right: colIndex };
        const height = target.bottom - target.top + 1;
        const width = target.right - target.left + 1;
        const oneValue = matrix.length === 1 && matrix[0].length === 1;

        // A single highlighted cell takes the paste the way any text field
        // would, caret and selected text included.
        if (height === 1 && width === 1) {
            setPasteNote(null);
            if (col.kind === 'number') {
                event.preventDefault();
                const el = event.target;
                const current = String(el.value ?? '');
                const start = el.selectionStart ?? current.length;
                const end = el.selectionEnd ?? current.length;
                const insert = toNumericString(matrix[0][0]);
                setCell(rowIndex, col.key, current.slice(0, start) + insert + current.slice(end));
                const caret = start + insert.length;
                requestAnimationFrame(() => el.setSelectionRange?.(caret, caret));
            }
            return;
        }

        event.preventDefault();

        setRows(prev => {
            const next = prev.slice();

            for (let r = 0; r < height; r++) {
                for (let c = 0; c < width; c++) {
                    // One copied value fills every highlighted cell; a range is
                    // laid out from the top-left of the block.
                    const raw = oneValue ? matrix[0][0] : matrix[r]?.[c];
                    if (raw === undefined) continue;

                    const targetCol = COLUMNS[target.left + c];
                    const rowAt = target.top + r;
                    if (!targetCol || !next[rowAt]) continue;

                    const value = targetCol.kind === 'number'
                        ? toNumericString(raw)
                        : raw.trim();
                    next[rowAt] = { ...next[rowAt], [targetCol.key]: value };
                }
            }
            return next;
        });

        const clippedRows = oneValue ? 0 : Math.max(0, matrix.length - height);
        const clippedCols = oneValue
            ? 0
            : Math.max(0, Math.max(...matrix.map(line => line.length)) - width);
        const leftOut = [
            clippedRows ? `${clippedRows} row${clippedRows === 1 ? '' : 's'}` : null,
            clippedCols ? `${clippedCols} column${clippedCols === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' and ');

        setPasteNote(
            leftOut
                ? `Filled the ${height * width} highlighted cells. Another ${leftOut} stayed on the ` +
                'clipboard. Highlight a bigger block to bring the rest in.'
                : null,
        );
    };

    /* --- keyboard --------------------------------------------------- */

    const handleKeyDown = (event, rowIndex, colIndex) => {
        const col = COLUMNS[colIndex];
        const lastRow = rows.length - 1;

        // Shift with the vertical arrows grows the highlighted block. Plain
        // left and right stay as caret movement inside the cell.
        if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            const next = sel.r2 + step;
            if (next < 0) return;
            if (next > lastRow) setRows(prev => [...prev, emptyRow()]);
            setSel(prev => ({ ...prev, r2: next }));
            return;
        }

        if (event.key === 'Escape' && hasBlock) {
            event.preventDefault();
            setSel(prev => ({ r1: prev.r1, c1: prev.c1, r2: prev.r1, c2: prev.c1 }));
            return;
        }

        if (event.key === 'Enter' && !event.shiftKey && col.kind !== 'multiline') {
            event.preventDefault();
            if (rowIndex === lastRow) setRows(prev => [...prev, emptyRow()]);
            focusCell(rowIndex + 1, colIndex);
        } else if (event.key === 'ArrowDown' && col.kind !== 'multiline') {
            event.preventDefault();
            focusCell(Math.min(rowIndex + 1, lastRow), colIndex);
        } else if (event.key === 'ArrowUp' && col.kind !== 'multiline') {
            event.preventDefault();
            focusCell(Math.max(rowIndex - 1, 0), colIndex);
        }
    };

    /* --- row actions ------------------------------------------------ */

    const addRows = (count = 1) =>
        setRows(prev => [...prev, ...Array.from({ length: count }, emptyRow)]);

    const removeRow = index => {
        setSel({ r1: 0, c1: 0, r2: 0, c2: 0 });
        setRows(prev => {
            const next = prev.filter((_, i) => i !== index);
            return next.length ? next : [emptyRow()];
        });
    };

    const clearAll = () => {
        setPasteNote(null);
        setSel({ r1: 0, c1: 0, r2: 0, c2: 0 });
        setRows(Array.from({ length: minRows }, emptyRow));
    };

    /* --- derived ---------------------------------------------------- */

    const filledRows = useMemo(() => rows.filter(r => !isRowEmpty(r)), [rows]);

    const readyRows = useMemo(() => filledRows
        .filter(r => r.description.trim() !== '' && Number(r.quantity) > 0)
        .map(r => ({
            description: r.description.trim(),
            quantity: Number(r.quantity),
            unit: normalizeUnit(r.unit),
            estimated_unit_price: Number(r.estimated_unit_price) || 0,
        })), [filledRows]);

    const incompleteCount = filledRows.length - readyRows.length;

    const total = useMemo(
        () => readyRows.reduce((sum, r) => sum + r.quantity * r.estimated_unit_price, 0),
        [readyRows],
    );

    const peso = n => `₱${n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

    /* --- render ----------------------------------------------------- */

    const cellBase =
        'w-full bg-transparent border-0 px-2 py-1.5 text-xs text-gray-900 dark:text-white ' +
        'placeholder:text-gray-300 dark:placeholder:text-gray-600 ' +
        'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 rounded-sm';

    return (
        <div className="space-y-3">
            <p className="max-w-2xl text-xs text-gray-700 dark:text-gray-300">
                Drag across the cells you want to fill, or click a row number to take the whole row,
                then paste. The copied values land inside the highlighted cells only, and one copied
                value fills all of them. Paste with a single cell selected and it stays in that cell.
                Check quantities against the paper before adding, since a wrong number looks exactly
                like a right one.
            </p>

            <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
                <table className="min-w-full border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                        <th className="w-9 border-b border-gray-200 dark:border-gray-700 px-2 py-1.5" />
                        {COLUMNS.map(col => (
                            <th
                                key={col.key}
                                className={`border-b border-l border-gray-200 dark:border-gray-700 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${col.className}`}
                            >
                                {col.label}
                            </th>
                        ))}
                        <th className="w-28 border-b border-l border-gray-200 dark:border-gray-700 px-2 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Amount
                        </th>
                        <th className="w-8 border-b border-l border-gray-200 dark:border-gray-700" />
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((row, rowIndex) => {
                        const amount = (Number(row.quantity) || 0) * (Number(row.estimated_unit_price) || 0);
                        const rowInBlock = hasBlock && rowIndex >= block.top && rowIndex <= block.bottom;

                        return (
                            <tr
                                key={rowIndex}
                                className="odd:bg-white even:bg-gray-50/60 dark:odd:bg-gray-900 dark:even:bg-gray-900/40"
                            >
                                <td
                                    onMouseDown={e => selectRow(e, rowIndex)}
                                    title="Highlight this row"
                                    className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right text-[11px] tabular-nums select-none align-top ${
                                        rowInBlock
                                            ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                                            : 'text-gray-400 dark:text-gray-600'
                                    }`}
                                >
                                    {rowIndex + 1}
                                </td>

                                {COLUMNS.map((col, colIndex) => {
                                    const highlighted = hasBlock && inBlock(rowIndex, colIndex);

                                    return (
                                        <td
                                            key={col.key}
                                            onMouseDown={e => handleCellMouseDown(e, rowIndex, colIndex)}
                                            onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                                            className={`border-b border-l border-gray-100 dark:border-gray-800 p-0 align-top ${
                                                highlighted ? 'bg-indigo-100/70 dark:bg-indigo-500/20' : ''
                                            }`}
                                        >
                                            {col.kind === 'unit' ? (
                                                <UnitCell
                                                    ref={registerCell(rowIndex, colIndex)}
                                                    value={row[col.key]}
                                                    onChange={val => setCell(rowIndex, col.key, val)}
                                                    onFocus={() => handleCellFocus(rowIndex, colIndex)}
                                                    onPaste={e => handlePaste(e, rowIndex, colIndex)}
                                                    onKeyDown={e => handleKeyDown(e, rowIndex, colIndex)}
                                                    className={cellBase}
                                                />
                                            ) : col.kind === 'multiline' ? (
                                                <AutoGrowTextarea
                                                    ref={registerCell(rowIndex, colIndex)}
                                                    value={row[col.key]}
                                                    minRows={1}
                                                    maxRows={10}
                                                    spellCheck={false}
                                                    placeholder="Brand, model, specifications, or other notes…"
                                                    onChange={e => setCell(rowIndex, col.key, e.target.value)}
                                                    onFocus={() => handleCellFocus(rowIndex, colIndex)}
                                                    onPaste={e => handlePaste(e, rowIndex, colIndex)}
                                                    onKeyDown={e => handleKeyDown(e, rowIndex, colIndex)}
                                                    className={`${cellBase} font-mono leading-relaxed`}
                                                />
                                            ) : (
                                                <input
                                                    ref={registerCell(rowIndex, colIndex)}
                                                    type="text"
                                                    inputMode={col.kind === 'number' ? 'decimal' : 'text'}
                                                    value={row[col.key]}
                                                    spellCheck={false}
                                                    onChange={e => setCell(rowIndex, col.key, e.target.value)}
                                                    onFocus={() => handleCellFocus(rowIndex, colIndex)}
                                                    onPaste={e => handlePaste(e, rowIndex, colIndex)}
                                                    onKeyDown={e => handleKeyDown(e, rowIndex, colIndex)}
                                                    className={`${cellBase} ${col.kind === 'number' ? 'text-right tabular-nums' : ''}`}
                                                />
                                            )}
                                        </td>
                                    );
                                })}

                                <td className="border-b border-l border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right text-xs tabular-nums text-gray-600 dark:text-gray-400 align-top">
                                    {amount > 0 ? peso(amount) : ''}
                                </td>

                                <td className="border-b border-l border-gray-100 dark:border-gray-800 text-center align-top">
                                    <button
                                        type="button"
                                        onClick={() => removeRow(rowIndex)}
                                        aria-label={`Remove row ${rowIndex + 1}`}
                                        className="px-1 py-1.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors"
                                    >
                                        ×
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>

            {pasteNote && (
                <p role="status" className="text-xs text-amber-600 dark:text-amber-400">
                    {pasteNote}
                </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => addRows(1)}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                        Add row
                    </button>
                    <button
                        type="button"
                        onClick={() => addRows(10)}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                        Add 10 rows
                    </button>
                    <button
                        type="button"
                        onClick={clearAll}
                        className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                        Clear grid
                    </button>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400">
                    {hasBlock && (
                        <span className="text-indigo-600 dark:text-indigo-400">
                            {blockHeight * blockWidth} cells highlighted ·{' '}
                        </span>
                    )}
                    {readyRows.length} item{readyRows.length === 1 ? '' : 's'} ready
                    {incompleteCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                            {' '}· {incompleteCount} row{incompleteCount === 1 ? '' : 's'} still need a
                            description and quantity
                        </span>
                    )}
                    {total > 0 && <span className="tabular-nums"> · {peso(total)}</span>}
                </p>
            </div>

            <div className="flex justify-end items-center gap-3 pt-1">
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                    Discard scan
                </button>
                <button
                    type="button"
                    onClick={() => onAdd(readyRows)}
                    disabled={readyRows.length === 0}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                    Add {readyRows.length} item{readyRows.length === 1 ? '' : 's'}
                </button>
            </div>
        </div>
    );
}

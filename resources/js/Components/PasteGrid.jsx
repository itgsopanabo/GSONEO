import React, { useCallback, useMemo, useRef, useState } from 'react';
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

const COLUMNS = [
    { key: 'quantity', label: 'Qty', kind: 'number', className: 'w-20' },
    { key: 'unit', label: 'Unit', kind: 'unit', className: 'w-28' },
    { key: 'item_name', label: 'Item Name', kind: 'text', className: 'min-w-[14rem]' },
    { key: 'description', label: 'Item Description', kind: 'multiline', className: 'min-w-[16rem]' },
    { key: 'estimated_unit_price', label: 'Unit cost', kind: 'number', className: 'w-28' },
];

const emptyRow = () => ({
    quantity: '',
    unit: '',
    item_name: '',
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
    item_name: r.item_name ?? '',
    description: r.description ?? '',
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

    const cellRefs = useRef({});
    const registerCell = (r, c) => el => {
        cellRefs.current[`${r}:${c}`] = el;
    };
    const focusCell = (r, c) => {
        const el = cellRefs.current[`${r}:${c}`];
        if (el) {
            el.focus();
            if (el.select) el.select();
        }
    };

    const setCell = useCallback((rowIndex, key, value) => {
        setRows(prev => {
            const next = prev.slice();
            next[rowIndex] = { ...next[rowIndex], [key]: value };
            return next;
        });
    }, []);

    /** Writes a clipboard matrix into the grid starting at the anchor cell. */
    const handlePaste = (event, rowIndex, colIndex) => {
        const text = event.clipboardData.getData('text/plain');
        if (!text) return;

        const matrix = parseClipboard(text);
        const isSingleCell = matrix.length === 1 && matrix[0].length === 1;
        if (isSingleCell && !matrix[0][0].includes('\n')) return; // let the browser handle it

        event.preventDefault();

        setRows(prev => {
            const next = prev.slice();
            while (next.length < rowIndex + matrix.length) next.push(emptyRow());

            matrix.forEach((line, r) => {
                line.forEach((raw, c) => {
                    const col = COLUMNS[colIndex + c];
                    if (!col) return; // pasted range is wider than the grid; drop the overflow
                    const value = col.kind === 'number' ? toNumericString(raw) : raw.trim();
                    next[rowIndex + r] = { ...next[rowIndex + r], [col.key]: value };
                });
            });

            // Keep a spare row at the bottom to paste into next.
            if (!isRowEmpty(next[next.length - 1])) next.push(emptyRow());
            return next;
        });
    };

    const handleKeyDown = (event, rowIndex, colIndex) => {
        const col = COLUMNS[colIndex];
        const lastRow = rows.length - 1;

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

    const addRow = () => setRows(prev => [...prev, emptyRow()]);

    const removeRow = index => setRows(prev => {
        const next = prev.filter((_, i) => i !== index);
        return next.length ? next : [emptyRow()];
    });

    const clearAll = () => setRows(Array.from({ length: minRows }, emptyRow));

    /* --- derived ---------------------------------------------------- */

    const filledRows = useMemo(() => rows.filter(r => !isRowEmpty(r)), [rows]);

    const readyRows = useMemo(() => filledRows
        .filter(r => r.item_name.trim() !== '' && Number(r.quantity) > 0)
        .map(r => ({
            item_name: r.item_name.trim(),
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
            <p className="text-xs text-gray-700 dark:text-gray-300">
                Copy a range from Excel and paste into the cell where it should start. One column of
                numbers fills that column downward; a wider selection spreads across the columns to
                its right. Check quantities against the paper before adding, since a wrong number
                looks exactly like a right one.
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
                        return (
                            <tr
                                key={rowIndex}
                                className="odd:bg-white even:bg-gray-50/60 dark:odd:bg-gray-900 dark:even:bg-gray-900/40"
                            >
                                <td className="border-b border-gray-100 dark:border-gray-800 px-2 py-1.5 text-right text-[11px] tabular-nums text-gray-400 dark:text-gray-600 select-none align-top">
                                    {rowIndex + 1}
                                </td>

                                {COLUMNS.map((col, colIndex) => (
                                    <td
                                        key={col.key}
                                        className="border-b border-l border-gray-100 dark:border-gray-800 p-0 align-top"
                                    >
                                        {col.kind === 'unit' ? (
                                            <UnitCell
                                                ref={registerCell(rowIndex, colIndex)}
                                                value={row[col.key]}
                                                onChange={val => setCell(rowIndex, col.key, val)}
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
                                                onChange={e => setCell(rowIndex, col.key, e.target.value)}
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
                                                onPaste={e => handlePaste(e, rowIndex, colIndex)}
                                                onKeyDown={e => handleKeyDown(e, rowIndex, colIndex)}
                                                className={`${cellBase} ${col.kind === 'number' ? 'text-right tabular-nums' : ''}`}
                                            />
                                        )}
                                    </td>
                                ))}

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

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={addRow}
                        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                        Add row
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
                    {readyRows.length} item{readyRows.length === 1 ? '' : 's'} ready
                    {incompleteCount > 0 && (
                        <span className="text-amber-600 dark:text-amber-400">
                            {' '}· {incompleteCount} row{incompleteCount === 1 ? '' : 's'} still need a
                            name and quantity
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

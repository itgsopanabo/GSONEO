import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx'
import { formatDateTime } from '@/Utils/formatDate.js'

function formatValue(value, type) {
    if (value === null || value === undefined || value === '') return '—'
    if (type === 'number') {
        const n = Number(value)
        return isNaN(n) ? value : n.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
    if (type === 'date') {
        return formatDateTime(value, { dateOnlyAtMidnight: true }, String(value))
    }
    return String(value)
}

/**
 * Left blank deliberately. These are signed by hand on the printed copy, so
 * the rule is the field.
 */
function SignatureLine({ caption }) {
    return (
        <div>
            <div className="mt-10 border-b border-gray-900 dark:border-gray-100" />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{caption}</p>
        </div>
    )
}

export default function CustomReportIndex({
                                              dataset,
                                              datasets = [],
                                              available = {},
                                              operators = [],
                                              aggregateFns = [],
                                              selection = {},
                                              headers = [],
                                              rows = [],
                                              rowCount = 0,
                                              truncated = false,
                                              generatedAt,
                                          }) {
    const [draft, setDraft] = useState({
        columns: selection.columns ?? [],
        filters: selection.filters ?? [],
        group_by: selection.group_by ?? '',
        aggregates: selection.aggregates ?? [],
        sort: selection.sort ?? '',
        direction: selection.direction ?? 'desc',
    })

    const [title, setTitle] = useState('')
    const [columnQuery, setColumnQuery] = useState('')
    const [showColumnMenu, setShowColumnMenu] = useState(false)

    const columnList = Object.values(available)

    // Unselected columns matching what's typed, capped so the menu stays short.
    const columnMatches = columnList
        .filter(
            (c) =>
                !draft.columns.includes(c.key) &&
                `${c.table} ${c.label}`.toLowerCase().includes(columnQuery.toLowerCase())
        )
        .slice(0, 12)

    function run(next = {}, nextDataset = dataset) {
        const merged = { ...draft, ...next }
        setDraft(merged)
        router.get(route('custom-reports.index'), { ...merged, dataset: nextDataset }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        })
    }

    function toggleColumn(key) {
        const columns = draft.columns.includes(key)
            ? draft.columns.filter((c) => c !== key)
            : [...draft.columns, key]
        run({ columns })
    }

    function addFilter() {
        setDraft({
            ...draft,
            filters: [...draft.filters, { column: columnList[0]?.key ?? '', operator: 'eq', value: '' }],
        })
    }

    function updateFilter(i, patch) {
        const filters = draft.filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f))
        setDraft({ ...draft, filters })
        // Only re-query once the row is complete.
        const f = filters[i]
        const needsValue = !['empty', 'filled'].includes(f.operator)
        if (f.column && (!needsValue || f.value !== '')) run({ filters })
    }

    function removeFilter(i) {
        run({ filters: draft.filters.filter((_, idx) => idx !== i) })
    }

    function addAggregate() {
        setDraft({
            ...draft,
            aggregates: [...draft.aggregates, { column: columnList[0]?.key ?? '', fn: 'count' }],
        })
    }

    function updateAggregate(i, patch) {
        const aggregates = draft.aggregates.map((a, idx) => (idx === i ? { ...a, ...patch } : a))
        run({ aggregates })
    }

    function removeAggregate(i) {
        run({ aggregates: draft.aggregates.filter((_, idx) => idx !== i) })
    }

    function downloadCsv() {
        const params = new URLSearchParams()
        params.set('dataset', dataset)
        params.set('export', 'csv')
        draft.columns.forEach((c) => params.append('columns[]', c))
        draft.filters.forEach((f, i) => {
            params.append(`filters[${i}][column]`, f.column)
            params.append(`filters[${i}][operator]`, f.operator)
            if (f.value != null) params.append(`filters[${i}][value]`, f.value)
        })
        draft.aggregates.forEach((a, i) => {
            params.append(`aggregates[${i}][column]`, a.column)
            params.append(`aggregates[${i}][fn]`, a.fn)
        })
        if (draft.group_by) params.set('group_by', draft.group_by)
        if (draft.sort) params.set('sort', draft.sort)
        params.set('direction', draft.direction)

        window.location = `${route('custom-reports.index')}?${params.toString()}`
    }

    const activeDataset = datasets.find((d) => d.key === dataset)

    return (
        <AuthenticatedLayout>
            <Head title="Custom Reports" />

            <style>{`
                @media print {
                    body { background: #fff; }
                    nav, aside, .no-print { display: none !important; }
                    .print-sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
                    table { font-size: 9pt; }
                    thead { display: table-header-group; }
                    tr { break-inside: avoid; }
                    @page { margin: 16mm 12mm; }
                }
            `}</style>

            <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                <div className="no-print space-y-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                Custom reports
                            </h1>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Pick a dataset, choose the columns you need, then filter or group it.
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={downloadCsv}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                                Download CSV
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                            >
                                Print
                            </button>
                        </div>
                    </div>

                    {/* Dataset */}
                    <div className="inline-flex flex-wrap overflow-hidden rounded-md border border-gray-300 dark:border-gray-600">
                        {datasets.map((d) => (
                            <button
                                key={d.key}
                                type="button"
                                aria-pressed={dataset === d.key}
                                onClick={() =>
                                    router.get(route('custom-reports.index'), { dataset: d.key }, { replace: true })
                                }
                                className={`border-r border-gray-300 px-4 py-2 text-sm last:border-r-0 dark:border-gray-600 ${
                                    dataset === d.key
                                        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                        : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                                }`}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>

                    {/* Columns */}
                    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-baseline justify-between">
                            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Columns</h2>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {draft.columns.length} selected
                            </span>
                        </div>

                        {/* Selected columns, in the order they'll appear */}
                        {draft.columns.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {draft.columns.map((key) => (
                                    <button
                                        key={key}
                                        type="button"
                                        disabled={Boolean(draft.group_by)}
                                        onClick={() => toggleColumn(key)}
                                        className="group inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-1 pl-3 pr-2 text-sm text-gray-700 disabled:opacity-50 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                    >
                                        {available[key]?.label ?? key}
                                        <span aria-hidden="true" className="text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-100">
                                            ×
                                        </span>
                                        <span className="sr-only">Remove this column</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Type to find a column rather than hunting a checkbox grid */}
                        <div
                            className="relative mt-3"
                            onBlur={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget)) setShowColumnMenu(false)
                            }}
                        >
                            <input
                                type="text"
                                value={columnQuery}
                                disabled={Boolean(draft.group_by)}
                                placeholder="Type a column name to add it"
                                aria-label="Add a column"
                                onFocus={() => setShowColumnMenu(true)}
                                onChange={(e) => {
                                    setColumnQuery(e.target.value)
                                    setShowColumnMenu(true)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && columnMatches[0]) {
                                        toggleColumn(columnMatches[0].key)
                                        setColumnQuery('')
                                    }
                                    if (e.key === 'Escape') setShowColumnMenu(false)
                                }}
                                className="w-full rounded-md border-gray-300 text-sm shadow-sm disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800"
                            />

                            {showColumnMenu && !draft.group_by && (
                                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-900">
                                    {columnMatches.length ? (
                                        columnMatches.map((col) => (
                                            <li key={col.key}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        toggleColumn(col.key)
                                                        setColumnQuery('')
                                                    }}
                                                    className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                                >
                                                    <span>{col.label}</span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                                        {col.table}
                                                    </span>
                                                </button>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                            {columnQuery
                                                ? 'No column matches that name.'
                                                : 'Every column is already selected.'}
                                        </li>
                                    )}
                                </ul>
                            )}
                        </div>

                        {draft.group_by && (
                            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                                Column selection is off while the report is grouped. Clear the grouping below to
                                pick columns again.
                            </p>
                        )}
                    </div>

                    {/* Filters */}
                    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                        <div className="flex items-baseline justify-between">
                            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Filters</h2>
                            <button
                                onClick={addFilter}
                                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                            >
                                Add filter
                            </button>
                        </div>

                        {draft.filters.length === 0 ? (
                            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                No filters. The report covers every record in this dataset.
                            </p>
                        ) : (
                            <div className="mt-4 space-y-2">
                                {draft.filters.map((f, i) => {
                                    const col = available[f.column]
                                    const needsValue = !['empty', 'filled'].includes(f.operator)
                                    return (
                                        <div key={i} className="flex flex-wrap items-center gap-2">
                                            <select
                                                value={f.column}
                                                aria-label="Filter column"
                                                onChange={(e) => updateFilter(i, { column: e.target.value })}
                                                className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                            >
                                                {columnList.map((c) => (
                                                    <option key={c.key} value={c.key}>
                                                        {c.table} · {c.label}
                                                    </option>
                                                ))}
                                            </select>

                                            <select
                                                value={f.operator}
                                                aria-label="Filter condition"
                                                onChange={(e) => updateFilter(i, { operator: e.target.value })}
                                                className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                            >
                                                {operators.map((o) => (
                                                    <option key={o.key} value={o.key}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </select>

                                            {needsValue && (
                                                <input
                                                    type={col?.type === 'date' ? 'date' : col?.type === 'number' ? 'number' : 'text'}
                                                    value={f.value ?? ''}
                                                    aria-label="Filter value"
                                                    onChange={(e) => updateFilter(i, { value: e.target.value })}
                                                    className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                                />
                                            )}

                                            <button
                                                onClick={() => removeFilter(i)}
                                                aria-label="Remove filter"
                                                className="px-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Grouping */}
                    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
                        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Group and summarise</h2>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                            <span>Group rows by</span>
                            <select
                                value={draft.group_by}
                                aria-label="Group by column"
                                onChange={(e) => run({ group_by: e.target.value })}
                                className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                            >
                                <option value="">Nothing — list every record</option>
                                {columnList.map((c) => (
                                    <option key={c.key} value={c.key}>
                                        {c.table} · {c.label}
                                    </option>
                                ))}
                            </select>

                            {draft.group_by && (
                                <button
                                    onClick={addAggregate}
                                    className="text-blue-600 hover:underline dark:text-blue-400"
                                >
                                    Add calculation
                                </button>
                            )}
                        </div>

                        {draft.group_by && draft.aggregates.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {draft.aggregates.map((a, i) => (
                                    <div key={i} className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={a.fn}
                                            aria-label="Calculation"
                                            onChange={(e) => updateAggregate(i, { fn: e.target.value })}
                                            className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                        >
                                            {aggregateFns.map((fn) => (
                                                <option key={fn} value={fn}>
                                                    {fn}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">of</span>
                                        <select
                                            value={a.column}
                                            aria-label="Calculation column"
                                            onChange={(e) => updateAggregate(i, { column: e.target.value })}
                                            className="rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                        >
                                            {columnList.map((c) => (
                                                <option key={c.key} value={c.key}>
                                                    {c.table} · {c.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => removeAggregate(i)}
                                            aria-label="Remove calculation"
                                            className="px-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            type="text"
                            value={title}
                            placeholder="Report title for the printed copy"
                            onChange={(e) => setTitle(e.target.value)}
                            className="min-w-64 flex-1 rounded-md border-gray-300 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        />
                        <Link
                            href={route('request-monitoring.index')}
                            className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        >
                            Back to monitoring
                        </Link>
                    </div>
                </div>

                {/* The sheet — this is what prints */}
                <div className="print-sheet rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800">
                    <div className="text-center">
                        {/* Replace with the real office and agency name */}
                        <p className="text-sm text-gray-600 dark:text-gray-400">General Services Office</p>
                        <h2 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {title || activeDataset?.label}
                        </h2>
                    </div>

                    <div className="mt-6 overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                            <tr className="border-y border-gray-300 dark:border-gray-600">
                                {headers.map((h) => (
                                    <th
                                        key={h.key}
                                        className={`px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300 ${
                                            h.type === 'number' ? 'text-right' : ''
                                        }`}
                                    >
                                        {h.label}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {rows.length ? (
                                rows.map((row, i) => (
                                    <tr
                                        key={i}
                                        className="border-b border-gray-200 last:border-b-0 dark:border-gray-700"
                                    >
                                        {headers.map((h) => (
                                            <td
                                                key={h.key}
                                                className={`px-3 py-2 text-gray-800 dark:text-gray-200 ${
                                                    h.type === 'number' ? 'text-right tabular-nums' : ''
                                                }`}
                                            >
                                                {formatValue(row[h.key], h.type)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td
                                        colSpan={Math.max(headers.length, 1)}
                                        className="px-3 py-12 text-center text-gray-500 dark:text-gray-400"
                                    >
                                        No records match. Remove a filter or pick a different dataset.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>

                    <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">
                        Total records: <span className="font-medium tabular-nums">{rowCount.toLocaleString()}</span>
                        {truncated && (
                            <span className="no-print ml-2 text-gray-500 dark:text-gray-400">
                                — showing the first {rows.length} on screen. Download the CSV for all of them.
                            </span>
                        )}
                    </p>

                    <div className="mt-12 grid gap-12 sm:grid-cols-2">
                        <SignatureLine caption="Prepared by" />
                        <SignatureLine caption="Noted by" />
                    </div>

                    <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
                        Generated {formatValue(generatedAt, 'date')}
                    </p>
                </div>
            </div>
        </AuthenticatedLayout>
    )
}

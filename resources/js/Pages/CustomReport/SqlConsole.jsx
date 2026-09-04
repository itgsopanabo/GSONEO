import { Head, Link, router } from '@inertiajs/react'
import { useState } from 'react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx'

function display(value) {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-600">null</span>
    }
    if (value === '') return <span className="text-gray-400 dark:text-gray-600">empty</span>
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

export default function SqlConsole({
                                       sql = '',
                                       headers = [],
                                       rows = [],
                                       rowCount = 0,
                                       truncated = false,
                                       elapsedMs,
                                       error,
                                       rowLimit,
                                       tables = [],
                                       generatedAt,
                                   }) {
    const [query, setQuery] = useState(sql)
    const [running, setRunning] = useState(false)

    function run() {
        if (!query.trim()) return
        setRunning(true)
        router.get(
            route('sql-console.index'),
            { sql: query },
            { preserveState: true, preserveScroll: true, replace: true, onFinish: () => setRunning(false) }
        )
    }

    function downloadCsv() {
        window.location = `${route('sql-console.index')}?${new URLSearchParams({ sql: query, export: 'csv' })}`
    }

    return (
        <AuthenticatedLayout>
            <Head title="SQL Console" />

            <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">SQL console</h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Read-only. Queries run as a database user that can only SELECT, and every query is
                            logged against your account.
                        </p>
                    </div>
                    <Link
                        href={route('custom-reports.index')}
                        className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        Back to report builder
                    </Link>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
                    <div className="space-y-3">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run()
                            }}
                            rows={8}
                            spellCheck={false}
                            aria-label="SQL query"
                            placeholder="SELECT pr_number, requester_department, status FROM purchase_requests ORDER BY created_at DESC"
                            className="w-full rounded-lg border-gray-300 font-mono text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                        />

                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={run}
                                disabled={running || !query.trim()}
                                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                            >
                                {running ? 'Running…' : 'Run query'}
                            </button>

                            {rows.length > 0 && (
                                <button
                                    onClick={downloadCsv}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                >
                                    Download CSV
                                </button>
                            )}

                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                Ctrl or Cmd + Enter to run
                            </span>
                        </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tables</p>
                        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
                            {tables.map((t) => (
                                <li key={t}>
                                    <button
                                        onClick={() => setQuery(`SELECT * FROM ${t}`)}
                                        className="w-full truncate text-left font-mono text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                                    >
                                        {t}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">Query not run</p>
                        <p className="mt-1 font-mono text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                )}

                {!error && headers.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {rowCount.toLocaleString()} {rowCount === 1 ? 'row' : 'rows'}
                            {elapsedMs !== null && ` in ${elapsedMs} ms`}
                            {truncated && ` — capped at ${rowLimit.toLocaleString()}, download the CSV for the rest`}
                        </p>

                        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    {headers.map((h) => (
                                        <th
                                            key={h}
                                            className="whitespace-nowrap px-3 py-2 text-left font-mono text-xs font-medium text-gray-600 dark:text-gray-400"
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {rows.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                        {headers.map((h) => (
                                            <td
                                                key={h}
                                                className="max-w-xs truncate px-3 py-2 text-gray-800 dark:text-gray-200"
                                                title={row[h] === null ? 'null' : String(row[h] ?? '')}
                                            >
                                                {display(row[h])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {!error && headers.length === 0 && sql && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        The query ran and returned no rows.
                    </p>
                )}
            </div>
        </AuthenticatedLayout>
    )
}

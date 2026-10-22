import { Head, Link, router } from '@inertiajs/react'
import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Download, Link2, Pencil, Play, Save, Search, Table2, Trash2, Users } from 'lucide-react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx'
import Modal from '@/Components/Modal'
import InputError from '@/Components/InputError'
import { formatDateTime, parseDate } from '@/Utils/formatDate.js'

function display(value) {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-600">null</span>
    }
    if (value === '') return <span className="text-gray-400 dark:text-gray-600">empty</span>
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
}

/** "Just now", "12 min ago", "3 h ago", "5 days ago", or the date. */
function since(value) {
    const date = parseDate(value)
    if (!date) return null
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
    return formatDateTime(value)
}

const BLANK = { name: '', description: '', is_shared: false }
const inputClass = 'mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'

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
    savedQueries = [],
    loadedQuery = null,
}) {
    const [query, setQuery] = useState(sql)
    const [running, setRunning] = useState(false)
    // The saved query in the editor, if any — so Save can offer to update it.
    const [loadedId, setLoadedId] = useState(loadedQuery?.id ?? null)
    const [filter, setFilter] = useState('')

    const [dialog, setDialog] = useState(null)   // null | { mode: 'new' | 'update' | 'edit', query? }
    const [form, setForm] = useState(BLANK)
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(null)

    // A redirect after saving, or a bookmarked ?saved= link, opens that query.
    useEffect(() => {
        setLoadedId(loadedQuery?.id ?? null)
        setQuery(sql)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadedQuery?.id])

    const loaded = savedQueries.find((q) => q.id === loadedId) ?? null
    const changedSinceLoad = loaded && loaded.sql.trim() !== query.trim()

    const mine = savedQueries.filter((q) => q.mine)
    const shared = savedQueries.filter((q) => !q.mine)
    const matches = (q) => !filter.trim() || `${q.name} ${q.description ?? ''}`.toLowerCase().includes(filter.trim().toLowerCase())

    function run() {
        if (!query.trim()) return
        setRunning(true)
        // An unchanged saved query runs by its id, which counts the run and keeps the link.
        const params = loaded && !changedSinceLoad ? { saved: loaded.id } : { sql: query }
        router.get(route('sql-console.index'), params, {
            preserveState: true, preserveScroll: true, replace: true, onFinish: () => setRunning(false),
        })
    }

    function runSaved(q) {
        setLoadedId(q.id)
        setQuery(q.sql)
        setRunning(true)
        router.get(route('sql-console.index'), { saved: q.id }, {
            preserveState: true, preserveScroll: true, replace: true, onFinish: () => setRunning(false),
        })
    }

    function downloadCsv() {
        const params = loaded && !changedSinceLoad ? { saved: loaded.id, export: 'csv' } : { sql: query, export: 'csv' }
        window.location = `${route('sql-console.index')}?${new URLSearchParams(params)}`
    }

    function copyLink(q) {
        navigator.clipboard?.writeText(route('sql-console.index', { saved: q.id }))
    }

    function openSave() {
        setErrors({})
        if (loaded?.mine) {
            setForm({ name: loaded.name, description: loaded.description ?? '', is_shared: loaded.is_shared })
            setDialog({ mode: 'update', query: loaded })
        } else {
            setForm(BLANK)
            setDialog({ mode: 'new' })
        }
    }

    function openEdit(q) {
        setErrors({})
        setForm({ name: q.name, description: q.description ?? '', is_shared: q.is_shared })
        setDialog({ mode: 'edit', query: q })
    }

    function submit(e, asNew = false) {
        e?.preventDefault()
        setSaving(true)
        const target = asNew ? null : dialog.query
        // Editing details from the list keeps that query's SQL; saving from the
        // editor stores what is in the editor.
        const payload = { ...form, sql: dialog.mode === 'edit' ? dialog.query.sql : query }
        const options = {
            preserveScroll: true,
            onSuccess: () => setDialog(null),
            onError: (errs) => setErrors(errs),
            onFinish: () => setSaving(false),
        }
        target
            ? router.put(route('sql-console.saved.update', target.id), payload, options)
            : router.post(route('sql-console.saved.store'), { ...payload, name: asNew && form.name === dialog.query?.name ? `${form.name} (copy)` : form.name }, options)
    }

    function confirmDelete() {
        setSaving(true)
        router.delete(route('sql-console.saved.destroy', deleting.id), {
            preserveScroll: true,
            onSuccess: () => {
                if (deleting.id === loadedId) setLoadedId(null)
            },
            onFinish: () => {
                setSaving(false)
                setDeleting(null)
            },
        })
    }

    function SavedItem({ q }) {
        const active = q.id === loadedId
        return (
            <li className={`group rounded-lg border px-3 py-2 ${active ? 'border-indigo-300 bg-indigo-50/60 dark:border-indigo-500/40 dark:bg-indigo-500/10' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}>
                <button type="button" onClick={() => runSaved(q)} className="block w-full text-left" title={q.sql}>
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100">
                        <span className="truncate">{q.name}</span>
                        {q.is_shared && <Users className="h-3 w-3 shrink-0 text-gray-400" aria-label="Shared" />}
                    </span>
                    {q.description && <span className="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400">{q.description}</span>}
                    <span className="mt-0.5 block text-[10px] text-gray-400">
                        {!q.mine && q.owner && `${q.owner} · `}
                        {q.run_count ? `Run ${q.run_count}× · last ${since(q.last_run_at)}` : 'Not run yet'}
                    </span>
                </button>
                <div className="mt-1 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button type="button" onClick={() => runSaved(q)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10">
                        <Play className="h-3 w-3" />Run
                    </button>
                    <button type="button" onClick={() => copyLink(q)} title="Copy a link that runs this query" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                        <Link2 className="h-3 w-3" />Link
                    </button>
                    {q.mine && (
                        <>
                            <button type="button" onClick={() => openEdit(q)} aria-label={`Edit ${q.name}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700">
                                <Pencil className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => setDeleting(q)} aria-label={`Delete ${q.name}`} className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </>
                    )}
                </div>
            </li>
        )
    }

    const shownMine = useMemo(() => mine.filter(matches), [mine, filter])  // eslint-disable-line react-hooks/exhaustive-deps
    const shownShared = useMemo(() => shared.filter(matches), [shared, filter])  // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <AuthenticatedLayout>
            <Head title="SQL Console" />

            <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">SQL Console</h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Read-only. Queries run as a database user that can only SELECT, and every query is logged
                            against your account. Save the ones you run often.
                        </p>
                    </div>
                    <Link href={route('custom-reports.index')} className="text-xs text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
                        Back to report builder
                    </Link>
                </div>

                <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
                    {/* Editor */}
                    <div className="space-y-3">
                        {loaded && (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <Bookmark className="h-3.5 w-3.5 text-indigo-500" />
                                <span className="font-semibold text-gray-900 dark:text-white">{loaded.name}</span>
                                {changedSinceLoad && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Edited, not saved</span>}
                                <button type="button" onClick={() => { setLoadedId(null); setQuery('') }} className="text-gray-400 hover:text-gray-700 hover:underline dark:hover:text-gray-200">
                                    Close
                                </button>
                            </div>
                        )}
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run()
                                if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                                    e.preventDefault()
                                    if (query.trim()) openSave()
                                }
                            }}
                            rows={9}
                            spellCheck={false}
                            aria-label="SQL query"
                            placeholder="SELECT pr_number, requester_department, status FROM purchase_requests ORDER BY created_at DESC"
                            className="w-full rounded-xl border-gray-200 font-mono text-sm shadow-sm focus:border-indigo-400 focus:ring-indigo-500/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={run}
                                disabled={running || !query.trim()}
                                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                            >
                                <Play className="h-4 w-4" />
                                {running ? 'Running…' : 'Run query'}
                            </button>
                            <button
                                onClick={openSave}
                                disabled={!query.trim()}
                                className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                <Save className="h-4 w-4" />
                                {loaded?.mine ? 'Save changes…' : 'Save query…'}
                            </button>
                            {rows.length > 0 && (
                                <button
                                    onClick={downloadCsv}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                >
                                    <Download className="h-4 w-4" />
                                    Download CSV
                                </button>
                            )}
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">Ctrl/Cmd + Enter to run · Ctrl/Cmd + S to save</span>
                        </div>
                    </div>

                    {/* Saved queries, then tables */}
                    <aside className="space-y-4">
                        <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                            <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700/60">
                                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                                    <Bookmark className="h-4 w-4" />
                                    Saved queries
                                </h2>
                                <span className="text-[11px] text-gray-400">{savedQueries.length}</span>
                            </header>
                            <div className="p-2">
                                {savedQueries.length > 5 && (
                                    <div className="relative mb-2">
                                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="search"
                                            value={filter}
                                            onChange={(e) => setFilter(e.target.value)}
                                            placeholder="Find a saved query…"
                                            aria-label="Find a saved query"
                                            className="w-full rounded-lg border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2 text-xs dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200"
                                        />
                                    </div>
                                )}
                                {savedQueries.length === 0 ? (
                                    <p className="px-2 py-6 text-center text-[11px] text-gray-500 dark:text-gray-400">
                                        Nothing saved yet. Write a query, then <span className="font-semibold">Save query</span> to keep it here.
                                    </p>
                                ) : (
                                    <div className="max-h-80 space-y-3 overflow-y-auto">
                                        {shownMine.length > 0 && (
                                            <div>
                                                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Mine</p>
                                                <ul className="space-y-1">{shownMine.map((q) => <SavedItem key={q.id} q={q} />)}</ul>
                                            </div>
                                        )}
                                        {shownShared.length > 0 && (
                                            <div>
                                                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Shared with you</p>
                                                <ul className="space-y-1">{shownShared.map((q) => <SavedItem key={q.id} q={q} />)}</ul>
                                            </div>
                                        )}
                                        {shownMine.length + shownShared.length === 0 && (
                                            <p className="px-2 py-4 text-center text-[11px] text-gray-500">No saved query matches.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                            <header className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 dark:border-gray-700/60 dark:text-white">
                                <Table2 className="h-4 w-4" />
                                Tables
                            </header>
                            <ul className="max-h-56 space-y-0.5 overflow-y-auto p-2">
                                {tables.map((t) => (
                                    <li key={t}>
                                        <button
                                            onClick={() => {
                                                setLoadedId(null)
                                                setQuery(`SELECT * FROM ${t}`)
                                            }}
                                            className="w-full truncate rounded px-2 py-1 text-left font-mono text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/30 dark:hover:text-gray-100"
                                        >
                                            {t}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </aside>
                </div>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">Query not run</p>
                        <p className="mt-1 font-mono text-sm text-red-700 dark:text-red-400">{error}</p>
                    </div>
                )}

                {!error && headers.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            {rowCount.toLocaleString()} {rowCount === 1 ? 'row' : 'rows'}
                            {elapsedMs !== null && ` in ${elapsedMs} ms`}
                            {truncated && ` — capped at ${rowLimit.toLocaleString()}, download the CSV for the rest`}
                        </p>

                        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        {headers.map((h) => (
                                            <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-mono text-xs font-medium text-gray-600 dark:text-gray-400">
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">The query ran and returned no rows.</p>
                )}
            </div>

            {/* Save / update / edit details */}
            <Modal show={dialog !== null} onClose={() => !saving && setDialog(null)} maxWidth="lg">
                <form onSubmit={submit} className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {dialog?.mode === 'new' ? 'Save this query' : dialog?.mode === 'update' ? `Save changes to “${dialog.query.name}”` : `Edit “${dialog?.query?.name}”`}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {dialog?.mode === 'edit'
                            ? 'Change its name, description or who can see it. To change the SQL, open it in the editor and save there.'
                            : 'The query is checked by the same rules as running it before it is saved.'}
                    </p>

                    <div className="mt-5 space-y-4">
                        <div>
                            <label htmlFor="sq-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                            <input id="sq-name" type="text" required autoFocus maxLength={120} value={form.name}
                                   onChange={(e) => setForm({ ...form, name: e.target.value })}
                                   placeholder="e.g. Purchase orders this month" className={inputClass} />
                            <InputError message={errors.name} className="mt-1" />
                        </div>
                        <div>
                            <label htmlFor="sq-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Description <span className="font-normal text-gray-400">(optional)</span>
                            </label>
                            <input id="sq-description" type="text" maxLength={255} value={form.description}
                                   onChange={(e) => setForm({ ...form, description: e.target.value })}
                                   placeholder="What it answers, who asked for it" className={inputClass} />
                            <InputError message={errors.description} className="mt-1" />
                        </div>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
                            <input type="checkbox" checked={form.is_shared} onChange={(e) => setForm({ ...form, is_shared: e.target.checked })}
                                   className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900" />
                            <span>
                                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">Share with others who use the SQL console</span>
                                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">They can run it and copy it. Only you can change or delete it.</span>
                            </span>
                        </label>
                        {dialog?.mode !== 'edit' && (
                            <pre className="max-h-32 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-[11px] text-gray-700 dark:bg-gray-900/60 dark:text-gray-300">{query}</pre>
                        )}
                        <InputError message={errors.sql} />
                    </div>

                    <div className="mt-6 flex flex-wrap justify-end gap-3">
                        <button type="button" onClick={() => setDialog(null)} disabled={saving}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        {dialog?.mode === 'update' && (
                            <button type="button" onClick={(e) => submit(e, true)} disabled={saving || !form.name.trim()}
                                    className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10">
                                Save as a new query
                            </button>
                        )}
                        <button type="submit" disabled={saving || !form.name.trim()}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                            {saving ? 'Saving…' : dialog?.mode === 'new' ? 'Save query' : 'Save changes'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete */}
            <Modal show={deleting !== null} onClose={() => !saving && setDeleting(null)} maxWidth="md">
                <div className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete “{deleting?.name}”?</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {deleting?.is_shared ? 'It is shared, so it also disappears for everyone it was shared with. ' : ''}
                        Links to it stop working. This cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => setDeleting(null)} disabled={saving}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                            Keep it
                        </button>
                        <button type="button" onClick={confirmDelete} disabled={saving}
                                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">
                            {saving ? 'Deleting…' : 'Delete query'}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    )
}

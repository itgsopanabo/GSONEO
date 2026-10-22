// resources/js/Pages/Offices/Index.jsx
import { useMemo, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { Archive, Building2, FileText, FolderArchive, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx';
import Modal from '@/Components/Modal';
import InputError from '@/Components/InputError';

const BLANK = { name: '', code: '', description: '' };

const FILTERS = [
    { key: 'active', label: 'Active' },
    { key: 'retired', label: 'Retired' },
    { key: 'all', label: 'All' },
];

const inputClass = 'mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

function Stat({ icon: Icon, label, value, hint }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{Number(value ?? 0).toLocaleString()}</p>
            {hint && <p className="truncate text-[11px] text-gray-400">{hint}</p>}
        </div>
    );
}

const usedTimes = (office) => office.requests + office.records + office.releases;

/**
 * The offices every form offers — purchase requests, encoding, records and
 * releases. Used offices are retired, never deleted, and a rename is carried
 * onto everything filed under the old name.
 */
export default function Index({ offices = [] }) {
    const [editing, setEditing] = useState(null);   // null | {} (new) | office
    const [deleting, setDeleting] = useState(null);
    const [filter, setFilter] = useState('active');
    const [search, setSearch] = useState('');

    const { data, setData, post, put, delete: destroy, processing, errors, reset, clearErrors } = useForm(BLANK);
    const isEditing = Boolean(editing?.id);
    const renaming = isEditing && data.name.trim() !== editing.name && usedTimes(editing) > 0;

    const counts = useMemo(() => ({
        active: offices.filter((o) => o.is_active).length,
        retired: offices.filter((o) => !o.is_active).length,
        all: offices.length,
    }), [offices]);

    const totals = useMemo(() => ({
        requests: offices.reduce((sum, o) => sum + o.requests, 0),
        records: offices.reduce((sum, o) => sum + o.records, 0),
    }), [offices]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return offices
            .filter((o) => filter === 'all' || (filter === 'active' ? o.is_active : !o.is_active))
            .filter((o) => !q || `${o.name} ${o.code} ${o.description ?? ''}`.toLowerCase().includes(q));
    }, [offices, filter, search]);

    const openCreate = () => {
        clearErrors();
        setData(BLANK);
        setEditing({});
    };

    const openEdit = (office) => {
        clearErrors();
        setData({ name: office.name, code: office.code, description: office.description ?? '' });
        setEditing(office);
    };

    const close = () => {
        setEditing(null);
        setTimeout(() => {
            reset();
            clearErrors();
        }, 250);
    };

    const save = (e) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => close() };
        isEditing ? put(route('offices.update', editing.id), options) : post(route('offices.store'), options);
    };

    const toggle = (office) => {
        router.patch(route(`offices.${office.is_active ? 'deactivate' : 'reactivate'}`, office.id), {}, { preserveScroll: true });
    };

    const confirmDelete = () => {
        destroy(route('offices.destroy', deleting.id), { preserveScroll: true, onFinish: () => setDeleting(null) });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Requesting Offices" />

            <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Requesting Offices</h1>
                        <p className="mt-1 max-w-3xl text-xs text-gray-500 dark:text-gray-400">
                            The offices purchase requests and records are filed under. Every form offers the active ones;
                            renaming an office updates everything already filed under it.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 self-start rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:self-auto"
                    >
                        <Plus className="h-4 w-4" />
                        Add an office
                    </button>
                </div>

                {/* At a glance */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Stat icon={Building2} label="Active offices" value={counts.active} hint="Offered in every form" />
                    <Stat icon={Archive} label="Retired" value={counts.retired} hint="Kept on old entries" />
                    <Stat icon={FileText} label="Purchase requests" value={totals.requests} hint="Filed under these offices" />
                    <Stat icon={FolderArchive} label="Records" value={totals.records} hint="Originating from these offices" />
                </div>

                {/* Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div role="tablist" className="inline-flex self-start rounded-lg border border-gray-200 bg-white p-0.5 text-xs dark:border-gray-700 dark:bg-gray-800">
                        {FILTERS.map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                role="tab"
                                aria-selected={filter === f.key}
                                onClick={() => setFilter(f.key)}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium ${filter === f.key ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900/40'}`}
                            >
                                {f.label}
                                <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${filter === f.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>{counts[f.key]}</span>
                            </button>
                        ))}
                    </div>
                    <div className="relative sm:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name or code…"
                            aria-label="Search offices"
                            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        />
                    </div>
                </div>

                {/* Offices */}
                <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900/30">
                                <tr className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                    <th className="px-5 py-2.5">Office</th>
                                    <th className="px-4 py-2.5">Code</th>
                                    <th className="px-4 py-2.5 text-right">Requests</th>
                                    <th className="hidden px-4 py-2.5 text-right sm:table-cell">Records</th>
                                    <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                                {shown.map((office) => (
                                    <tr key={office.id} className={`hover:bg-gray-50/60 dark:hover:bg-gray-900/20 ${office.is_active ? '' : 'opacity-60'}`}>
                                        <td className="px-5 py-3">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {office.name}
                                                {!office.is_active && (
                                                    <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">Retired</span>
                                                )}
                                            </p>
                                            {office.description && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{office.description}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">{office.code}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-xs tabular-nums text-gray-700 dark:text-gray-300">{office.requests}</td>
                                        <td className="hidden px-4 py-3 text-right text-xs tabular-nums text-gray-700 sm:table-cell dark:text-gray-300">{office.records}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <button type="button" onClick={() => openEdit(office)} title="Edit" aria-label={`Edit ${office.name}`}
                                                        className="rounded-lg p-1.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400">
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button type="button" onClick={() => toggle(office)}
                                                        title={office.is_active ? 'Retire — stop offering it' : 'Restore — offer it again'}
                                                        aria-label={`${office.is_active ? 'Retire' : 'Restore'} ${office.name}`}
                                                        className="rounded-lg p-1.5 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400">
                                                    {office.is_active ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                                                </button>
                                                {usedTimes(office) === 0 && (
                                                    <button type="button" onClick={() => setDeleting(office)} title="Delete — never used" aria-label={`Delete ${office.name}`}
                                                            className="rounded-lg p-1.5 text-gray-500 hover:bg-rose-50 hover:text-rose-600 dark:text-gray-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {shown.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-16 text-center">
                                            <Building2 className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {offices.length === 0 ? 'No offices yet' : 'No offices match'}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {offices.length === 0 ? 'Add the offices that file purchase requests and records.' : 'Try another filter or search.'}
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Retiring an office stops it being offered; requests and records already filed under it keep it.
                    Delete is offered only for offices nothing has used.
                </p>
            </div>

            {/* Add / edit */}
            <Modal show={editing !== null} onClose={close} maxWidth="lg">
                <form onSubmit={save} className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{isEditing ? 'Edit office' : 'Add an office'}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {isEditing ? editing.name : 'It is offered in every form as soon as it is saved.'}
                    </p>

                    <div className="mt-5 space-y-4">
                        <div>
                            <label htmlFor="office-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                            <input id="office-name" type="text" required autoFocus maxLength={255} value={data.name}
                                   onChange={(e) => setData('name', e.target.value)}
                                   placeholder="e.g. City Agriculture Office" className={inputClass} />
                            <InputError message={errors.name} className="mt-1" />
                        </div>
                        <div>
                            <label htmlFor="office-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Code <span className="font-normal text-gray-400">— printed on the SSMI, e.g. CAGRO-MOOE</span>
                            </label>
                            <input id="office-code" type="text" required maxLength={20} value={data.code}
                                   onChange={(e) => setData('code', e.target.value.toUpperCase())}
                                   placeholder="e.g. CAGRO" className={`${inputClass} font-mono uppercase`} />
                            <InputError message={errors.code} className="mt-1" />
                        </div>
                        <div>
                            <label htmlFor="office-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Description <span className="font-normal text-gray-400">(optional)</span>
                            </label>
                            <input id="office-description" type="text" maxLength={255} value={data.description}
                                   onChange={(e) => setData('description', e.target.value)} className={inputClass} />
                            <InputError message={errors.description} className="mt-1" />
                        </div>

                        {renaming && (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                Renaming also updates the {editing.requests} {editing.requests === 1 ? 'request' : 'requests'}
                                {editing.records ? `, ${editing.records} ${editing.records === 1 ? 'record' : 'records'}` : ''}
                                {editing.releases ? ` and ${editing.releases} ${editing.releases === 1 ? 'release' : 'releases'}` : ''} filed
                                under “{editing.name}”, so filters, charts and SSMI codes keep finding them.
                            </p>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={close}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="submit" disabled={processing || !data.name.trim() || !data.code.trim()}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                            {processing ? 'Saving…' : isEditing ? 'Save changes' : 'Add office'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete */}
            <Modal show={deleting !== null} onClose={() => setDeleting(null)} maxWidth="md">
                <div className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete {deleting?.name}?</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        No request, record or release uses it, so nothing loses its office. This cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => setDeleting(null)}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                            Keep it
                        </button>
                        <button type="button" onClick={confirmDelete} disabled={processing}
                                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">
                            {processing ? 'Deleting…' : 'Delete office'}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

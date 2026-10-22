// resources/js/Pages/TrackerTags/Index.jsx
import {useMemo, useState} from 'react';
import {Head, Link, router, useForm, usePage} from '@inertiajs/react';
import {Archive, Bell, CircleAlert, Lock, Pencil, Plus, RotateCcw, Search, Tag, Trash2} from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx';
import Modal from '@/Components/Modal';
import InputError from '@/Components/InputError';
import {TAG_COLORS, TagChip} from '@/Components/MissingTags.jsx';
import {formatDate} from '@/Utils/formatDate.js';

// New tags hold the order by default; switch off for reminder-only tags.
const BLANK = {name: '', description: '', color: 'amber', holds_order: true};

const COLOR_LABELS = {
    amber: 'Amber', rose: 'Rose', sky: 'Sky', violet: 'Violet', emerald: 'Emerald', slate: 'Slate',
};

// The solid dot shown in the colour picker.
const SWATCHES = {
    amber: 'bg-amber-400', rose: 'bg-rose-400', sky: 'bg-sky-400', violet: 'bg-violet-400', emerald: 'bg-emerald-400', slate: 'bg-slate-400',
};

const FILTERS = [
    {key: 'active', label: 'Active'},
    {key: 'retired', label: 'Retired'},
    {key: 'all', label: 'All'},
];

/** Anyone who can open the Missing Tracker gets a link from each tag to its open items. */
const TRACKER_PERMISSIONS = ['inventory.incoming', 'inventory.iar', 'inventory.ris', 'inventory.ssmi', 'inventory.outgoing'];

function Stat({icon: Icon, label, value, hint}) {
    return (
        <div className="rounded-xl border border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800 shadow-sm px-4 py-3">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                <Icon className="w-3.5 h-3.5"/>
                {label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">{value}</p>
            {hint && <p className="text-[11px] text-gray-400 truncate">{hint}</p>}
        </div>
    );
}

function EffectPill({holds}) {
    return holds ? (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <Lock className="w-3 h-3"/>
            Holds the order
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700/60 dark:text-gray-300">
            <Bell className="w-3 h-3"/>
            Reminder only
        </span>
    );
}

/**
 * The list of things an order can be marked as missing on the inventory pages.
 * Same rules as Record Classes: used tags are retired, never deleted.
 */
export default function Index({tags, colors}) {
    const {auth} = usePage().props;
    const canOpenTracker = TRACKER_PERMISSIONS.some((name) => (auth?.permissions ?? []).includes(name));

    const [editing, setEditing] = useState(null);    // null = closed, {} = new, tag = edit
    const [deleting, setDeleting] = useState(null);
    const [filter, setFilter] = useState('active');
    const [search, setSearch] = useState('');

    const {data, setData, post, put, delete: destroy, processing, errors, reset, clearErrors} = useForm(BLANK);
    const isEditing = Boolean(editing?.id);

    const counts = useMemo(() => ({
        active: tags.filter((tag) => tag.is_active).length,
        retired: tags.filter((tag) => !tag.is_active).length,
        all: tags.length,
    }), [tags]);

    const stats = useMemo(() => {
        const active = tags.filter((tag) => tag.is_active);
        return {
            holding: active.filter((tag) => tag.holds_order).length,
            reminders: active.filter((tag) => !tag.holds_order).length,
            open: tags.reduce((sum, tag) => sum + Number(tag.open_count ?? 0), 0),
        };
    }, [tags]);

    const shown = useMemo(() => {
        const q = search.trim().toLowerCase();
        return tags
            .filter((tag) => filter === 'all' || (filter === 'active' ? tag.is_active : !tag.is_active))
            .filter((tag) => !q || `${tag.name} ${tag.description ?? ''}`.toLowerCase().includes(q));
    }, [tags, filter, search]);

    const openCreate = () => {
        clearErrors();
        setData(BLANK);
        setEditing({});
    };

    const openEdit = (tag) => {
        clearErrors();
        setData({name: tag.name ?? '', description: tag.description ?? '', color: tag.color ?? 'amber', holds_order: !!tag.holds_order});
        setEditing(tag);
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
        const options = {preserveScroll: true, onSuccess: () => close()};
        isEditing
            ? put(route('tracker-tags.update', editing.id), options)
            : post(route('tracker-tags.store'), options);
    };

    const confirmDelete = () => {
        destroy(route('tracker-tags.destroy', deleting.id), {
            preserveScroll: true,
            onFinish: () => setDeleting(null),
        });
    };

    const toggle = (tag) => {
        const action = tag.is_active ? 'deactivate' : 'reactivate';
        router.patch(route(`tracker-tags.${action}`, tag.id), {}, {preserveScroll: true});
    };

    return (
        <AuthenticatedLayout>
            <Head title="Tracker Tags"/>

            <div className="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">Tracker Tags</h1>
                        <p className="mt-1 max-w-3xl text-xs text-gray-500 dark:text-gray-400">
                            What staff can mark an order as missing on the inventory pages, such as a signature or an
                            invoice. A tag that holds the order stops it moving to its next stage until resolved; a
                            reminder does not. Open tags are listed on the Missing Tracker.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                    >
                        <Plus className="w-4 h-4"/>
                        Add a tag
                    </button>
                </div>

                {/* At a glance */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <Stat icon={Tag} label="Active tags" value={counts.active} hint={counts.retired ? `${counts.retired} retired` : 'None retired'}/>
                    <Stat icon={Lock} label="Hold the order" value={stats.holding} hint="Block the next stage"/>
                    <Stat icon={Bell} label="Reminders" value={stats.reminders} hint="Shown, but do not block"/>
                    <Stat icon={CircleAlert} label="Open on orders" value={stats.open} hint="Across every tag"/>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 text-xs self-start" role="tablist">
                        {FILTERS.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                role="tab"
                                aria-selected={filter === option.key}
                                onClick={() => setFilter(option.key)}
                                className={`px-3 py-1.5 rounded-md font-medium inline-flex items-center gap-1.5 ${filter === option.key ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/40'}`}
                            >
                                {option.label}
                                <span className={`tabular-nums rounded-full px-1.5 text-[10px] ${filter === option.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
                                    {counts[option.key]}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="relative sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"/>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search tags…"
                            aria-label="Search tags"
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
                        />
                    </div>
                </div>

                {/* Tags */}
                {shown.length > 0 ? (
                    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {shown.map((tag) => (
                            <li
                                key={tag.id}
                                className={`flex flex-col rounded-xl border bg-white dark:bg-gray-800 shadow-sm ${tag.is_active ? 'border-gray-100 dark:border-gray-700/60' : 'border-dashed border-gray-300 dark:border-gray-600'}`}
                            >
                                <div className="flex-1 p-5">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <TagChip tag={tag} className={tag.is_active ? '' : 'opacity-60'}/>
                                        {tag.is_active ? <EffectPill holds={tag.holds_order}/> : (
                                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-700/60 dark:text-gray-400">
                                                <Archive className="w-3 h-3"/>
                                                Retired
                                            </span>
                                        )}
                                    </div>
                                    <p className={`mt-3 text-xs ${tag.description ? 'text-gray-600 dark:text-gray-300' : 'italic text-gray-400'}`}>
                                        {tag.description || 'No description. Staff see this when they choose the tag.'}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-700/60 px-5 py-3">
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {canOpenTracker && tag.open_count > 0 ? (
                                            <Link
                                                href={route('missing-tracker.index', {tag: tag.id})}
                                                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                            >
                                                {tag.open_count} open
                                            </Link>
                                        ) : (
                                            <span className={tag.open_count > 0 ? 'font-semibold text-gray-700 dark:text-gray-200' : ''}>
                                                {tag.open_count} open
                                            </span>
                                        )}
                                        {' · '}{tag.uses_count} ever
                                        {tag.last_used_at && <> · last used {formatDate(tag.last_used_at)}</>}
                                        {!tag.last_used_at && ' · never used'}
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(tag)}
                                            title="Edit"
                                            aria-label={`Edit ${tag.name}`}
                                            className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-500/10"
                                        >
                                            <Pencil className="w-4 h-4"/>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggle(tag)}
                                            title={tag.is_active ? 'Retire — stop offering it' : 'Restore — offer it again'}
                                            aria-label={`${tag.is_active ? 'Retire' : 'Restore'} ${tag.name}`}
                                            className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-gray-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-500/10"
                                        >
                                            {tag.is_active ? <Archive className="w-4 h-4"/> : <RotateCcw className="w-4 h-4"/>}
                                        </button>
                                        {tag.uses_count === 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setDeleting(tag)}
                                                title="Delete — never used"
                                                aria-label={`Delete ${tag.name}`}
                                                className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:text-gray-400 dark:hover:text-rose-400 dark:hover:bg-rose-500/10"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-6 py-16 text-center">
                        <Tag className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-3"/>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {tags.length === 0 ? 'No tracker tags yet' : search ? 'No tags match your search' : filter === 'retired' ? 'No retired tags' : 'No active tags'}
                        </p>
                        <p className="mx-auto mt-1 max-w-md text-xs text-gray-500 dark:text-gray-400">
                            {tags.length === 0
                                ? 'Add one for each thing an order can be held up by, such as a missing signature.'
                                : 'Try another filter or search.'}
                        </p>
                        {tags.length === 0 && (
                            <button
                                type="button"
                                onClick={openCreate}
                                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                            >
                                <Plus className="w-4 h-4"/>
                                Add the first tag
                            </button>
                        )}
                    </div>
                )}

                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Retiring a tag stops it being offered; orders that already have it keep it. Delete is offered only
                    for tags that have never been used.
                </p>
            </div>

            {/* Add / edit */}
            <Modal show={editing !== null} onClose={close} maxWidth="2xl">
                <form onSubmit={save} className="bg-white dark:bg-gray-800">
                    <div className="border-b border-gray-100 dark:border-gray-700 px-6 py-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {isEditing ? 'Edit tag' : 'Add a tag'}
                        </h2>
                        {isEditing && editing.uses_count > 0 && (
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                Renaming changes it on the {editing.uses_count} {editing.uses_count === 1 ? 'order' : 'orders'} that
                                have used it, including resolved ones.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6 px-6 py-5">
                        {/* Fields */}
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="tag-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Name
                                </label>
                                <input
                                    id="tag-name"
                                    type="text"
                                    required
                                    maxLength={60}
                                    autoFocus
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="e.g. Missing signature"
                                    className="mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                />
                                <InputError message={errors.name} className="mt-1"/>
                            </div>

                            <div>
                                <label htmlFor="tag-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Description <span className="font-normal text-gray-400">(optional)</span>
                                </label>
                                <textarea
                                    id="tag-description"
                                    rows={2}
                                    maxLength={255}
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                    placeholder="Shown to staff when they choose this tag"
                                    className="mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                                />
                                <InputError message={errors.description} className="mt-1"/>
                            </div>

                            <fieldset>
                                <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300">Colour</legend>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {colors.map((color) => (
                                        <label
                                            key={color}
                                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${data.color === color
                                                ? 'border-indigo-500 ring-2 ring-indigo-500/30 text-gray-900 dark:text-white'
                                                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900/40'}`}
                                        >
                                            <input
                                                type="radio"
                                                name="color"
                                                value={color}
                                                checked={data.color === color}
                                                onChange={() => setData('color', color)}
                                                className="sr-only"
                                            />
                                            <span className={`h-3 w-3 rounded-full ${SWATCHES[color] ?? 'bg-gray-400'}`} aria-hidden="true"/>
                                            {COLOR_LABELS[color] ?? color}
                                        </label>
                                    ))}
                                </div>
                                <InputError message={errors.color} className="mt-1"/>
                            </fieldset>

                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
                                <div className="flex items-start justify-between gap-4">
                                    <span>
                                        <span id="holds-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Holds the order</span>
                                        <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                            {data.holds_order
                                                ? 'While this tag is open, the order cannot move to its next stage.'
                                                : 'A reminder only. The order moves on as normal while this tag is open.'}
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={data.holds_order}
                                        aria-labelledby="holds-label"
                                        onClick={() => setData('holds_order', !data.holds_order)}
                                        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${data.holds_order ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                        <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${data.holds_order ? 'translate-x-[22px]' : 'translate-x-0.5'}`}/>
                                    </button>
                                </div>
                                {isEditing && editing.open_count > 0 && editing.holds_order !== data.holds_order && (
                                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-400">
                                        {data.holds_order
                                            ? `The ${editing.open_count} ${editing.open_count === 1 ? 'order' : 'orders'} with this tag open will be held as soon as you save.`
                                            : `The ${editing.open_count} ${editing.open_count === 1 ? 'order' : 'orders'} held by this tag will be free to move on as soon as you save.`}
                                    </p>
                                )}
                                <InputError message={errors.holds_order} className="mt-1"/>
                            </div>
                        </div>

                        {/* Preview: the tag as staff will see it on an order */}
                        <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">On an order</p>
                            <div className="mt-2 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden">
                                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-gray-700/40 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Missing
                                </div>
                                <div className="px-4 py-3 space-y-1.5">
                                    <TagChip tag={{name: data.name || 'Tag name', color: data.color, holds_order: data.holds_order}}/>
                                    {data.description && (
                                        <p className="text-[11px] text-gray-600 dark:text-gray-300">{data.description}</p>
                                    )}
                                    <p className="text-[11px] text-gray-400">Tagged today by you</p>
                                </div>
                            </div>
                            <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                                {data.holds_order
                                    ? 'The order’s next action stays locked until this is resolved.'
                                    : 'The order’s next action stays available.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4">
                        <button
                            type="button"
                            onClick={close}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || !data.name.trim()}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            {processing ? 'Saving…' : isEditing ? 'Save changes' : 'Add tag'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete */}
            <Modal show={deleting !== null} onClose={() => setDeleting(null)} maxWidth="md">
                <div className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete this tag?</h2>
                    <div className="mt-3"><TagChip tag={deleting}/></div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                        It has never been used on an order, so nothing loses its history. This cannot be undone.
                    </p>
                    <div className="mt-6 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setDeleting(null)}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            Keep it
                        </button>
                        <button
                            type="button"
                            onClick={confirmDelete}
                            disabled={processing}
                            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                        >
                            {processing ? 'Deleting…' : 'Delete tag'}
                        </button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}

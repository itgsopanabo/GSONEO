import {useState} from 'react';
import {Link, router, usePage} from '@inertiajs/react';
import {Bell, CircleAlert, Check, Lock} from 'lucide-react';
import Modal from '@/Components/Modal';
import {formatDate} from '@/Utils/formatDate.js';

/**
 * The missing tracker, as it appears on the inventory pages.
 *
 * Tags themselves are kept on the Tracker Tags screen; the active ones arrive
 * as the shared `trackerTags` prop. Each order carries its open tags as
 * `open_tags` (loaded as `openTags.tag` by the inventory controllers).
 */

// Keys match App\Models\TrackerTag::COLORS.
export const TAG_COLORS = {
    amber: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30',
    rose: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30',
    sky: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30',
    violet: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30',
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30',
    slate: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-600',
};

export function openTagsOf(order) {
    return order?.open_tags ?? order?.openTags ?? [];
}

/** Whether a tag stops its order moving on. Older payloads without the field hold. */
export function tagHolds(tag) {
    return tag?.holds_order !== false && tag?.holds_order !== 0;
}

/** The open tags that hold the order, leaving out reminder-only ones. */
export function holdingTagsOf(order) {
    return openTagsOf(order).filter((entry) => tagHolds(entry.tag));
}

/**
 * An open tag set to hold the order keeps it at its stage: the pages disable
 * their forward action while this is true, and the server refuses it
 * (PurchaseOrder::missingBlocker). Reminder-only tags do not count.
 */
export function isHeldByTags(order) {
    return holdingTagsOf(order).length > 0;
}

/** Shown beside a disabled action: what has to be resolved before it unlocks. */
export function HeldNotice({order, className = ''}) {
    const tags = holdingTagsOf(order);
    if (tags.length === 0) return null;
    const names = [...new Set(tags.map((entry) => entry.tag?.name).filter(Boolean))];
    return (
        <p className={`inline-flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 ${className}`}>
            <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px"/>
            <span>
                Resolve {names.length === 1 ? 'the missing item' : 'the missing items'} first: {names.join(', ')}.
            </span>
        </p>
    );
}

export function personName(user) {
    if (!user) return null;
    return [user.emp_fname, user.emp_lname].filter(Boolean).join(' ') || null;
}

/** A lock marks a tag that holds the order; a bell, one that is only a reminder. */
export function TagChip({tag, className = ''}) {
    if (!tag) return null;
    const holds = tagHolds(tag);
    const Icon = holds ? Lock : Bell;
    return (
        <span
            title={holds ? 'Holds the order until resolved' : 'Reminder only — does not hold the order'}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${TAG_COLORS[tag.color] ?? TAG_COLORS.slate} ${className}`}>
            <Icon className="w-3 h-3"/>
            {tag.name}
        </span>
    );
}

/** Compact chips for a queue row: what the order is missing, at a glance. */
export function OrderTagBadges({order}) {
    const tags = openTagsOf(order);
    if (tags.length === 0) return null;
    return (
        <span className="inline-flex flex-wrap gap-1">
            {tags.map((entry) => <TagChip key={entry.id} tag={entry.tag}/>)}
        </span>
    );
}

const inputClass = 'w-full text-xs rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 shadow-sm focus:border-amber-500 focus:ring-amber-500';

/**
 * "Tag as missing", with the dialog it opens. Self-contained, so it can sit
 * where people look first — the top of an order's detail panel — as well as
 * in the Missing card. `size` is 'md' for the header, 'sm' for the card.
 *
 * Tags already open on the order are not offered again; when nothing is left
 * to offer, the button stays visible but disabled, saying why.
 */
export function TagMissingButton({order, size = 'md', className = ''}) {
    const {trackerTags = []} = usePage().props;
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({tracker_tag_id: '', note: ''});
    const [processing, setProcessing] = useState(false);

    if (!order?.id) return null;

    const openIds = new Set(openTagsOf(order).map((entry) => entry.tracker_tag_id));
    const offered = trackerTags.filter((tag) => !openIds.has(tag.id));
    const why = trackerTags.length === 0
        ? 'No tags are set up yet. An administrator adds them on the Tracker Tags screen.'
        : offered.length === 0 ? 'Every tag is already on this order.' : undefined;

    function start() {
        setForm({tracker_tag_id: offered.length === 1 ? String(offered[0].id) : '', note: ''});
        setOpen(true);
    }

    function submit(e) {
        e.preventDefault();
        setProcessing(true);
        router.post(route('missing-tracker.store', order.id), form, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setOpen(false),
            onFinish: () => setProcessing(false),
        });
    }

    const buttonClass = size === 'sm'
        ? 'gap-1 px-2.5 py-1 text-[11px]'
        : 'gap-1.5 px-3.5 py-1.5 text-xs';

    return (
        <>
            <button
                type="button"
                onClick={start}
                disabled={Boolean(why)}
                title={why}
                className={`inline-flex shrink-0 items-center rounded-full font-semibold text-white bg-amber-500 hover:bg-amber-600 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none dark:disabled:bg-gray-700 ${buttonClass} ${className}`}
            >
                <CircleAlert className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'}/>
                Tag as missing
            </button>

            <Modal show={open} onClose={() => !processing && setOpen(false)} maxWidth="lg">
                <form onSubmit={submit} className="bg-white dark:bg-gray-800 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        What is {order.PO_Number ?? 'this order'} missing?
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Tags with a <Lock className="inline w-3.5 h-3.5 -mt-0.5"/> hold the order at its stage until
                        resolved; tags with a <Bell className="inline w-3.5 h-3.5 -mt-0.5"/> are reminders.
                    </p>

                    <fieldset className="mt-4">
                        <legend className="sr-only">What is missing</legend>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {offered.map((tag) => {
                                const chosen = String(form.tracker_tag_id) === String(tag.id);
                                const Icon = tagHolds(tag) ? Lock : Bell;
                                return (
                                    <label
                                        key={tag.id}
                                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${chosen
                                            ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20 dark:border-amber-500/60 dark:bg-amber-500/10'
                                            : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/40'}`}
                                    >
                                        <input
                                            type="radio"
                                            name="tracker_tag_id"
                                            value={tag.id}
                                            checked={chosen}
                                            onChange={() => setForm({...form, tracker_tag_id: String(tag.id)})}
                                            className="mt-0.5 text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="min-w-0">
                                            <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
                                                {tag.name}
                                                <Icon className="w-3.5 h-3.5 text-gray-400"/>
                                            </span>
                                            {tag.description && (
                                                <span className="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">{tag.description}</span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    <label className="mt-4 block">
                        <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Note <span className="font-normal text-gray-400">(optional)</span>
                        </span>
                        <input
                            type="text"
                            maxLength={1000}
                            value={form.note}
                            onChange={(e) => setForm({...form, note: e.target.value})}
                            placeholder="e.g. Inspector's signature on the IAR"
                            className={`${inputClass} text-sm`}
                        />
                    </label>

                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            disabled={processing}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || !form.tracker_tag_id}
                            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                            {processing ? 'Tagging…' : 'Tag order'}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}

/**
 * The "Missing" card for an order's detail panel: its open tags, each with a
 * Resolve action, and the Tag as missing button.
 */
export function MissingTagsPanel({order}) {
    const {trackerTags = []} = usePage().props;
    const tags = openTagsOf(order);

    const [resolving, setResolving] = useState(null);   // id of the entry being resolved
    const [resolutionNote, setResolutionNote] = useState('');
    const [processing, setProcessing] = useState(false);

    if (!order?.id) return null;

    function submitResolve(entry) {
        setProcessing(true);
        router.patch(route('missing-tracker.resolve', entry.id), {resolution_note: resolutionNote}, {
            preserveScroll: true,
            onSuccess: () => {
                setResolving(null);
                setResolutionNote('');
            },
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <div className="border border-gray-100 dark:border-gray-700/40 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/40 flex items-center justify-between bg-gray-50 dark:bg-gray-900/30">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Missing
                </p>
                <div className="flex items-center gap-3">
                    <Link href={route('missing-tracker.index')} className="text-[11px] text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                        Missing Tracker
                    </Link>
                    <TagMissingButton order={order} size="sm"/>
                </div>
            </div>

            {isHeldByTags(order) && (
                <p className="px-5 pt-3 text-[11px] text-amber-800 dark:text-amber-300">
                    This order is on hold at its current stage until the tags marked with a lock are resolved.
                </p>
            )}
            {tags.length === 0 ? (
                <p className="px-5 py-4 text-xs text-gray-500 dark:text-gray-400">
                    Nothing is marked as missing on this order.
                    {trackerTags.length === 0
                        ? ' No tags are set up yet — an administrator adds them on the Tracker Tags screen.'
                        : ' If a signature, invoice or document is missing, use Tag as missing.'}
                </p>
            ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/40">
                    {tags.map((entry) => (
                        <div key={entry.id} className="px-5 py-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <TagChip tag={entry.tag}/>
                                    {entry.note && (
                                        <p className="mt-1.5 text-xs text-gray-700 dark:text-gray-300">{entry.note}</p>
                                    )}
                                    <p className="mt-1 text-[11px] text-gray-400">
                                        Tagged {formatDate(entry.created_at)}
                                        {personName(entry.tagged_by) && ` by ${personName(entry.tagged_by)}`}
                                    </p>
                                </div>
                                {resolving !== entry.id && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setResolving(entry.id);
                                            setResolutionNote('');
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                    >
                                        <Check className="w-3 h-3"/>
                                        Resolve
                                    </button>
                                )}
                            </div>
                            {resolving === entry.id && (
                                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        autoFocus
                                        maxLength={1000}
                                        value={resolutionNote}
                                        onChange={(e) => setResolutionNote(e.target.value)}
                                        placeholder="How was it resolved? (optional)"
                                        className={inputClass}
                                    />
                                    <div className="flex gap-2 shrink-0">
                                        <button type="button" onClick={() => setResolving(null)} disabled={processing}
                                                className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={() => submitResolve(entry)} disabled={processing}
                                                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50">
                                            {processing ? 'Saving…' : 'Mark resolved'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

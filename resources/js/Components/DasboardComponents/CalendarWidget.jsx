import { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '@/Components/Modal';
import InputError from '@/Components/InputError';
import DashboardCard from './DashboardCard';

/* ------------------------------------------------------------------ *
 * Dates — kept as local "YYYY-MM-DD" strings so nothing shifts across UTC
 * ------------------------------------------------------------------ */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromIso(value) {
    const [y, m, d] = String(value).split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** The whole weeks the month grid shows: Sunday before the 1st to Saturday after the last. */
function gridFor(monthKey) {
    const first = fromIso(`${monthKey}-01`);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const end = new Date(last);
    end.setDate(last.getDate() + (6 - last.getDay()));

    const days = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));
    return { days, from: iso(start), to: iso(end) };
}

function shiftMonth(monthKey, by) {
    const d = fromIso(`${monthKey}-01`);
    d.setMonth(d.getMonth() + by);
    return iso(d).slice(0, 7);
}

function monthTitle(monthKey) {
    return fromIso(`${monthKey}-01`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

function longDay(value) {
    return fromIso(value).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function shortDay(value) {
    return fromIso(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

function time12(value) {
    if (!value) return null;
    const [h, m] = value.split(':').map(Number);
    const date = new Date(2000, 0, 1, h, m);
    return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function timeRange(event) {
    if (!event.start_time) return 'All day';
    return [time12(event.start_time), time12(event.end_time)].filter(Boolean).join(' – ');
}

const onDay = (event, day) => event.starts_on <= day && day <= (event.ends_on ?? event.starts_on);

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */

const CATEGORY_STYLES = {
    holiday: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
    meeting: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
    deadline: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300' },
    activity: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
    other: { dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300' },
};
const styleOf = (category) => CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other;

function EventLine({ event, categories, canManage, onEdit, onDelete }) {
    const style = styleOf(event.category);
    const multiDay = event.ends_on && event.ends_on !== event.starts_on;
    return (
        <li className="group rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700/60">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100">
                        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                        <span className="truncate">{event.title}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{timeRange(event)}</span>
                        {multiDay && <span>{shortDay(event.starts_on)} – {shortDay(event.ends_on)}</span>}
                        <span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${style.chip}`}>{categories[event.category] ?? event.category}</span>
                    </p>
                    {event.description && <p className="mt-1 whitespace-pre-line text-[11px] text-gray-600 dark:text-gray-300">{event.description}</p>}
                </div>
                {canManage && (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button type="button" onClick={() => onEdit(event)} aria-label={`Edit ${event.title}`} className="rounded p-1 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10">
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => onDelete(event)} aria-label={`Remove ${event.title}`} className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </li>
    );
}

/* ------------------------------------------------------------------ *
 * Widget
 * ------------------------------------------------------------------ */

const BLANK = { title: '', category: 'activity', starts_on: '', ends_on: '', all_day: true, start_time: '09:00', end_time: '10:00', description: '' };
const inputClass = 'mt-1 w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

/**
 * The dashboard calendar. `data` = { month, events, upcoming, categories, canManage }.
 * Months other than the first are fetched as they are paged to.
 */
export default function CalendarWidget({ data, info }) {
    const categories = data?.categories ?? {};
    const canManage = Boolean(data?.canManage);
    const today = iso(new Date());

    const [month, setMonth] = useState(data?.month ?? today.slice(0, 7));
    const [cache, setCache] = useState(() => ({ [data?.month]: data?.events ?? [] }));
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(today);

    const [editing, setEditing] = useState(null);   // null | { id?: number }
    const [form, setForm] = useState(BLANK);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(null);

    const grid = useMemo(() => gridFor(month), [month]);
    const events = cache[month];

    async function load(key, force = false) {
        if (!force && cache[key]) return;
        const { from, to } = gridFor(key);
        setLoading(true);
        try {
            const response = await fetch(route('calendar-events.index', { from, to }), { headers: { Accept: 'application/json' } });
            if (response.ok) {
                const rows = await response.json();
                setCache((prev) => ({ ...prev, [key]: rows }));
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load(month);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month]);

    // The dashboard reloads after a change; take the fresh first month and
    // refetch the one on screen.
    useEffect(() => {
        if (!data) return;
        setCache({ [data.month]: data.events ?? [] });
        if (month !== data.month) load(month, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const dayEvents = (day) => (events ?? []).filter((event) => onDay(event, day));
    const selectedEvents = dayEvents(selected);

    function goTo(by) {
        setMonth((current) => shiftMonth(current, by));
    }

    function goToday() {
        setMonth(today.slice(0, 7));
        setSelected(today);
    }

    function openCreate(day = selected) {
        setErrors({});
        setForm({ ...BLANK, starts_on: day });
        setEditing({});
    }

    function openEdit(event) {
        setErrors({});
        setForm({
            title: event.title,
            category: event.category,
            starts_on: event.starts_on,
            ends_on: event.ends_on && event.ends_on !== event.starts_on ? event.ends_on : '',
            all_day: !event.start_time,
            start_time: event.start_time ?? '09:00',
            end_time: event.end_time ?? '10:00',
            description: event.description ?? '',
        });
        setEditing(event);
    }

    function save(e) {
        e.preventDefault();
        setSaving(true);
        const payload = {
            title: form.title.trim(),
            category: form.category,
            starts_on: form.starts_on,
            ends_on: form.ends_on || null,
            start_time: form.all_day ? null : form.start_time,
            end_time: form.all_day ? null : form.end_time,
            description: form.description.trim() || null,
        };
        const options = {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setEditing(null);
                setSelected(payload.starts_on);
                setMonth(payload.starts_on.slice(0, 7));
            },
            onError: (errs) => setErrors(errs),
            onFinish: () => setSaving(false),
        };
        editing?.id
            ? router.put(route('calendar-events.update', editing.id), payload, options)
            : router.post(route('calendar-events.store'), payload, options);
    }

    function confirmRemove() {
        setSaving(true);
        router.delete(route('calendar-events.destroy', removing.id), {
            preserveScroll: true,
            preserveState: true,
            onFinish: () => {
                setSaving(false);
                setRemoving(null);
            },
        });
    }

    const upcoming = data?.upcoming ?? [];

    return (
        <>
            <DashboardCard
                title="Calendar"
                info={info}
                icon={CalendarDays}
                subtitle={canManage ? 'Click a day to see its events or add one' : 'Holidays, meetings and deadlines'}
                aside={canManage && (
                    <button
                        type="button"
                        onClick={() => openCreate()}
                        className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add event
                    </button>
                )}
            >
                <div className="grid lg:grid-cols-[1fr_19rem]">
                    {/* Month */}
                    <div className="p-4 lg:border-r lg:border-gray-100 lg:dark:border-gray-700/60">
                        <div className="mb-3 flex items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white" aria-live="polite">
                                {monthTitle(month)}
                                {loading && <span className="ml-2 text-[11px] font-normal text-gray-400">Loading…</span>}
                            </h4>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={() => goTo(-1)} aria-label="Previous month" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={goToday} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700">
                                    Today
                                </button>
                                <button type="button" onClick={() => goTo(1)} aria-label="Next month" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700">
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700/60" role="grid" aria-label={monthTitle(month)}>
                            {WEEKDAYS.map((day) => (
                                <div key={day} role="columnheader" className="border-b border-gray-100 bg-gray-50 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-700/60 dark:bg-gray-900/40">
                                    {day}
                                </div>
                            ))}
                            {grid.days.map((date) => {
                                const day = iso(date);
                                const inMonth = day.slice(0, 7) === month;
                                const isToday = day === today;
                                const isSelected = day === selected;
                                const list = dayEvents(day);
                                return (
                                    <button
                                        key={day}
                                        type="button"
                                        role="gridcell"
                                        aria-selected={isSelected}
                                        aria-label={`${longDay(day)}${list.length ? `, ${list.length} ${list.length === 1 ? 'event' : 'events'}` : ''}`}
                                        onClick={() => setSelected(day)}
                                        onDoubleClick={() => canManage && openCreate(day)}
                                        className={`flex min-h-[4.5rem] flex-col items-stretch gap-0.5 border-b border-r border-gray-100 p-1 text-left align-top transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:border-gray-700/60 [&:nth-child(7n)]:border-r-0 ${
                                            isSelected ? 'bg-indigo-50/70 dark:bg-indigo-500/10' : inMonth ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30' : 'bg-gray-50/50 dark:bg-gray-900/20'}`}
                                    >
                                        <span className={`inline-flex h-6 w-6 items-center justify-center self-start rounded-full text-[11px] font-medium tabular-nums ${
                                            isToday ? 'bg-indigo-600 text-white' : inMonth ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600'}`}>
                                            {date.getDate()}
                                        </span>
                                        {list.slice(0, 2).map((event) => (
                                            <span key={event.id} className={`hidden truncate rounded px-1 py-px text-[10px] font-medium sm:block ${styleOf(event.category).chip}`}>
                                                {event.title}
                                            </span>
                                        ))}
                                        {list.length > 0 && (
                                            <span className="flex gap-0.5 sm:hidden" aria-hidden="true">
                                                {list.slice(0, 3).map((event) => <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${styleOf(event.category).dot}`} />)}
                                            </span>
                                        )}
                                        {list.length > 2 && <span className="hidden text-[10px] text-gray-500 sm:block">+{list.length - 2} more</span>}
                                    </button>
                                );
                            })}
                        </div>

                        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1" aria-label="Categories">
                            {Object.entries(categories).map(([key, label]) => (
                                <li key={key} className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${styleOf(key).dot}`} />
                                    {label}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* The selected day, then what is coming up */}
                    <div className="space-y-5 border-t border-gray-100 p-4 lg:border-t-0 dark:border-gray-700/60">
                        <div>
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                                    {selected === today ? 'Today' : longDay(selected)}
                                </h4>
                                {canManage && (
                                    <button type="button" onClick={() => openCreate(selected)} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                                        <Plus className="h-3 w-3" />
                                        Add
                                    </button>
                                )}
                            </div>
                            {selected === today && <p className="text-[11px] text-gray-500 dark:text-gray-400">{longDay(today)}</p>}
                            {selectedEvents.length === 0 ? (
                                <p className="mt-2 text-[11px] text-gray-400">Nothing scheduled.</p>
                            ) : (
                                <ul className="mt-2 space-y-2">
                                    {selectedEvents.map((event) => (
                                        <EventLine key={event.id} event={event} categories={categories} canManage={canManage} onEdit={openEdit} onDelete={setRemoving} />
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div>
                            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Coming up</h4>
                            {upcoming.length === 0 ? (
                                <p className="mt-2 text-[11px] text-gray-400">No upcoming events.</p>
                            ) : (
                                <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-700/60">
                                    {upcoming.map((event) => (
                                        <li key={event.id}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const day = event.starts_on < today ? today : event.starts_on;
                                                    setMonth(day.slice(0, 7));
                                                    setSelected(day);
                                                }}
                                                className="flex w-full items-center gap-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30"
                                            >
                                                <span className="flex w-10 shrink-0 flex-col items-center rounded-lg border border-gray-100 py-1 dark:border-gray-700/60">
                                                    <span className="text-[9px] font-semibold uppercase text-gray-400">
                                                        {fromIso(event.starts_on).toLocaleDateString('en-PH', { month: 'short' })}
                                                    </span>
                                                    <span className="text-sm font-semibold leading-none tabular-nums text-gray-900 dark:text-white">
                                                        {fromIso(event.starts_on).getDate()}
                                                    </span>
                                                </span>
                                                <span className="min-w-0">
                                                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-900 dark:text-gray-100">
                                                        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${styleOf(event.category).dot}`} />
                                                        <span className="truncate">{event.title}</span>
                                                    </span>
                                                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                                                        {timeRange(event)}
                                                        {event.ends_on && event.ends_on !== event.starts_on && ` · until ${shortDay(event.ends_on)}`}
                                                    </span>
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </DashboardCard>

            {/* Add / edit */}
            <Modal show={editing !== null} onClose={() => !saving && setEditing(null)} maxWidth="lg">
                <form onSubmit={save} className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editing?.id ? 'Edit event' : 'Add an event'}</h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Everyone sees it on their dashboard calendar.</p>

                    <div className="mt-5 space-y-4">
                        <div>
                            <label htmlFor="event-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                            <input id="event-title" type="text" required autoFocus maxLength={120} value={form.title}
                                   onChange={(e) => setForm({ ...form, title: e.target.value })}
                                   placeholder="e.g. Quarterly inventory count" className={inputClass} />
                            <InputError message={errors.title} className="mt-1" />
                        </div>

                        <fieldset>
                            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</legend>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {Object.entries(categories).map(([key, label]) => (
                                    <label key={key} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${form.category === key
                                        ? 'border-indigo-500 text-gray-900 ring-2 ring-indigo-500/30 dark:text-white'
                                        : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900/40'}`}>
                                        <input type="radio" name="category" value={key} checked={form.category === key} onChange={() => setForm({ ...form, category: key })} className="sr-only" />
                                        <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${styleOf(key).dot}`} />
                                        {label}
                                    </label>
                                ))}
                            </div>
                            <InputError message={errors.category} className="mt-1" />
                        </fieldset>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="event-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
                                <input id="event-start" type="date" required value={form.starts_on}
                                       onChange={(e) => setForm({ ...form, starts_on: e.target.value })} className={inputClass} />
                                <InputError message={errors.starts_on} className="mt-1" />
                            </div>
                            <div>
                                <label htmlFor="event-end" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Until <span className="font-normal text-gray-400">(optional)</span>
                                </label>
                                <input id="event-end" type="date" min={form.starts_on || undefined} value={form.ends_on}
                                       onChange={(e) => setForm({ ...form, ends_on: e.target.value })} className={inputClass} />
                                <InputError message={errors.ends_on} className="mt-1" />
                            </div>
                        </div>

                        <div>
                            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input type="checkbox" checked={form.all_day} onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
                                       className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900" />
                                All day
                            </label>
                            {!form.all_day && (
                                <div className="mt-2 grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="event-from" className="block text-xs text-gray-500 dark:text-gray-400">From</label>
                                        <input id="event-from" type="time" required value={form.start_time}
                                               onChange={(e) => setForm({ ...form, start_time: e.target.value })} className={inputClass} />
                                        <InputError message={errors.start_time} className="mt-1" />
                                    </div>
                                    <div>
                                        <label htmlFor="event-to" className="block text-xs text-gray-500 dark:text-gray-400">To</label>
                                        <input id="event-to" type="time" required value={form.end_time}
                                               onChange={(e) => setForm({ ...form, end_time: e.target.value })} className={inputClass} />
                                        <InputError message={errors.end_time} className="mt-1" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="event-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Details <span className="font-normal text-gray-400">(optional)</span>
                            </label>
                            <textarea id="event-description" rows={3} maxLength={2000} value={form.description}
                                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                                      placeholder="Venue, who should attend, what to bring…" className={inputClass} />
                            <InputError message={errors.description} className="mt-1" />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => setEditing(null)} disabled={saving}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving || !form.title.trim() || !form.starts_on}
                                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
                            {saving ? 'Saving…' : editing?.id ? 'Save changes' : 'Add event'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Remove */}
            <Modal show={removing !== null} onClose={() => !saving && setRemoving(null)} maxWidth="md">
                <div className="bg-white p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Remove “{removing?.title}”?</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        It disappears from everyone’s calendar. The removal is recorded in the audit trail.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button type="button" onClick={() => setRemoving(null)} disabled={saving}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                            Keep it
                        </button>
                        <button type="button" onClick={confirmRemove} disabled={saving}
                                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50">
                            {saving ? 'Removing…' : 'Remove event'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

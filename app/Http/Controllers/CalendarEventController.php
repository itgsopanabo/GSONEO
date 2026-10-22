<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\CalendarEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * The dashboard calendar. Everyone reads it; holders of calendar.manage add,
 * change and remove events from the calendar itself.
 */
class CalendarEventController extends Controller
{
    use LogsAudit;

    /**
     * Events for the days the calendar is showing, as JSON — the calendar
     * fetches each month as it is paged to. Capped at about three months.
     */
    public function index(Request $request): JsonResponse
    {
        $range = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $from = Carbon::parse($range['from']);
        $to = Carbon::parse($range['to'])->min($from->copy()->addDays(100));

        return response()->json(self::eventsBetween($from->toDateString(), $to->toDateString()));
    }

    /** @return array<int, array<string, mixed>> */
    public static function eventsBetween(string $from, string $to): array
    {
        return CalendarEvent::with('createdBy:emp_id,emp_fname,emp_lname')
            ->between($from, $to)
            ->orderBy('starts_on')
            ->orderByRaw('start_time IS NOT NULL, start_time')
            ->get()
            ->map->toCalendar()
            ->all();
    }

    /** The next few events from today, for the list beside the calendar. */
    public static function upcoming(int $limit = 6): array
    {
        return CalendarEvent::with('createdBy:emp_id,emp_fname,emp_lname')
            ->whereRaw('COALESCE(ends_on, starts_on) >= ?', [today()->toDateString()])
            ->orderBy('starts_on')
            ->orderByRaw('start_time IS NOT NULL, start_time')
            ->take($limit)
            ->get()
            ->map->toCalendar()
            ->all();
    }

    public function store(Request $request): RedirectResponse
    {
        $event = CalendarEvent::create($this->validated($request) + [
            'created_by_emp_id' => Auth::id(),
            'updated_by_emp_id' => Auth::id(),
        ]);

        $this->audit('Calendar event added', $event, "Added \"{$event->title}\" to the calendar on {$this->when($event)}.", null, $this->snapshot($event));

        return back()->with('success', "\"{$event->title}\" added to the calendar.");
    }

    public function update(Request $request, CalendarEvent $calendarEvent): RedirectResponse
    {
        $before = $this->snapshot($calendarEvent);

        $calendarEvent->update($this->validated($request) + ['updated_by_emp_id' => Auth::id()]);

        $this->audit('Calendar event updated', $calendarEvent, "Updated \"{$calendarEvent->title}\" on the calendar.", $before, $this->snapshot($calendarEvent->fresh()));

        return back()->with('success', "\"{$calendarEvent->title}\" updated.");
    }

    public function destroy(CalendarEvent $calendarEvent): RedirectResponse
    {
        $before = $this->snapshot($calendarEvent);
        $title = $calendarEvent->title;
        $when = $this->when($calendarEvent);

        $calendarEvent->delete();

        $this->audit('Calendar event removed', $calendarEvent, "Removed \"{$title}\" ({$when}) from the calendar.", $before);

        return back()->with('success', "\"{$title}\" removed from the calendar.");
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['required', Rule::in(array_keys(CalendarEvent::CATEGORIES))],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'start_time' => ['nullable', 'date_format:H:i'],
            'end_time' => ['nullable', 'date_format:H:i', 'required_with:start_time'],
        ], [
            'ends_on.after_or_equal' => 'The event cannot end before it starts.',
            'end_time.required_with' => 'Give an end time too, or leave both empty for an all-day event.',
        ]);

        // What was left out is cleared, so an edit that drops the times makes
        // the event all-day rather than keeping the old ones.
        $data += ['ends_on' => null, 'start_time' => null, 'end_time' => null, 'description' => null];

        // A one-day event stores no end date; an end time before the start on
        // the same day is a mistake, not an overnight event.
        if ($data['ends_on'] === $data['starts_on']) {
            $data['ends_on'] = null;
        }
        if (! empty($data['start_time']) && ! empty($data['end_time']) && empty($data['ends_on']) && $data['end_time'] < $data['start_time']) {
            throw \Illuminate\Validation\ValidationException::withMessages(['end_time' => 'The event cannot end before it starts.']);
        }

        return $data;
    }

    private function snapshot(CalendarEvent $event): array
    {
        return $event->only(['title', 'category', 'starts_on', 'ends_on', 'start_time', 'end_time']);
    }

    private function when(CalendarEvent $event): string
    {
        $start = $event->starts_on?->format('M j, Y');

        return $event->ends_on && ! $event->ends_on->equalTo($event->starts_on)
            ? "{$start} – {$event->ends_on->format('M j, Y')}"
            : (string) $start;
    }
}

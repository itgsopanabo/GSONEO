<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One event on the dashboard calendar.
 */
class CalendarEvent extends Model
{
    /** key => label. The calendar colours each one. */
    public const CATEGORIES = [
        'holiday' => 'Holiday',
        'meeting' => 'Meeting',
        'deadline' => 'Deadline',
        'activity' => 'Activity',
        'other' => 'Other',
    ];

    protected $fillable = [
        'title',
        'description',
        'category',
        'starts_on',
        'ends_on',
        'start_time',
        'end_time',
        'created_by_emp_id',
        'updated_by_emp_id',
    ];

    protected $casts = [
        'starts_on' => 'date:Y-m-d',
        'ends_on' => 'date:Y-m-d',
    ];

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_emp_id', 'emp_id');
    }

    /** Events touching any day from $from to $to, multi-day ones included. */
    public function scopeBetween(Builder $query, string $from, string $to): Builder
    {
        return $query
            ->where('starts_on', '<=', $to)
            ->whereRaw('COALESCE(ends_on, starts_on) >= ?', [$from]);
    }

    /** The shape the calendar reads. */
    public function toCalendar(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'category' => $this->category,
            'starts_on' => $this->starts_on?->format('Y-m-d'),
            'ends_on' => ($this->ends_on ?? $this->starts_on)?->format('Y-m-d'),
            'start_time' => $this->start_time ? substr($this->start_time, 0, 5) : null,
            'end_time' => $this->end_time ? substr($this->end_time, 0, 5) : null,
            'created_by' => $this->createdBy ? trim("{$this->createdBy->emp_fname} {$this->createdBy->emp_lname}") : null,
        ];
    }
}

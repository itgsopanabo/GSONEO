<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;
use Carbon\Carbon;

class Records extends Model
{
    protected $fillable = [
        'record_class_id', 'title', 'reference_no', 'record_date',
        'originating_office', 'custodian', 'physical_location', 'box_no',
        'retention_starts_on', 'status',
    ];

    protected $casts = [
        'record_date'              => 'date',
        'retention_starts_on'      => 'date',
        'eligible_for_disposal_on' => 'date',
        'archived_at'              => 'datetime',
    ];

    public const STATUSES = ['active', 'storage', 'for_disposal', 'disposed', 'transferred_to_nap'];

    public function recordClass(): BelongsTo
    {
        return $this->belongsTo(RecordsClasses::class, 'record_class_id');
    }

    public function archivedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'archived_by', 'emp_id');
    }

    protected static function booted(): void
    {
        static::saving(function (Records $record) {
            $record->eligible_for_disposal_on = $record->computeDisposalDate();
        });
    }

    public function computeDisposalDate(): ?Carbon
    {
        $class = $this->recordClass()->first();

        if (! $class || $class->is_permanent || $class->retention_years === null) {
            return null;
        }

        if ($this->retention_starts_on === null) {
            return null;   // trigger event hasn't happened — not eligible
        }

        return Carbon::parse($this->retention_starts_on)->addYears($class->retention_years);
    }

    /* scopes */

    public function scopeActive(Builder $q): Builder
    {
        return $q->whereNull('archived_at');
    }

    public function scopeArchived(Builder $q): Builder
    {
        return $q->whereNotNull('archived_at');
    }

    public function scopeVisibleTo(Builder $q, ?User $user): Builder
    {
        $levels = $user?->can('records.view_restricted')
            ? ['public', 'internal', 'restricted']
            : ['public', 'internal'];

        return $q->whereHas('recordClass', fn ($q) => $q->whereIn('sensitivity', $levels));
    }

    public function scopeSearch(Builder $q, ?string $term): Builder
    {
        if (blank($term)) {
            return $q;
        }

        return $q->where(fn ($q) => $q
            ->where('title', 'like', "%{$term}%")
            ->orWhere('reference_no', 'like', "%{$term}%")
            ->orWhere('box_no', 'like', "%{$term}%"));
    }

    public function getIsArchivedAttribute(): bool
    {
        return $this->archived_at !== null;
    }
}

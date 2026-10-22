<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A query saved from the SQL console.
 */
class SavedQuery extends Model
{
    protected $fillable = [
        'name',
        'description',
        'sql',
        'is_shared',
        'created_by_emp_id',
        'run_count',
        'last_run_at',
    ];

    protected $casts = [
        'is_shared' => 'boolean',
        'last_run_at' => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_emp_id', 'emp_id');
    }

    /** What this person may open: their own, and what others have shared. */
    public function scopeVisibleTo(Builder $query, ?User $user): Builder
    {
        return $query->where(fn ($q) => $q
            ->where('created_by_emp_id', $user?->emp_id)
            ->orWhere('is_shared', true));
    }

    public function ownedBy(?User $user): bool
    {
        return $user !== null && (int) $this->created_by_emp_id === (int) $user->emp_id;
    }
}

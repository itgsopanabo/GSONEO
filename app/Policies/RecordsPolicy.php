<?php

namespace App\Policies;

use App\Models\Records;
use App\Models\RecordsClasses;
use App\Models\User;

/**
 * Laravel finds this policy for App\Models\Records by name.
 *
 * Everyone with `records.view` works in the registry; records in a restricted
 * class (land titles and the like) additionally need `records.view_restricted`,
 * matching Records::scopeVisibleTo so a hidden record can't be opened by URL.
 */
class RecordsPolicy
{
    public function view(User $user, Records $record): bool
    {
        return $user->hasPermission('records.view') && $this->canSeeClass($user, $record->recordClass);
    }

    /** Register a record; the chosen class must be one the user may see. */
    public function create(User $user, ?RecordsClasses $class = null): bool
    {
        return $user->hasPermission('records.view') && $this->canSeeClass($user, $class);
    }

    /** Edit, archive or restore. */
    public function update(User $user, Records $record): bool
    {
        return $this->view($user, $record);
    }

    private function canSeeClass(User $user, ?RecordsClasses $class): bool
    {
        return $class?->sensitivity !== 'restricted' || $user->hasPermission('records.view_restricted');
    }
}

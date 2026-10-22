<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RolePermissionController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Permissions/Index', [
            'roles' => Role::query()
                ->withCount('users')
                ->with('permissions:id')
                ->orderBy('section')
                ->orderBy('role_name')
                ->get()
                ->map(fn (Role $role) => [
                    'id' => $role->id,
                    'role_name' => $role->role_name,
                    'section' => $role->section,
                    'users_count' => $role->users_count,
                    'permission_ids' => $role->permissions->pluck('id'),
                ]),
            'permissions' => Permission::query()
                ->orderBy('id')
                ->get(['id', 'name', 'label', 'group', 'description']),
            'ownRoleId' => $request->user()->role_id,
            'protectedOnOwnRole' => Permission::whereIn('name', config('permissions.protected_on_own_role', []))->pluck('id'),
        ]);
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        $validated = $request->validate([
            'permission_ids' => ['present', 'array'],
            'permission_ids.*' => ['integer', Rule::exists('permissions', 'id')],
        ]);

        $newIds = collect($validated['permission_ids'])->map(fn ($id) => (int) $id)->unique()->values();

        // Keep whoever is editing from removing their own way back in.
        if ($role->id === $request->user()->role_id) {
            $missing = Permission::whereIn('name', config('permissions.protected_on_own_role', []))
                ->whereNotIn('id', $newIds)
                ->pluck('label');

            if ($missing->isNotEmpty()) {
                return back()->with('error', 'You cannot remove "'.$missing->join('", "').'" from your own role.');
            }
        }

        $before = $role->permissions()->pluck('name');

        DB::transaction(fn () => $role->permissions()->sync($newIds));
        Role::forgetPermissionCache($role->id);

        $after = $role->permissions()->pluck('name');
        $added = $after->diff($before)->values();
        $removed = $before->diff($after)->values();

        if ($added->isEmpty() && $removed->isEmpty()) {
            return back()->with('success', 'No changes to save.');
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'permissions_updated',
            'auditable_type' => Role::class,
            'auditable_id' => $role->id,
            'description' => "Updated permissions for {$role->role_name} ({$role->section}): "
                .collect([
                    $added->isNotEmpty() ? 'added '.$added->join(', ') : null,
                    $removed->isNotEmpty() ? 'removed '.$removed->join(', ') : null,
                ])->filter()->join('; '),
            'old_values' => ['permissions' => $before->values()],
            'new_values' => ['permissions' => $after->values()],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return back()->with('success', "Permissions saved for {$role->role_name} ({$role->section}).");
    }
}

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

    public function store(Request $request): RedirectResponse
    {
        $request->merge([
            'role_name' => trim((string) $request->input('role_name')),
            'section' => trim((string) $request->input('section')),
        ]);

        $validated = $request->validate([
            'role_name' => [
                'required', 'string', 'max:255',
                Rule::unique('role', 'role_name')->where('section', $request->input('section')),
            ],
            'section' => ['required', 'string', 'max:255'],
            'copy_from_role_id' => ['nullable', 'integer', Rule::exists('role', 'id')],
        ], [
            'role_name.unique' => 'This section already has a role with that name.',
        ]);

        $role = DB::transaction(function () use ($validated) {
            $role = Role::create([
                'role_name' => $validated['role_name'],
                'section' => $validated['section'],
            ]);

            if (! empty($validated['copy_from_role_id'])) {
                $role->permissions()->sync(
                    Role::findOrFail($validated['copy_from_role_id'])->permissions()->pluck('permissions.id')
                );
            }

            return $role;
        });

        $source = ! empty($validated['copy_from_role_id']) ? Role::find($validated['copy_from_role_id']) : null;
        $permissions = $role->permissions()->pluck('name')->values();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'role_created',
            'auditable_type' => Role::class,
            'auditable_id' => $role->id,
            'description' => "Created role {$role->role_name} ({$role->section})"
                .($source ? ", with permissions copied from {$source->role_name} ({$source->section})" : ''),
            'new_values' => [
                'role_name' => $role->role_name,
                'section' => $role->section,
                'permissions' => $permissions,
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return back()->with('success', "Role {$role->role_name} ({$role->section}) created.");
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

<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Syncs the permission catalogue from config/permissions.php and gives each
 * role its default access — but only roles that have no permissions yet, so
 * changes made on the Roles & permissions screen survive a re-seed. Roles
 * whose default is '*' also receive any permission created by this run.
 */
class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $created = [];

        foreach (config('permissions.catalogue') as $group => $permissions) {
            foreach ($permissions as $name => [$label, $description]) {
                $permission = Permission::updateOrCreate(
                    ['name' => $name],
                    ['label' => $label, 'group' => $group, 'description' => $description],
                );

                if ($permission->wasRecentlyCreated) {
                    $created[] = $permission->id;
                }
            }
        }

        $allIds = Permission::pluck('id', 'name');

        foreach (config('permissions.defaults') as $section => $roles) {
            foreach ($roles as $roleName => $names) {
                $role = Role::where('section', $section)->where('role_name', $roleName)->first();

                if (! $role) {
                    continue;
                }

                // A role that already has access keeps its screen edits; one
                // defined as '*' still receives permissions added since.
                if ($role->permissions()->exists()) {
                    if (in_array('*', $names, true) && $created) {
                        $role->permissions()->syncWithoutDetaching($created);
                        Role::forgetPermissionCache($role->id);
                    }

                    continue;
                }

                $ids = in_array('*', $names, true)
                    ? $allIds->values()
                    : $allIds->only($names)->values();

                $role->permissions()->sync($ids);
                Role::forgetPermissionCache($role->id);
            }
        }
    }
}

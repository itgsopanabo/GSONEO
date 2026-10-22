<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Gives the Department Head the tabbed analytics dashboard.
 *
 * PermissionSeeder deliberately only applies `defaults` to roles that hold no
 * permissions yet, so edits made on the Roles & permissions screen survive a
 * re-seed. That also means a permission added to an existing role's defaults
 * never reaches it — hence this. The Superadmin is defined as '*' and picks it
 * up from the seeder.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = DB::table('permissions')->where('name', 'dashboard.analytics')->value('id');

        if (! $permission) {
            return;   // PermissionSeeder has not run yet; it will grant '*' roles then.
        }

        DB::table('role')
            ->where('section', 'Administration')
            ->where('role_name', 'Department Head')
            ->pluck('id')
            ->each(function ($roleId) use ($permission) {
                DB::table('permission_role')->updateOrInsert(
                    ['role_id' => $roleId, 'permission_id' => $permission],
                );

                \App\Models\Role::forgetPermissionCache($roleId);
            });
    }

    public function down(): void
    {
        $permission = DB::table('permissions')->where('name', 'dashboard.analytics')->value('id');

        if (! $permission) {
            return;
        }

        DB::table('role')
            ->where('section', 'Administration')
            ->where('role_name', 'Department Head')
            ->pluck('id')
            ->each(function ($roleId) use ($permission) {
                DB::table('permission_role')
                    ->where('role_id', $roleId)
                    ->where('permission_id', $permission)
                    ->delete();

                \App\Models\Role::forgetPermissionCache($roleId);
            });
    }
};

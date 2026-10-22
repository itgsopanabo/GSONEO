<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `procurement.cancel` became `procurement.override` when changing a record's
 * status joined cancelling it under one administrative permission.
 *
 * Renamed in place rather than added anew, so the roles that already hold it —
 * and any change made on the Roles & permissions screen — carry over.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('permissions')->where('name', 'procurement.cancel')->update([
            'name' => 'procurement.override',
            'label' => 'Cancel and change status',
            'description' => 'Cancel a purchase request or its purchase order, and move either to another status, from Request Monitoring.',
            'updated_at' => now(),
        ]);

        $this->forgetRoleCaches();
    }

    public function down(): void
    {
        DB::table('permissions')->where('name', 'procurement.override')->update([
            'name' => 'procurement.cancel',
            'label' => 'Cancel requests and orders',
            'description' => 'Cancel a purchase request, or only its purchase order, from Request Monitoring.',
            'updated_at' => now(),
        ]);

        $this->forgetRoleCaches();
    }

    /** Role permissions are cached forever, so every role holding it must be refreshed. */
    private function forgetRoleCaches(): void
    {
        if (! class_exists(\App\Models\Role::class)) {
            return;
        }

        DB::table('role')->pluck('id')->each(fn ($id) => \App\Models\Role::forgetPermissionCache($id));
    }
};

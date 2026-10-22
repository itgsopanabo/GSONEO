<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Letterhead and watermark settings for generated PDFs, one row per key.
 *
 * Also adds the documents.manage permission and hands it to the Superadmin
 * straight away, so the screen is reachable without re-running the seeder.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        if (! Schema::hasTable('permissions')) {
            return;
        }

        [$label, $description] = config('permissions.catalogue.Administration')['documents.manage'];

        DB::table('permissions')->updateOrInsert(
            ['name' => 'documents.manage'],
            ['label' => $label, 'group' => 'Administration', 'description' => $description, 'updated_at' => now(), 'created_at' => now()],
        );

        $permission = DB::table('permissions')->where('name', 'documents.manage')->value('id');

        DB::table('role')
            ->where('section', 'Sys Admin')
            ->where('role_name', 'Superadmin')
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
        $permission = DB::table('permissions')->where('name', 'documents.manage')->value('id');

        if ($permission) {
            $roleIds = DB::table('permission_role')->where('permission_id', $permission)->pluck('role_id');
            DB::table('permissions')->where('id', $permission)->delete();   // cascades to permission_role
            $roleIds->each(fn ($roleId) => \App\Models\Role::forgetPermissionCache($roleId));
        }

        Schema::dropIfExists('document_settings');
    }
};

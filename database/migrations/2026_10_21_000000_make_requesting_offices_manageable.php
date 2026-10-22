<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Requesting offices, kept on their own screen instead of in a seeder.
 *
 * `departments` already held the list; nothing could change it short of a
 * code change. Offices can now be added, renamed and retired from the
 * Requesting Offices screen. Retired ones stop being offered but stay on the
 * records that used them.
 *
 * Requests, records and releases store the office's NAME. The Encoding form
 * stored the CODE instead ("CADO" rather than "City Administrator Office"),
 * which the monitoring filter, dashboard chart and SSMI office code — all
 * matched by name — did not recognise. Any code stored that way becomes the
 * name here; the form now stores names like everything else.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('Department_Desc');
        });

        foreach ([['purchase_requests', 'requester_department'], ['records', 'originating_office'], ['purchase_order', 'released_to_department']] as [$table, $column]) {
            DB::table($table)
                ->join('departments', "{$table}.{$column}", '=', 'departments.Department_Code')
                ->update(["{$table}.{$column}" => DB::raw('departments.Department_Name')]);
        }
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};

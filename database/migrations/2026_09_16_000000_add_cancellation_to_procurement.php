<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Cancellation of purchase requests and purchase orders.
 *
 * Status 800 is inserted here, not left to StatusSeeder: both tables' `status`
 * columns carry a foreign key to `status.status_code` with ON DELETE RESTRICT,
 * so the row has to exist before anything can be cancelled.
 */
return new class extends Migration
{
    private const CANCELLED = 800;

    public function up(): void
    {
        DB::table('status')->upsert(
            [['status_code' => self::CANCELLED, 'status_desc' => 'Cancelled', 'created_at' => now(), 'updated_at' => now()]],
            ['status_code'],
            ['status_desc', 'updated_at'],
        );

        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->integer('cancelled_by_emp_id')->nullable()->after('decline_by_emp_id');
            $table->dateTime('cancelled_at')->nullable()->after('declined_At');
            $table->text('cancellation_reason')->nullable()->after('reason_to_decline');

            $table->foreign('cancelled_by_emp_id')
                ->references('emp_id')
                ->on('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();
        });

        Schema::table('purchase_order', function (Blueprint $table) {
            $table->integer('cancelled_by_emp_id')->nullable()->after('status');
            $table->dateTime('cancelled_at')->nullable()->after('cancelled_by_emp_id');
            $table->text('cancellation_reason')->nullable()->after('cancelled_at');

            $table->foreign('cancelled_by_emp_id')
                ->references('emp_id')
                ->on('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->dropForeign(['cancelled_by_emp_id']);
            $table->dropColumn(['cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']);
        });

        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dropForeign(['cancelled_by_emp_id']);
            $table->dropColumn(['cancelled_by_emp_id', 'cancelled_at', 'cancellation_reason']);
        });

        // Only if nothing is still parked on it — the foreign key would refuse anyway,
        // and a cancelled record left behind is worth keeping over a clean status list.
        $inUse = DB::table('purchase_requests')->where('status', self::CANCELLED)->exists()
            || DB::table('purchase_order')->where('status', self::CANCELLED)->exists();

        if (! $inUse) {
            DB::table('status')->where('status_code', self::CANCELLED)->delete();
        }
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When a delivery was accepted on the Incoming page, and by whom.
 *
 * Accepting moved the order from 230 to 300 and recorded nothing else, so there
 * was no answer to "when did the goods arrive". The model listed a
 * `supplier_receive_date`, and several pages showed it as the date received,
 * but no such column was ever created — those fields were always blank.
 *
 * Existing orders cannot be backfilled — the moment went unrecorded — so they
 * show no acceptance date; every delivery accepted from now on has one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dateTime('received_at')->nullable()->after('PO_Date');
            $table->integer('received_by_emp_id')->nullable()->after('received_at');

            $table->foreign('received_by_emp_id')
                ->references('emp_id')
                ->on('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dropForeign(['received_by_emp_id']);
            $table->dropColumn(['received_at', 'received_by_emp_id']);
        });
    }
};

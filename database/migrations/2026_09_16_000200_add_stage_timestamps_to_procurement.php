<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When an order was released.
 *
 * Releasing only moved the status to 600, so "how long from SSMI to release" and
 * "how long end to end" had no answer. Every other boundary the monitoring chain
 * needs is already stamped somewhere: created_at and verified_At on the request,
 * PO_Date, RIS_Date and SSMI_Date on the order, created_at on the IAR.
 *
 * Existing records cannot be backfilled — the moment went unrecorded — so the
 * two stages that depend on it begin measuring from the first order released
 * after this migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dateTime('released_at')->nullable()->after('SSMI_Date');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dropColumn('released_at');
        });
    }
};

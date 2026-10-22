<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The fund an order's supplies are charged to.
 *
 * The SSMI prints its source of fund twice — in the office code under the
 * title ("CAGRO-MOOE") and at the foot of the form — and both were the literal
 * text "MOOE" whatever the order. Nothing in the system recorded the fund, so
 * it is now chosen when the SSMI number is generated (see config/documents.php
 * for the list).
 *
 * Existing SSMIs are left empty rather than assumed to be MOOE: their form
 * prints a blank line for the fund until it is filled in by hand.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->string('fund_source', 20)->nullable()->after('ssmiNumbered_by');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dropColumn('fund_source');
        });
    }
};

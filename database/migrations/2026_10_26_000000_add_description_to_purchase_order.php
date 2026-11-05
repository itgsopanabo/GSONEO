<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A short description of what the order is for.
 *
 * It is typed in with the supplier when the PO number is generated. Existing
 * orders are left empty rather than filled from their request lines: the
 * description is the PO's own text, not a summary of the items.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->text('PO_Description')->nullable()->after('PO_Supplier');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dropColumn('PO_Description');
        });
    }
};

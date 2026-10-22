<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One IAR per invoice per purchase order.
 *
 * Generating an IAR had no guard at all, so a second click produced a second
 * report — a new IAR number against the same delivery. A repeat of the same
 * invoice on the same order is always a duplicate, whatever the intent, so the
 * database refuses it outright; IARController turns the failure into a message.
 *
 * Several IARs for one order remain possible with different invoices, which is
 * how partial deliveries would be recorded.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('iar', function (Blueprint $table) {
            $table->unique(['PO_Number', 'invoice_number'], 'iar_po_invoice_unique');
        });
    }

    public function down(): void
    {
        Schema::table('iar', function (Blueprint $table) {
            $table->dropUnique('iar_po_invoice_unique');
        });
    }
};

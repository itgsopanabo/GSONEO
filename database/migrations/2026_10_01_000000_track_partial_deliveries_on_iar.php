<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Partial and complete deliveries.
 *
 * An IAR recorded an invoice number and nothing else — not which items came,
 * not how many. The first IAR on an order moved the whole order to For RIS, so
 * a delivery of 10 out of 100 chairs unlocked the issue slip, the SSMI and the
 * release for all 100.
 *
 * `iar_items` records the quantity received per line on each report. From the
 * running total the order is tagged:
 *
 *   partial  — at least one line still has a balance; the order stays For
 *              Inspection so the next delivery can be recorded against it.
 *   complete — every line has been received in full; the order moves to For RIS.
 *
 * The tag is kept on each IAR (the state the order was in once that report was
 * accepted, printed on the form) and on the purchase order (its current state).
 *
 * Reports made before this migration have no item rows. They are backfilled as
 * complete, which is how the system already treated them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('iar', function (Blueprint $table) {
            // Validated by the form all along, but there was no column to keep it in.
            $table->date('invoice_date')->nullable()->after('invoice_number');
            $table->string('delivery_status', 10)->nullable()->after('invoice_date');
        });

        Schema::create('iar_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('iar_id')->constrained('iar')->cascadeOnDelete();
            $table->foreignId('purchase_request_item_id')->constrained('purchase_request_items')->cascadeOnDelete();
            $table->unsignedInteger('quantity_received');
            $table->timestamps();

            $table->unique(['iar_id', 'purchase_request_item_id']);
        });

        Schema::table('purchase_order', function (Blueprint $table) {
            // Null until the first IAR: nothing has been received yet.
            $table->string('delivery_status', 10)->nullable()->after('status');
        });

        DB::table('iar')->update(['delivery_status' => 'complete']);

        DB::table('purchase_order')
            ->whereIn('PO_Number', DB::table('iar')->select('PO_Number'))
            ->update(['delivery_status' => 'complete']);
    }

    public function down(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dropColumn('delivery_status');
        });

        Schema::dropIfExists('iar_items');

        Schema::table('iar', function (Blueprint $table) {
            $table->dropColumn(['invoice_date', 'delivery_status']);
        });
    }
};

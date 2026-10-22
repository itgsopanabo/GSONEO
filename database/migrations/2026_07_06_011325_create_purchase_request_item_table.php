<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('purchase_request_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('purchase_request_id')
                ->constrained('purchase_requests')
                ->onDelete('cascade');

            $table->string('item_name')->nullable();
            $table->string('item_desc')->nullable();
            $table->string('unit');
            $table->integer('quantity');
            $table->decimal('estimated_unit_cost', 10, 2);
            $table->decimal('total_estimated_cost', 10, 2);
            $table->decimal('bidding_unit_cost', 10, 2)->nullable();
            $table->decimal('total_bidding_unit_cost', 10, 2)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_request_item');
    }
};

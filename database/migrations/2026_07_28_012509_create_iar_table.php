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
        Schema::create('iar', function (Blueprint $table) {
            $table->id();
            $table->string('iar_number');
            $table->string('invoice_number')->nullable();
            $table->string("PO_Number");
            $table->foreign('PO_Number')->references('PO_Number')->on('purchase_order');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */

    public function down(): void
    {
        Schema::dropIfExists('iar');
    }
};

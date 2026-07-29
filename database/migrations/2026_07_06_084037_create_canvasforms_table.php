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
        Schema::create('canvasForms', function (Blueprint $table) {
            $table->id();
            $table->string('CF_Number');
            $table->string('pr_number');
            $table->string('CF_to_be_Open');
            $table->string('CF_delivery_Period');
            $table->string('CF_canvasser')->nullable();
            $table->string('CF_made_by');
            $table->string('CF_bac_date');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('canvasForms');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Queries saved from the SQL console, to be run again later.
 *
 * Private to whoever saved them unless shared; a shared query can be run by
 * anyone with SQL console access but only changed by its owner. The SQL is
 * checked by the console's own rules when saved, so a saved query is always
 * one the console will run.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_queries', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('description', 255)->nullable();
            $table->text('sql');
            $table->boolean('is_shared')->default(false);
            $table->integer('created_by_emp_id');
            $table->unsignedInteger('run_count')->default(0);
            $table->dateTime('last_run_at')->nullable();
            $table->timestamps();

            // One name per person, so "Monthly POs" means one thing in their list.
            $table->unique(['created_by_emp_id', 'name']);

            $table->foreign('created_by_emp_id')->references('emp_id')->on('users')->cascadeOnUpdate()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_queries');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The missing tracker.
 *
 * An order can be held up by something no status describes: the IAR came back
 * without the inspector's signature, the supplier never sent the delivery
 * receipt. That was kept on paper or in someone's head. Inventory staff can now
 * tag the order with what is missing, and close the tag once it is sorted.
 *
 * tracker_tags            the list of things that can be missing, kept on the
 *                         Tracker Tags screen by an administrator
 * purchase_order_tags     one tag on one order: who raised it and why, and —
 *                         once resolved — who resolved it and how. Resolved
 *                         tags stay as the order's history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracker_tags', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60)->unique();
            $table->string('description')->nullable();
            // A key of App\Models\TrackerTag::COLORS.
            $table->string('color', 20)->default('amber');
            // Retired tags are no longer offered; orders keep the ones they have.
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('purchase_order_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_id')->constrained('purchase_order')->cascadeOnDelete();
            // Restrict: a tag that has been used is retired, not deleted.
            $table->foreignId('tracker_tag_id')->constrained('tracker_tags')->restrictOnDelete();
            $table->text('note')->nullable();
            $table->integer('tagged_by_emp_id')->nullable();
            $table->dateTime('resolved_at')->nullable();
            $table->integer('resolved_by_emp_id')->nullable();
            $table->text('resolution_note')->nullable();
            $table->timestamps();

            $table->index(['purchase_order_id', 'resolved_at']);

            $table->foreign('tagged_by_emp_id')->references('emp_id')->on('users')->cascadeOnUpdate()->nullOnDelete();
            $table->foreign('resolved_by_emp_id')->references('emp_id')->on('users')->cascadeOnUpdate()->nullOnDelete();
        });

        // A starting list; the Tracker Tags screen is the source of truth after this.
        DB::table('tracker_tags')->insert(array_map(fn ($tag) => $tag + [
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ], [
            ['name' => 'Missing signature', 'color' => 'amber', 'description' => 'A required signature is not on the document yet.'],
            ['name' => 'Missing invoice', 'color' => 'rose', 'description' => "The supplier's sales invoice has not been received."],
            ['name' => 'Missing delivery receipt', 'color' => 'rose', 'description' => 'No delivery receipt came with the items.'],
            ['name' => 'Missing attachment', 'color' => 'sky', 'description' => 'A supporting document is not attached to the file.'],
        ]));
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_order_tags');
        Schema::dropIfExists('tracker_tags');
    }
};

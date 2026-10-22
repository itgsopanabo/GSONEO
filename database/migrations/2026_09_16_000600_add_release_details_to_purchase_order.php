<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who released an order, and who collected it.
 *
 * Releasing set the status to 600 and nothing else, so the last step of the
 * pipeline — goods physically leaving the office — was the only one with no
 * accountability behind it. `released_at` was added with the stage timestamps;
 * these say who handed the items over and who signed for them.
 *
 * `released_to` is free text rather than a user: the person collecting is often
 * from the requesting department and has no account in this system.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->integer('released_by_emp_id')->nullable()->after('released_at');
            $table->string('released_to')->nullable()->after('released_by_emp_id');
            $table->string('released_to_department')->nullable()->after('released_to');
            $table->text('release_remarks')->nullable()->after('released_to_department');

            $table->foreign('released_by_emp_id')
                ->references('emp_id')
                ->on('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_order', function (Blueprint $table) {
            $table->dropForeign(['released_by_emp_id']);
            $table->dropColumn(['released_by_emp_id', 'released_to', 'released_to_department', 'release_remarks']);
        });
    }
};

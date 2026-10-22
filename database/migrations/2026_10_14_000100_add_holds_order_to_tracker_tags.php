<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether a tracker tag holds the order it is on.
 *
 * Every open tag stopped its order at its current stage. Some things worth
 * tracking should not — a reminder to file a copy, say — so each tag now says
 * whether it holds the order. Existing tags keep holding, as they did.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracker_tags', function (Blueprint $table) {
            $table->boolean('holds_order')->default(true)->after('color');
        });
    }

    public function down(): void
    {
        Schema::table('tracker_tags', function (Blueprint $table) {
            $table->dropColumn('holds_order');
        });
    }
};

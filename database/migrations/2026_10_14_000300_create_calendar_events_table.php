<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Events on the dashboard calendar: holidays, meetings, deadlines.
 *
 * Everyone sees them; holders of calendar.manage add, edit and remove them from
 * the calendar itself. An event without times is all-day; one without an end
 * date is a single day.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('calendar_events', function (Blueprint $table) {
            $table->id();
            $table->string('title', 120);
            $table->text('description')->nullable();
            // A key of App\Models\CalendarEvent::CATEGORIES.
            $table->string('category', 20)->default('activity');
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->integer('created_by_emp_id')->nullable();
            $table->integer('updated_by_emp_id')->nullable();
            $table->timestamps();

            $table->index(['starts_on', 'ends_on']);

            $table->foreign('created_by_emp_id')->references('emp_id')->on('users')->cascadeOnUpdate()->nullOnDelete();
            $table->foreign('updated_by_emp_id')->references('emp_id')->on('users')->cascadeOnUpdate()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_events');
    }
};

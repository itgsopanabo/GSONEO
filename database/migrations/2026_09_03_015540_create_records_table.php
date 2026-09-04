<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('record_classes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('title');
            $table->text('description')->nullable();

            // traceability back to the circular
            $table->string('rds_source', 50);          // GRDS-2009 | Agency RDS 2023
            $table->string('rds_item_no', 30);

            $table->unsignedSmallInteger('retention_years')->nullable();
            $table->string('retention_trigger', 40);   // creation | audit_settlement | asset_disposal | contract_completion
            $table->boolean('is_permanent')->default(false);
            $table->boolean('is_vital')->default(false);
            $table->string('sensitivity', 20)->default('internal')->index(); // public | internal | restricted

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['rds_source', 'rds_item_no']);
        });

        Schema::create('records', function (Blueprint $table) {
            $table->id();

            $table->foreignId('record_class_id')->constrained()->restrictOnDelete();

            $table->string('title');
            $table->string('reference_no', 100)->nullable()->index();
            $table->date('record_date');
            $table->string('originating_office');
            $table->string('custodian');

            $table->string('physical_location');
            $table->string('box_no', 50)->nullable();

            $table->date('retention_starts_on')->nullable();
            $table->date('eligible_for_disposal_on')->nullable()->index();

            $table->string('status', 30)->default('active')->index();
            // active | storage | for_disposal | disposed | transferred_to_nap

            $table->timestamp('archived_at')->nullable()->index();
            $table->string('archived_by', 20)->nullable()->index();

            // FK to users.emp_id deferred — column type / unique index mismatch.
            // Relationship is handled in the Record model via belongsTo(..., 'archived_by', 'emp_id').

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('records');          // child first
        Schema::dropIfExists('record_classes');   // then parent
    }
};

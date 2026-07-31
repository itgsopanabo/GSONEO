<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {

        Schema::create('purchase_requests', function (Blueprint $table) {
            $table->id();
            $table->string('pr_number')->unique();

            $table->text('requester_name');
            $table->text('requester_department');
            $table->date('needed_by_date')->nullable();
            $table->text('remarks_or_notes')->nullable();
            $table->text('reason_to_decline')->nullable();

            // CHANGE THIS TO INTEGER TO MATCH USERS TABLE
            $table->integer('verify_by_emp_id')->nullable();
            $table->integer('decline_by_emp_id')->nullable();

            $table->unsignedInteger('status')->default(0);
            $table->timestamps();
            $table->date('verified_At')->nullable();
            $table->date('declined_At')->nullable();

            // Foreign Key Constraints
            $table->foreign('verify_by_emp_id')
                ->references('emp_id')
                ->on('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->foreign('status')
                ->references('status_code')
                ->on('status')
                ->onDelete('restrict');
        });

        Schema::create('purchase_order', function (Blueprint $table) {
            $table->id();
            $table->string('PO_Number')->unique()->nullable();
            $table->string('PO_Supplier') ->nullable();
            $table->string('PO_Date')->nullable();
            $table->string('PR_Number')->unique();
            $table->date('supplier_receive_date')->nullable();
            $table->integer('poNumbered_by')->nullable();

            $table->string('RIS_Number')->nullable();
            $table->date('RIS_Date')->nullable();
            $table->integer('risNumbered_by')->nullable();

            // TODO Uncomment if needed
            $table->string('SSMI_Number')->nullable();
            $table->date('SSMI_Date')->nullable();
            $table->integer('ssmiNumbered_by')->nullable();


            $table->unsignedInteger('status');


            $table->foreign('status')
                ->references('status_code')
                ->on('status')
                ->onDelete('restrict');

            $table->foreign('PR_Number')->references('pr_number')->on('purchase_requests');

            $table->foreign('poNumbered_by')
                ->references('emp_id')
                ->on('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->foreign('risNumbered_by')
                ->references('emp_id')
                ->on('users')
                ->cascadeOnUpdate()
                ->nullOnDelete();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_requests');
        Schema::dropIfExists('purchase_order');

    }
};

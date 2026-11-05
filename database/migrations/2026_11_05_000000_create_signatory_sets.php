<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Signatories become named sets per document, instead of one fixed list.
 *
 * An IT request's IAR can then be signed by the IT inspectors and an
 * Engineering request's by Engineering, each with as many signers as it needs.
 * A set may be linked to requesting offices so their requests pick it
 * automatically; staff can still choose another set on a request.
 *
 * Each document gets a "Default" set holding the names saved on the old
 * Signatories screen (or the config defaults), so PDFs print as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('signatory_sets', function (Blueprint $table) {
            $table->id();
            $table->string('document', 40);
            $table->string('name', 80);
            $table->boolean('is_default')->default(false);
            $table->json('signers');            // [{label, name, position}, ...] in print order
            $table->json('fixed')->nullable();  // placements the layout keeps apart: {budget_officer: {name, position}}
            $table->timestamps();

            $table->unique(['document', 'name']);
        });

        Schema::create('department_signatory_set', function (Blueprint $table) {
            $table->foreignId('signatory_set_id')->constrained('signatory_sets')->cascadeOnDelete();
            $table->foreignId('department_id')->constrained('departments')->cascadeOnDelete();

            $table->primary(['signatory_set_id', 'department_id']);
        });

        // document => set id chosen for this request; a missing key means automatic.
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->json('signatory_set_ids')->nullable();
        });

        $saved = json_decode((string) DB::table('document_settings')->where('key', 'signatories')->value('value'), true) ?: [];
        $value = fn (string $document, string $slot, array $default, string $key, int $index) => (string) ($saved[$document][$slot][$key] ?? $default[$index]);

        foreach (config('documents.signatories') as $document => $definition) {
            $signers = collect($definition['signers'])->map(fn ($default, $slot) => [
                'label' => $default[0],
                'name' => $value($document, $slot, $default, 'name', 1),
                'position' => $value($document, $slot, $default, 'position', 2),
            ])->values()->all();

            $fixed = collect($definition['fixed'] ?? [])->map(fn ($default, $slot) => [
                'name' => $value($document, $slot, $default, 'name', 1),
                'position' => $value($document, $slot, $default, 'position', 2),
            ])->all();

            DB::table('signatory_sets')->insert([
                'document' => $document,
                'name' => 'Default',
                'is_default' => true,
                'signers' => json_encode($signers),
                'fixed' => $fixed ? json_encode($fixed) : null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('purchase_requests', function (Blueprint $table) {
            $table->dropColumn('signatory_set_ids');
        });
        Schema::dropIfExists('department_signatory_set');
        Schema::dropIfExists('signatory_sets');
    }
};

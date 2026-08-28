<?php

namespace Database\Seeders;

use App\Models\PurchaseRequest;
use App\Models\PurchaseRequestItem; // Ensure this is the correct Model
use Illuminate\Database\Seeder;

class PurchaseRequestSeeder extends Seeder
{


    public function run(): void
    {
        // 1. Create a PR with many items
        PurchaseRequest::factory()
            // Use the Model factory here, not the PurchaseRequestFactory
            ->has(PurchaseRequestItem::factory()->count(50), 'items')
            ->create([
                'pr_number' => 'PR-2026-LONG-001',
                'requester_name' => 'John Doe'
            ]);

        // 2. Create a PR with a short list
        PurchaseRequest::factory()
            ->has(PurchaseRequestItem::factory()->count(2), 'items')
            ->create([
                'pr_number' => 'PR-2026-SHORT-001',
                'requester_name' => 'Jane Smith'
            ]);

        // 3. Create a bulk batch
        PurchaseRequest::factory(5)
            ->has(PurchaseRequestItem::factory()->count(rand(1, 5)), 'items')
            ->create();
    }
}

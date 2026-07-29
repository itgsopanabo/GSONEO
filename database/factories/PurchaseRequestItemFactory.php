<?php

namespace Database\Factories;

use App\Models\Model;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Model>
 */
class PurchaseRequestItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    // In database/factories/PurchaseRequestItemFactory.php
    public function definition(): array
    {
        $quantity = fake()->numberBetween(1, 20);
        $unitCost = fake()->randomFloat(2, 100, 5000);

        return [
            'item_name' => fake()->word(),
            'item_desc' => fake()->sentence(),
            'quantity' => $quantity,
            'estimated_unit_cost' => $unitCost,
            'total_estimated_cost' => $quantity * $unitCost, // Calculate the total here
            'unit' => fake()->randomElement(['pcs', 'box', 'set', 'kg']),
        ];
    }
}

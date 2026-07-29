<?php

namespace Database\Factories;

use App\Models\PurchaseRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseRequest>
 * @method static factory()
 */
class PurchaseRequestFactory extends Factory
{

    protected $model = PurchaseRequest::class;


    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'pr_number' => fake()->unique()->bothify('PR-####'),
            'requester_name' => fake()->name(),
            'requester_department' => fake()->randomElement(['IT', 'HR', 'Operations', 'Finance']),
            'needed_by_date' => fake()->dateTimeBetween('now', '+1 month'),
        ];
    }
}

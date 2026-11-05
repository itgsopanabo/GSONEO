<?php

namespace Database\Factories;

use App\Models\Role;
use App\Models\Status;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state. Needs the role and status rows
     * (RoleSeeder, StatusSeeder); the account is active, on the first role.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'emp_id' => fake()->unique()->numberBetween(10000, 99999),
            'emp_fname' => fake()->firstName(),
            'emp_lname' => fake()->lastName(),
            'role_id' => fn () => Role::query()->value('id'),
            'status_id' => fn () => Status::where('status_code', config('Users.active_status_code'))->value('id'),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /** On a one-time password from an admin, working until the given time. */
    public function onTemporaryPassword(?\DateTimeInterface $expiresAt = null): static
    {
        return $this->state(fn (array $attributes) => [
            'temporary_password_expires_at' => $expiresAt ?? now()->addDay(),
        ]);
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}

<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {


        $this->call([
            DepartmentSeeder::class,
            RoleSeeder::class,
            StatusSeeder::class,
            PurchaseRequestSeeder::class,
        ]);

        User::create([
            'emp_fname' => 'John Fritz',
            'emp_lname' => 'Doe',
            'emp_id' => '32165',
            'password' => Hash::make('password123'),
            'role_id' => 1, // Set explicitly to 1
        ]);

        User::create([
            'emp_fname' => 'Marie Chris',
            'emp_lname' => 'Mary',
            'emp_id' => '6598',
            'password' => Hash::make('mariecris'),
            'role_id' => 4, // Set explicitly to 1
        ]);

        User::create([
            'emp_fname' => 'George West',
            'emp_lname' => 'Wilson',
            'emp_id' => '7418',
            'password' => Hash::make('west2025'),
            'role_id' => 6, // Set explicitly to 1
        ]);
    }
}

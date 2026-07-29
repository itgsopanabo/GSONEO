<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StatusSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $statuses = [
            // Workflow (PR Pipeline)
            ['status_code' => 0, 'status_desc' => 'Pending', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 100, 'status_desc' => 'Verified', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 200, 'status_desc' => 'Canvassing', 'created_at' => now(), 'updated_at' => now()],

            ['status_code' => 210, 'status_desc' => 'Proceed to PO', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 220, 'status_desc' => 'PO Proceedings', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 230, 'status_desc' => 'PO Generated', 'created_at' => now(), 'updated_at' => now()],

            ['status_code' => 300, 'status_desc' => 'For Inspection', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 400, 'status_desc' => 'For RIS', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 500, 'status_desc' => 'For SSMI', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 550, 'status_desc' => 'For Outgoing', 'created_at' => now(), 'updated_at' => now()],

            ['status_code' => 600, 'status_desc' => 'Completed', 'created_at' => now(), 'updated_at' => now()],

            ['status_code' => 700, 'status_desc' => 'Rejected', 'created_at' => now(), 'updated_at' => now()],

            // Account State
            ['status_code' => 900, 'status_desc' => 'Active', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 901, 'status_desc' => 'Inactive', 'created_at' => now(), 'updated_at' => now()],
            ['status_code' => 902, 'status_desc' => 'Locked', 'created_at' => now(), 'updated_at' => now()],
        ];
        // Correct Upsert syntax configuration:
        // Parameter 1: The data dataset array
        // Parameter 2: The exact UNIQUE column to target conflict constraints against
        // Parameter 3: The columns to update if a collision match is found
        DB::table('status')->upsert(
            $statuses,
            ['status_code'],              // This MUST match a unique identifier index column
            ['status_desc', 'updated_at'] // Updates the label description text if changed
        );
    }
}

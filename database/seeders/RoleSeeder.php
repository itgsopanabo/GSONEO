<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Using an associative array lets you keep clean slugs for code
        // while preserving your exact formatting for the display name.
        $roles = [
            ['role_name' => 'Superadmin', 'section' => 'Administration'],
            ['role_name' => 'Department Head', 'section' => 'Administration'],

            // Procurement Group

            ['role_name' => 'Section Head', 'section' => 'Procurement'],
            ['role_name' => 'PR Verifier', 'section' => 'Procurement'],
            ['role_name' => 'PO Officer', 'section' => 'Procurement'],
            ['role_name' => 'Canvas Officer', 'section' => 'Procurement'],
            ['role_name' => 'PO Receiver', 'section' => 'Procurement'],

            // Motor Pool Group
            ['role_name' => 'Dispatcher', 'section' => 'Motor Pool'],
            ['role_name' => 'Fleet Manager', 'section' => 'Motor Pool'],
            ['role_name' => 'Section Head', 'section' => 'Motor Pool'],


            // Inventory & Sales Group
            ['role_name' => 'Section Head', 'section' => 'Inventory and Sales'],
            ['role_name' => 'Encoder(RIS)', 'section' => 'Inventory and Sales'],
            ['role_name' => 'Encoder(SSMI)', 'section' => 'Inventory and Sales'],
            ['role_name' => 'Encoder(IAR)', 'section' => 'Inventory and Sales'],

            // Records Group

            ['role_name' => 'Section Head', 'section' => 'Records (Archives)'],
            ['role_name' => 'Verifier', 'section' => 'Records (Archives)'],
            ['role_name' => 'Approver', 'section' => 'Records (Archives)']

        ];

        // Checks 'role_name' to see if it exists. If it does, it updates
        // the timestamps instead of inserting a duplicate row.
        DB::table('role')->upsert(
            $roles,
            ['role_name'], // Unique identifier to check against
            ['updated_at'] // Columns to update if it already exists
        );
    }
}

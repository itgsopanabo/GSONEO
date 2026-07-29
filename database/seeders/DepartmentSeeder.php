<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DepartmentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {

// 1. Define the department data with abbreviations (Department_Code)
        $departments = [
            ['Department_Name' => 'City General Services Office', 'Department_Code' => 'CGSO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Human Resource Management Office', 'Department_Code' => 'CHRMRO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Budget Office', 'Department_Code' => 'CBO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Mayors Office', 'Department_Code' => 'CMO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Administrator Office', 'Department_Code' => 'CADO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'Sanguniang Panlungsod Office', 'Department_Code' => 'SPO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Planning Development Office', 'Department_Code' => 'CPDO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Civil Registrar Office', 'Department_Code' => 'CCRO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Accounting Office', 'Department_Code' => 'C privatisation O', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Treasury Office', 'Department_Code' => 'CTO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Assessors Office', 'Department_Code' => 'CASSO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Legal Office', 'Department_Code' => 'CLO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Health Office', 'Department_Code' => 'CHO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Social Welfare and Development Office', 'Department_Code' => 'CSWDO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Agriculture Office', 'Department_Code' => 'CAGRO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Environment and Natural Resources Office', 'Department_Code' => 'CENRO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Public Employment Services Office', 'Department_Code' => 'PESO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Disaster Risk Reduction Management Office', 'Department_Code' => 'CDRRMO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Engineering Office', 'Department_Code' => 'CEO', 'updated_at' => now(), 'created_at' => now()],
            ['Department_Name' => 'City Economic Enterprise Management Development Office', 'Department_Code' => 'CEEMDO', 'updated_at' => now(), 'created_at' => now()],
        ];

// 2. Perform the upsert
        DB::table('departments')->upsert(
            $departments,
            ['Department_Code'],                 // Unique constraint: checks if the abbreviation Department_Code already exists
            ['Department_Name', 'updated_at']    // If Department_Code exists, update the full Department_Name and timestamp
        );
    }
}

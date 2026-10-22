<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The one-off correction for timestamps written while the app ran on UTC.
 *
 * The application was set to UTC on a +08:00 site, so a request filed at 1:31 PM
 * was stored — and shown — as 5:31 AM. config/app.php now says Asia/Manila and
 * the database session +08:00; this brings what is already stored into line.
 *
 * Only DATETIME columns are touched, and that distinction matters:
 *
 *   DATETIME   timezone-blind. It holds the literal UTC wall clock that was
 *              written, so it needs the eight hours added.
 *   TIMESTAMP  every created_at / updated_at, audit_log.created_at,
 *              records.archived_at. MySQL keeps these as UTC instants and
 *              converts them on read, so the session change alone fixes them.
 *              Shifting them as well would move them eight hours too far.
 *   DATE       record_date and the retention dates: no time to correct.
 *
 * Deploy the code and run this together. Anything written in between is stored
 * as Manila time already and would be pushed forward wrongly — at that rate a
 * few minutes of records, which the down() reverses if it happens.
 */
return new class extends Migration
{
    private const HOURS = 8;

    /** table => the DATETIME columns on it. */
    private const COLUMNS = [
        'purchase_requests' => ['verified_At', 'encoded_at', 'declined_At', 'cancelled_at'],
        'purchase_order' => ['PO_Date', 'RIS_Date', 'SSMI_Date', 'released_at', 'cancelled_at'],
    ];

    public function up(): void
    {
        $this->shift(self::HOURS);
    }

    public function down(): void
    {
        $this->shift(-self::HOURS);
    }

    /**
     * One statement per table, every column at once: fewer passes, and any
     * column with ON UPDATE CURRENT_TIMESTAMP is written explicitly rather than
     * being quietly reset by the write.
     */
    private function shift(int $hours): void
    {
        foreach (self::COLUMNS as $table => $columns) {
            $present = array_values(array_filter(
                $columns,
                fn (string $column) => Schema::hasColumn($table, $column),
            ));

            if ($present === []) {
                continue;
            }

            // Exact midnight means a date was recorded without a time — PO_Date is
            // written as `now()->format('Y-m-d')` — and the timeline prints those as
            // a bare date. Shifting them would invent an 8:00 AM that never happened
            // and turn every PO date into a timestamp. The cost is that a real event
            // at exactly 00:00:00 keeps the old zone; that is one record at worst.
            $assignments = implode(', ', array_map(
                fn (string $column) => "`{$column}` = IF(TIME(`{$column}`) = '00:00:00', `{$column}`, DATE_ADD(`{$column}`, INTERVAL {$hours} HOUR))",
                $present,
            ));

            $notNull = implode(' OR ', array_map(
                fn (string $column) => "`{$column}` IS NOT NULL",
                $present,
            ));

            DB::statement("UPDATE `{$table}` SET {$assignments} WHERE {$notNull}");
        }
    }
};

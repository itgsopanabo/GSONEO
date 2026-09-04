<?php

namespace App\Http\Controllers;

use App\Models\PurchaseRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class RequestMonitoringController extends Controller
{
    /**
     * Every stage that can appear on a request's timeline.
     *
     * Each entry names the date column that marks the stage and the column
     * holding the emp_id of whoever performed it. Stages whose columns don't
     * exist in the live schema are dropped at runtime, so the canvass stages
     * appear only if those columns were actually migrated.
     */
    private const PR_STAGES = [
        ['key' => 'created',         'label' => 'Request created',    'date' => 'created_at',      'actor' => null],
        ['key' => 'encoded',         'label' => 'Encoded',            'date' => 'encoded_at',      'actor' => 'encoded_by'],
        ['key' => 'verified',        'label' => 'Verified',           'date' => 'verified_At',     'actor' => 'verify_by_emp_id'],
        ['key' => 'declined',        'label' => 'Declined',           'date' => 'declined_At',     'actor' => 'decline_by_emp_id'],
        ['key' => 'canvass_started', 'label' => 'Canvassing started', 'date' => 'canvas_start_At', 'actor' => 'canvas_started_by_emp_id'],
        ['key' => 'canvass_ended',   'label' => 'Canvassing ended',   'date' => 'canvas_end_At',   'actor' => 'canvas_ended_by_emp_id'],
    ];

    private const PO_STAGES = [
        ['key' => 'po_numbered',       'label' => 'PO numbered',       'date' => 'PO_Date',               'actor' => 'poNumbered_by'],
        ['key' => 'supplier_received', 'label' => 'Supplier received', 'date' => 'supplier_receive_date', 'actor' => null],
        ['key' => 'ris',               'label' => 'RIS issued',        'date' => 'RIS_Date',              'actor' => 'risNumbered_by'],
        ['key' => 'ssmi',              'label' => 'SSMI issued',       'date' => 'SSMI_Date',             'actor' => 'ssmiNumbered_by'],
    ];

    /**
     * Monitoring dashboard: KPIs, status breakdowns, stage durations, and a
     * filterable list of every request with its current position in the flow.
     */
    public function index(Request $request)
    {
        $filters = $request->only(['search', 'status', 'department', 'from', 'to']);

        $requests = $this->baseQuery()
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($q) use ($search) {
                    $q->where('pr.pr_number', 'like', "%{$search}%")
                        ->orWhere('pr.requester_name', 'like', "%{$search}%")
                        ->orWhere('po.PO_Number', 'like', "%{$search}%")
                        ->orWhere('po.PO_Supplier', 'like', "%{$search}%");
                });
            })
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('pr.status', $status))
            ->when(
                $filters['department'] ?? null,
                fn ($q, $dept) => $q->whereRaw('LOWER(TRIM(pr.requester_department)) = ?', [mb_strtolower(trim($dept))])
            )
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('pr.created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('pr.created_at', '<=', $to))
            ->orderByDesc('pr.created_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('analytics/RequestMonitoring', [
            'requests'      => $requests,
            'summary'       => $this->summary(),
            'prStatuses'    => $this->statusBreakdown('purchase_requests'),
            'poStatuses'    => $this->statusBreakdown('purchase_order'),
            'stageAverages' => $this->stageAverages(),
            'departments'   => $this->departments(),
            'statusOptions' => DB::table('status')->orderBy('status_code')
                ->get(['status_code', 'status_desc']),
            'filters'       => $filters,
        ]);
    }

    /**
     * One request, end to end: every stage with who did it and when.
     */
    public function show(string $id)
    {
        $pr = PurchaseRequest::with(['items'])->findOrFail($id);

        $po = DB::table('purchase_order')
            ->where('PR_Number', $pr->pr_number)
            ->first();

        return Inertia::render('analytics/RequestTimeline', [
            'request'   => $pr,
            'po'        => $po,
            'timeline'  => $this->buildTimeline($pr, $po),
            'status'    => DB::table('status')->where('status_code', $pr->status)->first(),
            'ageInDays' => $pr->created_at?->diffInDays(now()),
        ]);
    }

    // ------------------------------------------------------------------
    // Query building
    // ------------------------------------------------------------------

    /**
     * PR-first so requests without a PO still appear. Those are the ones
     * sitting in verification or canvassing, which is the point of the view.
     */
    private function baseQuery()
    {
        return DB::table('purchase_requests as pr')
            ->leftJoin('purchase_order as po', 'po.PR_Number', '=', 'pr.pr_number')
            ->leftJoin('status as prs', 'prs.status_code', '=', 'pr.status')
            ->leftJoin('status as pos', 'pos.status_code', '=', 'po.status')
            ->leftJoin('users as v', 'v.emp_id', '=', 'pr.verify_by_emp_id')
            ->select([
                'pr.id',
                'pr.pr_number',
                'pr.requester_name',
                'pr.requester_department',
                'pr.mode_of_procurement',
                'pr.status as pr_status_code',
                'prs.status_desc as pr_status',
                'pr.created_at',
                'pr.verified_At',
                'pr.declined_At',
                'po.PO_Number',
                'po.PO_Date',
                'po.PO_Supplier',
                'po.RIS_Number',
                'po.status as po_status_code',
                'pos.status_desc as po_status',
                DB::raw("CONCAT(COALESCE(v.emp_fname, ''), ' ', COALESCE(v.emp_lname, '')) as verified_by"),
                // Hours, not days, so a request filed this morning doesn't read as 0.
                DB::raw('TIMESTAMPDIFF(HOUR, pr.created_at, NOW()) as age_hours'),
            ]);
    }

    private function summary(): array
    {
        $row = DB::table('purchase_requests as pr')
            ->leftJoin('purchase_order as po', 'po.PR_Number', '=', 'pr.pr_number')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN pr.verified_At IS NOT NULL THEN 1 ELSE 0 END) as verified')
            ->selectRaw('SUM(CASE WHEN pr.declined_At IS NOT NULL THEN 1 ELSE 0 END) as declined')
            ->selectRaw('SUM(CASE WHEN po.id IS NULL THEN 1 ELSE 0 END) as without_po')
            ->selectRaw('SUM(CASE WHEN po.PO_Number IS NOT NULL THEN 1 ELSE 0 END) as with_po')
            ->selectRaw('SUM(CASE WHEN po.RIS_Number IS NOT NULL THEN 1 ELSE 0 END) as with_ris')
            ->first();

        // Requests that have gone nowhere in two weeks and aren't closed out.
        $stalled = DB::table('purchase_requests as pr')
            ->leftJoin('purchase_order as po', 'po.PR_Number', '=', 'pr.pr_number')
            ->whereNull('pr.declined_At')
            ->whereNull('po.PO_Number')
            ->whereRaw('pr.created_at < NOW() - INTERVAL 14 DAY')
            ->count();

        return (array) $row + ['stalled' => $stalled];
    }

    /**
     * Counts per status. Inner join, because PR and PO share the status table
     * with users — a right join would list user statuses at zero.
     */
    private function statusBreakdown(string $table)
    {
        return DB::table("{$table} as t")
            ->join('status as s', 's.status_code', '=', 't.status')
            ->groupBy('s.status_code', 's.status_desc')
            ->orderBy('s.status_code')
            ->get([
                's.status_code',
                's.status_desc',
                DB::raw('COUNT(t.id) as total'),
            ]);
    }

    /**
     * Average time spent between consecutive stages — where the bottleneck is.
     *
     * Measured in minutes and converted, so sub-day durations survive. Rows
     * created before the timestamp migration carry a midnight time, so their
     * durations are still effectively day-precision.
     */
    private function stageAverages(): array
    {
        $pairs = [
            'Created to verified'      => ['purchase_requests', 'created_at', 'verified_At', null],
            'Verified to PO numbered'  => ['purchase_requests', 'verified_At', 'PO_Date', 'purchase_order'],
            'PO to supplier received'  => ['purchase_order', 'PO_Date', 'supplier_receive_date', null],
            'Supplier received to RIS' => ['purchase_order', 'supplier_receive_date', 'RIS_Date', null],
        ];

        $out = [];

        foreach ($pairs as $label => [$table, $start, $end, $joinTable]) {
            $endTable = $joinTable ?? $table;

            if (! Schema::hasColumn($table, $start) || ! Schema::hasColumn($endTable, $end)) {
                continue;
            }

            $q = DB::table("{$table} as a");

            if ($joinTable) {
                $q->join("{$joinTable} as b", 'b.PR_Number', '=', 'a.pr_number');
                $endExpr = "b.{$end}";
            } else {
                $endExpr = "a.{$end}";
            }

            $row = $q->whereNotNull("a.{$start}")
                ->whereNotNull($endExpr)
                ->selectRaw("AVG(TIMESTAMPDIFF(MINUTE, a.{$start}, {$endExpr})) as avg_minutes")
                ->selectRaw("MAX(TIMESTAMPDIFF(MINUTE, a.{$start}, {$endExpr})) as max_minutes")
                ->selectRaw('COUNT(*) as sample')
                ->first();

            $out[] = [
                'stage'       => $label,
                'avg_minutes' => $row->avg_minutes !== null ? (int) round((float) $row->avg_minutes) : null,
                'max_minutes' => $row->max_minutes !== null ? (int) $row->max_minutes : null,
                'sample'      => (int) $row->sample,
            ];
        }

        return $out;
    }

    /**
     * requester_department is free text, so fold case and whitespace to stop
     * "GSO" and "gso " showing up as two departments.
     *
     * MIN() rather than a bare TRIM() because only_full_group_by rejects a
     * selected column that isn't provably one value per group.
     */
    private function departments()
    {
        return DB::table('purchase_requests')
            ->selectRaw('MIN(TRIM(requester_department)) as name, COUNT(*) as total')
            ->whereNotNull('requester_department')
            ->whereRaw("TRIM(requester_department) <> ''")
            ->groupByRaw('LOWER(TRIM(requester_department))')
            ->orderByDesc('total')
            ->get();
    }

    // ------------------------------------------------------------------
    // Timeline
    // ------------------------------------------------------------------

    /**
     * Assembled from the *_At / *_by column pairs on the rows themselves,
     * so it works whether or not an action wrote an audit log entry.
     */
    private function buildTimeline(PurchaseRequest $pr, ?object $po): array
    {
        $events = [];

        foreach (self::PR_STAGES as $stage) {
            if (! Schema::hasColumn('purchase_requests', $stage['date'])) {
                continue;
            }
            $events[] = $this->makeEvent($pr, $stage, 'Purchase Request');
        }

        if ($po) {
            foreach (self::PO_STAGES as $stage) {
                if (! Schema::hasColumn('purchase_order', $stage['date'])) {
                    continue;
                }
                $events[] = $this->makeEvent($po, $stage, 'Purchase Order');
            }
        }

        $events = array_values(array_filter($events));

        // Resolve every actor in one query rather than per row.
        $names = $this->resolveNames(array_filter(array_column($events, 'actor_emp_id')));

        foreach ($events as &$event) {
            $event['actor_name'] = $event['actor_emp_id']
                ? ($names[$event['actor_emp_id']] ?? "Unknown (emp_id {$event['actor_emp_id']})")
                : null;
        }
        unset($event);

        usort($events, fn ($a, $b) => strcmp((string) $a['date'], (string) $b['date']));

        return $events;
    }

    private function makeEvent(object $row, array $stage, string $source): ?array
    {
        $date = $row->{$stage['date']} ?? null;

        if (empty($date)) {
            return null;   // stage hasn't happened yet
        }

        // Carbon on the model, raw string on the DB row — normalise both, and
        // keep the time so the frontend can tell midnight from a real hour.
        $iso = $date instanceof \DateTimeInterface
            ? $date->format('Y-m-d H:i:s')
            : (string) $date;

        return [
            'key'          => $stage['key'],
            'label'        => $stage['label'],
            'source'       => $source,
            'date'         => $iso,
            'actor_emp_id' => $stage['actor'] ? ($row->{$stage['actor']} ?? null) : null,
        ];
    }

    private function resolveNames(array $empIds): array
    {
        if (empty($empIds)) {
            return [];
        }

        return DB::table('users')
            ->whereIn('emp_id', array_unique($empIds))
            ->get(['emp_id', 'emp_fname', 'emp_lname'])
            ->mapWithKeys(fn ($u) => [
                $u->emp_id => trim("{$u->emp_fname} {$u->emp_lname}"),
            ])
            ->all();
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\IAR;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderTag;
use App\Models\PurchaseRequest;
use App\Services\ProcurementCancellation;
use App\Services\ProcurementStatusChange;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

class RequestMonitoringController extends Controller
{
    public function __construct(
        private readonly ProcurementCancellation $cancellation,
        private readonly ProcurementStatusChange $statuses,
    ) {}

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
        ['key' => 'cancelled',       'label' => 'Cancelled',          'date' => 'cancelled_at',    'actor' => 'cancelled_by_emp_id'],
        ['key' => 'canvass_started', 'label' => 'Canvassing started', 'date' => 'canvas_start_At', 'actor' => 'canvas_started_by_emp_id'],
        ['key' => 'canvass_ended',   'label' => 'Canvassing ended',   'date' => 'canvas_end_At',   'actor' => 'canvas_ended_by_emp_id'],
    ];

    private const PO_STAGES = [
        ['key' => 'po_numbered',       'label' => 'PO numbered',       'date' => 'PO_Date',               'actor' => 'poNumbered_by'],
        // supplier_receive_date never existed as a column, so this stage never showed.
        ['key' => 'received',          'label' => 'Delivery accepted', 'date' => 'received_at',           'actor' => 'received_by_emp_id'],
        ['key' => 'ris',               'label' => 'RIS issued',        'date' => 'RIS_Date',              'actor' => 'risNumbered_by'],
        ['key' => 'ssmi',              'label' => 'SSMI issued',       'date' => 'SSMI_Date',             'actor' => 'ssmiNumbered_by'],
        ['key' => 'released',          'label' => 'Released',          'date' => 'released_at',           'actor' => 'released_by_emp_id'],
        ['key' => 'po_cancelled',      'label' => 'Order cancelled',   'date' => 'cancelled_at',          'actor' => 'cancelled_by_emp_id'],
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
                        ->orWhere('po.PO_Number', 'like', "%{$search}%")
                        ->orWhere('po.PO_Supplier', 'like', "%{$search}%");
                });
            })
            // The status the row shows: the order's once the request has reached PO
            // generated (230), the request's own before that. Filtering on pr.status
            // alone matched nothing for any inventory status — For Inspection,
            // RIS, SSMI, Outgoing, Completed — since the request stays at 230.
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->whereRaw(
                '(CASE WHEN pr.status = 230 AND po.status IS NOT NULL THEN po.status ELSE pr.status END) = ?',
                [$status],
            ))
            ->when(
                $filters['department'] ?? null,
                fn ($q, $dept) => $q->whereRaw('LOWER(TRIM(pr.requester_department)) = ?', [mb_strtolower(trim($dept))])
            )
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('pr.created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('pr.created_at', '<=', $to))
            ->orderByDesc('pr.created_at')
            ->paginate(20)
            ->withQueryString();

        // What may be cancelled and where each record may be moved, decided by the
        // same services the routes use, so a button never offers something the
        // request would then refuse. The IAR question is answered once for the
        // whole page rather than per row.
        $withIar = DB::table('iar')
            ->whereIn('PO_Number', array_filter(array_column($requests->items(), 'PO_Number')))
            ->pluck('PO_Number')
            ->all();

        $requests->through(fn ($row) => $this->withAdminActions($row, $withIar));

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
        $po = PurchaseOrder::where('PR_Number', $pr->pr_number)->first();
        $po?->setRelation('purchaseRequest', $pr);

        return Inertia::render('analytics/RequestTimeline', [
            'request'   => $pr,
            'po'        => $po,
            'timeline'  => $this->buildTimeline($pr, $po),
            // A request still in verification or canvassing has no order yet, so the
            // status shown is the request's own.
            'status'    => DB::table('status')->where('status_code', $po->status ?? $pr->status)->first(),
            'ageInDays' => $pr->created_at?->diffInDays(now()),
            'cancellation' => [
                'requestRefusal' => $this->cancellation->requestRefusal($pr),
                'orderRefusal'   => $this->cancellation->orderRefusal($po),
            ],
            'statusOptions' => $this->statuses->options($pr, $po),
        ]);
    }

    /**
     * Attach the administrative actions for this row: what may be cancelled, as
     * the reason it may not — or null — and every status it could be moved to.
     *
     * The rows are plain objects from the query builder, so the models here are
     * unsaved stand-ins carrying just the columns the rules read.
     *
     * @param  array<int, string>  $withIar  PO numbers that already have an IAR
     */
    private function withAdminActions(object $row, array $withIar): object
    {
        $pr = new PurchaseRequest(['status' => $row->pr_status_code, 'pr_number' => $row->pr_number]);

        $po = $row->po_id
            ? new PurchaseOrder([
                'status' => $row->po_status_code,
                'PO_Number' => $row->PO_Number,
                'PR_Number' => $row->pr_number,
                'RIS_Number' => $row->RIS_Number,
                'SSMI_Number' => $row->SSMI_Number,
            ])
            : null;

        $po?->setRelation('purchaseRequest', $pr);

        $row->cancel_request_refusal = $this->cancellation->requestRefusal($pr);
        $row->cancel_order_refusal = $this->cancellation->orderRefusal($po);
        $row->status_options = $this->statuses->options($pr, $po, in_array($row->PO_Number, $withIar, true));

        return $row;
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
                'pr.requester_department',
                'pr.mode_of_procurement',
                'pr.status as pr_status_code',
                'prs.status_desc as pr_status',
                'pr.created_at',
                'pr.verified_At',
                'pr.declined_At',
                'po.id as po_id',
                'po.PO_Number',
                'po.PO_Date',
                'po.PO_Supplier',
                'po.RIS_Number',
                'po.SSMI_Number',
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
    /**
     * The pipeline end to end: how long each hand-off takes, and the whole run.
     *
     * Every boundary is a timestamp already written by the step that performed it,
     * so a stage can only be measured where both of its ends were recorded:
     *
     *   created_at, verified_At   purchase request
     *   PO_Date, RIS_Date, SSMI_Date, released_at   purchase order
     *   created_at                the first IAR raised against the order
     *
     * Canvassing is inside "Verified to PO" rather than a stage of its own —
     * nothing records when canvassing starts or ends.
     *
     * One row per stage, all measured in a single pass: TIMESTAMPDIFF is null when
     * either end is missing, and AVG, MAX and COUNT all skip nulls, so incomplete
     * records simply don't count towards the stage they haven't reached. Negative
     * spans — which a backwards status change can leave behind — are dropped too,
     * rather than being averaged into nonsense.
     */
    private const STAGES = [
        ['key' => 'created_verified', 'label' => 'Created to verified',  'from' => 'pr.created_at',  'to' => 'pr.verified_At'],
        ['key' => 'verified_po',      'label' => 'Verified to PO',       'from' => 'pr.verified_At', 'to' => 'po.PO_Date'],
        ['key' => 'po_iar',           'label' => 'PO to IAR',            'from' => 'po.PO_Date',     'to' => 'iar.first_iar'],
        ['key' => 'iar_ris',          'label' => 'IAR to RIS',           'from' => 'iar.first_iar',  'to' => 'po.RIS_Date'],
        ['key' => 'ris_ssmi',         'label' => 'RIS to SSMI',          'from' => 'po.RIS_Date',    'to' => 'po.SSMI_Date'],
        ['key' => 'ssmi_released',    'label' => 'SSMI to released',     'from' => 'po.SSMI_Date',   'to' => 'po.released_at'],
        ['key' => 'end_to_end',       'label' => 'Created to completed', 'from' => 'pr.created_at',  'to' => 'po.released_at', 'overall' => true],
    ];

    private function stageAverages(): array
    {
        $query = DB::table('purchase_requests as pr')
            ->leftJoin('purchase_order as po', 'po.PR_Number', '=', 'pr.pr_number')
            // The first IAR: an order may have several, one per partial delivery.
            ->leftJoinSub(
                DB::table('iar')->select('PO_Number')->selectRaw('MIN(created_at) as first_iar')->groupBy('PO_Number'),
                'iar',
                'iar.PO_Number',
                '=',
                'po.PO_Number',
            );

        $measurable = [];

        foreach (self::STAGES as $stage) {
            if (! $this->columnExists($stage['from']) || ! $this->columnExists($stage['to'])) {
                continue;
            }

            $measurable[] = $stage;
            $span = "CASE WHEN TIMESTAMPDIFF(MINUTE, {$stage['from']}, {$stage['to']}) >= 0
                          THEN TIMESTAMPDIFF(MINUTE, {$stage['from']}, {$stage['to']}) END";

            $query->selectRaw("AVG({$span}) as {$stage['key']}_avg")
                ->selectRaw("MAX({$span}) as {$stage['key']}_max")
                ->selectRaw("COUNT({$span}) as {$stage['key']}_sample");
        }

        $row = $measurable ? $query->first() : null;

        return array_map(fn (array $stage) => [
            'key'         => $stage['key'],
            'stage'       => $stage['label'],
            'overall'     => $stage['overall'] ?? false,
            'avg_minutes' => $row?->{$stage['key'].'_avg'} !== null ? (int) round((float) $row->{$stage['key'].'_avg'}) : null,
            'max_minutes' => $row?->{$stage['key'].'_max'} !== null ? (int) $row->{$stage['key'].'_max'} : null,
            'sample'      => (int) ($row?->{$stage['key'].'_sample'} ?? 0),
        ], $measurable);
    }

    /** `alias.column` against the table that alias stands for. */
    private function columnExists(string $qualified): bool
    {
        [$alias, $column] = explode('.', $qualified);

        // The IAR timestamp is produced by the subquery above, not a column of its own.
        return match ($alias) {
            'pr' => Schema::hasColumn('purchase_requests', $column),
            'po' => Schema::hasColumn('purchase_order', $column),
            'iar' => Schema::hasColumn('iar', 'created_at'),
            default => false,
        };
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

        if ($po?->PO_Number) {
            array_push($events, ...$this->inspectionEvents($po), ...$this->missingTagEvents($po));
        }

        // Resolve every actor in one query rather than per row.
        $names = $this->resolveNames(array_filter(array_column($events, 'actor_emp_id')));

        foreach ($events as &$event) {
            $event['actor_name'] = $event['actor_emp_id']
                ? ($names[$event['actor_emp_id']] ?? "Unknown (emp_id {$event['actor_emp_id']})")
                : null;
        }
        unset($event);

        return $this->inOrder($events);
    }

    /**
     * Events in the order they happened.
     *
     * Some stamps carry a date but no time — exactly midnight, see the timeline
     * page — so sorting them as 00:00 would put "PO numbered" before the request
     * was even created. Events arrive in pipeline order, so one with no time is
     * placed just after the stage before it on the same day instead.
     */
    private function inOrder(array $events): array
    {
        $lastReal = null;

        foreach ($events as $i => &$event) {
            $date = (string) $event['date'];
            $dateOnly = str_ends_with($date, ' 00:00:00');

            if ($dateOnly && $lastReal && str_starts_with($lastReal, substr($date, 0, 10))) {
                $event['sort'] = $lastReal;
            } else {
                $event['sort'] = $date;
                if (! $dateOnly) {
                    $lastReal = max($lastReal ?? '', $date);
                }
            }
            $event['index'] = $i;
        }
        unset($event);

        usort($events, fn ($a, $b) => [$a['sort'], $a['index']] <=> [$b['sort'], $b['index']]);

        return array_map(fn ($event) => array_diff_key($event, ['sort' => true, 'index' => true]), $events);
    }

    /**
     * Each IAR on the order: a delivery inspected, and whether it was the whole
     * order or part of it. IARs record no actor, so none is shown.
     */
    private function inspectionEvents(object $po): array
    {
        return IAR::where('PO_Number', $po->PO_Number)
            ->orderBy('id')
            ->get(['id', 'iar_number', 'invoice_number', 'delivery_status', 'created_at'])
            ->map(fn (IAR $iar) => [
                'key' => "iar-{$iar->id}",
                'label' => "Inspected under {$iar->iar_number}",
                'detail' => trim(($iar->delivery_status ? ucfirst($iar->delivery_status).' delivery' : '')
                    .($iar->invoice_number ? " · invoice {$iar->invoice_number}" : ''), ' ·'),
                'source' => 'Inspection',
                'date' => $iar->created_at?->format('Y-m-d H:i:s'),
                'actor_emp_id' => null,
            ])
            ->all();
    }

    /** Each missing tag raised on the order, and when it was resolved. */
    private function missingTagEvents(object $po): array
    {
        $events = [];

        $tags = PurchaseOrderTag::with('tag:id,name')
            ->where('purchase_order_id', $po->id)
            ->orderBy('id')
            ->get();

        foreach ($tags as $entry) {
            $name = $entry->tag?->name ?? 'Missing item';

            $events[] = [
                'key' => "tag-{$entry->id}",
                'label' => "Tagged: {$name}",
                'detail' => $entry->note,
                'source' => 'Missing',
                'date' => $entry->created_at?->format('Y-m-d H:i:s'),
                'actor_emp_id' => $entry->tagged_by_emp_id,
            ];

            if ($entry->resolved_at) {
                $events[] = [
                    'key' => "tag-{$entry->id}-resolved",
                    'label' => "Resolved: {$name}",
                    'detail' => $entry->resolution_note,
                    'source' => 'Resolved',
                    'date' => $entry->resolved_at->format('Y-m-d H:i:s'),
                    'actor_emp_id' => $entry->resolved_by_emp_id,
                ];
            }
        }

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

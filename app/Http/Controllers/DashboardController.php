<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\CalendarEvent;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderTag;
use App\Models\PurchaseRequest;
use App\Models\Records;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /** Purchase request stages, in workflow order (purchase_requests.status). */
    private const PR_STAGES = [
        ['label' => 'Draft', 'statuses' => [0]],
        ['label' => 'Pending verification', 'statuses' => [1]],
        ['label' => 'Verified', 'statuses' => [100, 110, 120, 130]],
        ['label' => 'Canvassing', 'statuses' => [200]],
        ['label' => 'Canvass printed', 'statuses' => [205]],
        ['label' => 'Awaiting PO', 'statuses' => [210]],
        ['label' => 'PO generated', 'statuses' => [230]],
    ];

    /** Purchase order stages, in workflow order (purchase_order.status). */
    private const PO_STAGES = [
        ['label' => 'Awaiting PO number', 'statuses' => [200, 210]],
        ['label' => 'Incoming delivery', 'statuses' => [230]],
        ['label' => 'For inspection (IAR)', 'statuses' => [300]],
        ['label' => 'For RIS', 'statuses' => [400]],
        ['label' => 'For SSMI', 'statuses' => [500]],
        ['label' => 'For release', 'statuses' => [550]],
        ['label' => 'Completed', 'statuses' => [600]],
    ];

    private const PR_REJECTED = 700;

    /** Records due within this many days count as "due soon". */
    private const DISPOSAL_WINDOW_DAYS = 90;

    private const QUEUE_LIMIT = 8;

    private const TREND_MONTHS = 12;

    public function index(): Response
    {
        $user = Auth::user()->loadMissing('role');

        // Permissions come from the user's role (Roles & permissions screen).
        $permissions = $user->permissionNames();
        $can = fn (string|array|null $needed): bool => $needed === null
            || count(array_intersect((array) $needed, $permissions)) > 0;

        $widgets = collect(config('dashboard.widgets'))
            ->filter(fn ($rule) => $this->widgetAllowed($rule, $can))
            ->keys();

        // Only selected widgets get queried, so a role without 'dashboard.procurement'
        // never runs the all-PRs query and those rows never reach the browser.
        $widgetData = $widgets->mapWithKeys(
            fn (string $key) => [$key => $this->dataFor($key, $can)]
        );

        // Drop widgets that came back empty and have nothing useful to say
        // when empty, so they don't leave a hole in the grid.
        $hideWhenEmpty = config('dashboard.hide_when_empty', []);
        $widgets = $widgets->reject(function (string $key) use ($widgetData, $hideWhenEmpty) {
            $data = $widgetData->get($key);

            return in_array($key, $hideWhenEmpty, true)
                && ($data === null || count($data) === 0);
        })->values();

        return Inertia::render('Dashboard', [
            'widgets' => $widgets,
            'widgetData' => $widgetData->only($widgets)->filter(fn ($v) => $v !== null),
            // Tabs for those who read the dashboard as analytics; for everyone else
            // this is empty and the page stays the single scroll it is today.
            'tabs' => $can('dashboard.analytics') ? $this->tabsFor($widgets) : [],
        ]);
    }

    /**
     * The tab strip for this user: every tab that has at least one visible widget.
     *
     * A tab is only worth showing when there is something else to switch to, so a
     * single populated tab returns nothing and the page renders flat.
     *
     * @param  \Illuminate\Support\Collection<int, string>  $widgets
     * @return array<int, array{key: string, label: string, widgets: array<int, string>}>
     */
    private function tabsFor($widgets): array
    {
        $assignment = config('dashboard.widget_tabs', []);
        $tabs = config('dashboard.tabs', []);
        $fallback = array_key_first($tabs);

        $grouped = $widgets->groupBy(fn (string $key) => $assignment[$key] ?? $fallback);

        $populated = collect($tabs)
            ->map(fn (string $label, string $key) => [
                'key' => $key,
                'label' => $label,
                'widgets' => $grouped->get($key, collect())->values()->all(),
            ])
            ->filter(fn (array $tab) => $tab['widgets'] !== [])
            ->values()
            ->all();

        return count($populated) > 1 ? $populated : [];
    }

    /**
     * A widget rule is null (everyone), a permission or list of permissions
     * (any one of them), or ['permission' => ..., 'unless' => ...] to hide a
     * task widget from someone who already gets the overview.
     */
    private function widgetAllowed(string|array|null $rule, callable $can): bool
    {
        if (is_array($rule) && array_key_exists('permission', $rule)) {
            return $can($rule['permission']) && ! (isset($rule['unless']) && $can($rule['unless']));
        }

        return $can($rule);
    }

    /**
     * verify_by_emp_id is written with auth()->id(), and the users table
     * authenticates on emp_id, so this is the employee ID.
     */
    private function currentEmpKey(): int|string|null
    {
        return Auth::id();
    }

    private function dataFor(string $key, callable $can): mixed
    {
        return match ($key) {
            'stats' => $this->stats($can),
            'monthlyTrend' => $this->monthlyTrend($can),
            'prPipeline' => $this->prPipeline(),
            'poPipeline' => $this->poPipeline(),
            'deptChart' => $this->requestsByDept(),
            'recentActivity' => $this->recentActivity(),

            'draftQueue' => $this->prQueue([0], 'encode.index'),
            'verifyQueue' => $this->prQueue([1], 'purchase-requests.index'),
            'canvassQueue' => $this->prQueue([100, 110, 120, 130, 200], 'canvas.index'),
            'poQueue' => $this->prQueue([205, 210], 'purchase-orders.index'),

            'incomingQueue' => $this->poQueue([230], 'inventory.index'),
            'outgoingQueue' => $this->poQueue([550], 'inventory.outgoings'),
            'iarQueue' => $this->poQueue([300], 'inspection-acceptance-reports.index'),
            'risQueue' => $this->poQueue([400], 'ris.index'),
            'ssmiQueue' => $this->poQueue([500], 'ssmi.index'),

            'disposalQueue' => $this->disposalQueue(),
            'recentPrs' => $this->recentRequests(),
            'missingTracker' => $this->missingTracker($can),
            'calendar' => $this->calendar($can),

            default => null, // welcome and comingSoon need no server data
        };
    }

    /* ------------------------------------------------------------------ *
     * Counters
     * ------------------------------------------------------------------ */

    /**
     * Counters are a list, not a fixed shape, so each role gets the numbers
     * that mean something to it. Each group is only queried when the role
     * holds its permission.
     */
    private function stats(callable $can): array
    {
        $stats = [];

        if ($can('dashboard.system')) {
            array_push($stats, ...$this->systemStats());
        }

        if ($can('dashboard.procurement')) {
            array_push($stats, ...$this->prOverviewStats());
        }

        if ($can('dashboard.inventory')) {
            array_push($stats, ...$this->inventoryOverviewStats());
        }

        if ($can(['pr.encode', 'pr.verify', 'pr.canvass', 'pr.po']) && ! $can('dashboard.procurement')) {
            array_push($stats, ...$this->prTaskStats($can));
        }

        if ($can(['inventory.incoming', 'inventory.outgoing', 'inventory.iar', 'inventory.ris', 'inventory.ssmi']) && ! $can('dashboard.inventory')) {
            array_push($stats, ...$this->inventoryTaskStats($can));
        }

        if ($can('records.view') && ! $can('dashboard.system')) {
            array_push($stats, ...$this->recordStats());
        }

        return $stats;
    }

    private function systemStats(): array
    {
        $activeCode = config('Users.active_status_code');

        $users = User::query()
            ->leftJoin('status', 'status.id', '=', 'users.status_id')
            ->selectRaw('
                SUM(CASE WHEN status.status_code = ? THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status.status_code = ? THEN 0 ELSE 1 END) as inactive
            ', [$activeCode, $activeCode])
            ->first();

        return [
            $this->stat('Active users', $users->active, 'users.index',
                info: 'Accounts that can sign in right now. Inactive and locked accounts are counted in the next tile.'),
            $this->stat('Inactive or locked users', $users->inactive, 'users.index',
                tone: (int) $users->inactive > 0 ? 'warning' : null,
                info: 'Accounts that cannot sign in: deactivated, or locked after failed attempts.'),
            $this->stat('Actions logged today', $this->meaningfulActivity()->whereDate('created_at', today())->count(),
                'audit-logs.index',
                info: 'Audit entries recorded since midnight, counting real changes only — page views are left out.'),
            $this->stat('Requests filed today', PurchaseRequest::whereDate('created_at', today())->count(),
                'request-monitoring.index',
                info: 'Purchase requests created since midnight, including ones still in draft.'),
        ];
    }

    private function prOverviewStats(): array
    {
        $row = PurchaseRequest::query()
            ->selectRaw('
                SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as this_month,
                SUM(CASE WHEN status NOT IN (0, 230, 700) THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 230 THEN 1 ELSE 0 END) as po_generated,
                SUM(CASE WHEN status = 700 THEN 1 ELSE 0 END) as rejected
            ', [now()->startOfMonth()])
            ->first();

        return [
            $this->stat('Requests this month', $row->this_month, 'request-monitoring.index',
                info: 'Purchase requests filed since the first of this month, at any stage.'),
            $this->stat('Requests in progress', $row->in_progress, 'request-monitoring.index',
                info: 'Requests being worked on: everything except drafts, requests whose PO has been generated, and rejected ones.'),
            $this->stat('Generated PO', $row->po_generated, 'request-monitoring.index',
                info: 'Requests that have reached PO generated. From here the purchase order carries the work through inventory.'),
            $this->stat('Rejected requests', $row->rejected, 'request-monitoring.index',
                info: 'Requests declined during verification, with the reason recorded. Cancelled requests are counted separately.'),
        ];
    }

    private function inventoryOverviewStats(): array
    {
        $row = PurchaseOrder::query()
            ->selectRaw('
                SUM(CASE WHEN status = 230 THEN 1 ELSE 0 END) as incoming,
                SUM(CASE WHEN status IN (300, 400, 500) THEN 1 ELSE 0 END) as processing,
                SUM(CASE WHEN status = 550 THEN 1 ELSE 0 END) as for_release,
                SUM(CASE WHEN status = 600 AND updated_at >= ? THEN 1 ELSE 0 END) as completed_month
            ', [now()->startOfMonth()])
            ->first();

        return [
            $this->stat('Incomings', $row->incoming,
                info: 'Numbered purchase orders whose goods have not been received yet.'),
            $this->stat('In IAR, RIS or SSMI', $row->processing,
                info: 'Received orders being processed through inspection, the issue slip and the stock card.'),
            $this->stat('Ready for release', $row->for_release,
                info: 'Orders with an SSMI issued, waiting to be handed to the requesting department.'),
            $this->stat('Completed this month', $row->completed_month,
                info: 'Orders released since the first of this month.'),
        ];
    }

    private function prTaskStats(callable $can): array
    {
        $row = PurchaseRequest::query()
            ->selectRaw('
                SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as drafts,
                SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status IN (100, 110, 120, 130) THEN 1 ELSE 0 END) as verified,
                SUM(CASE WHEN status = 200 THEN 1 ELSE 0 END) as canvassing,
                SUM(CASE WHEN status IN (205, 210) THEN 1 ELSE 0 END) as awaiting_po,
                SUM(CASE WHEN verify_by_emp_id = ? THEN 1 ELSE 0 END) as verified_by_me,
                SUM(CASE WHEN verify_by_emp_id = ? AND verified_At >= ? THEN 1 ELSE 0 END) as verified_by_me_today
            ', [$this->currentEmpKey(), $this->currentEmpKey(), today()])
            ->first();

        $stats = [];

        if ($can('pr.encode')) {
            $stats[] = $this->stat('Drafts to finish', $row->drafts, 'encode.index');
            $stats[] = $this->stat('Submitted, awaiting verification', $row->pending);
        }

        if ($can('pr.verify')) {
            $stats[] = $this->stat('Waiting for verification', $row->pending, 'purchase-requests.index',
                tone: (int) $row->pending > 0 ? 'attention' : null);
            $stats[] = $this->stat('Verified by you today', $row->verified_by_me_today);
            $stats[] = $this->stat('Verified by you, all time', $row->verified_by_me);
        }

        if ($can('pr.canvass')) {
            $stats[] = $this->stat('Ready for canvassing', $row->verified, 'canvas.index',
                tone: (int) $row->verified > 0 ? 'attention' : null);
            $stats[] = $this->stat('Canvassing in progress', $row->canvassing, 'canvas.index');
        }

        if ($can('pr.po')) {
            $stats[] = $this->stat('Waiting for a PO', $row->awaiting_po, 'purchase-orders.index',
                tone: (int) $row->awaiting_po > 0 ? 'attention' : null);
        }

        return $stats;
    }

    private function inventoryTaskStats(callable $can): array
    {
        $counts = PurchaseOrder::query()
            ->selectRaw('status, COUNT(*) as total')
            ->whereIn('status', [230, 300, 400, 500, 550])
            ->groupBy('status')
            ->pluck('total', 'status');

        $count = fn (int $status) => (int) ($counts[$status] ?? 0);
        $attention = fn (int $status) => $count($status) > 0 ? 'attention' : null;

        $stats = [];

        if ($can('inventory.incoming')) {
            $stats[] = $this->stat('Incoming deliveries', $count(230), 'inventory.index', tone: $attention(230));
        }

        if ($can('inventory.outgoing')) {
            $stats[] = $this->stat('Ready for release', $count(550), 'inventory.outgoings', tone: $attention(550));
        }

        if ($can('inventory.iar')) {
            $stats[] = $this->stat('Waiting for IAR', $count(300), 'inspection-acceptance-reports.index',
                tone: $attention(300));
        }

        if ($can('inventory.ris')) {
            $stats[] = $this->stat('Waiting for RIS', $count(400), 'ris.index', tone: $attention(400));
        }

        if ($can('inventory.ssmi')) {
            $stats[] = $this->stat('Waiting for SSMI', $count(500), 'ssmi.index', tone: $attention(500));
        }

        return $stats;
    }

    private function recordStats(): array
    {
        $today = today();
        $windowEnd = today()->addDays(self::DISPOSAL_WINDOW_DAYS);

        $row = Records::query()
            ->visibleTo(Auth::user())
            ->selectRaw('
                SUM(CASE WHEN archived_at IS NULL THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN archived_at IS NULL AND eligible_for_disposal_on <= ? THEN 1 ELSE 0 END) as due,
                SUM(CASE WHEN archived_at IS NULL AND eligible_for_disposal_on > ? AND eligible_for_disposal_on <= ? THEN 1 ELSE 0 END) as due_soon,
                SUM(CASE WHEN archived_at IS NOT NULL THEN 1 ELSE 0 END) as archived
            ', [$today, $today, $windowEnd])
            ->first();

        return [
            $this->stat('Active records', $row->active, 'records.index'),
            $this->stat('Eligible for disposal', $row->due, 'records.index',
                tone: (int) $row->due > 0 ? 'attention' : null),
            $this->stat('Eligible within '.self::DISPOSAL_WINDOW_DAYS.' days', $row->due_soon, 'records.index'),
            $this->stat('Archived records', $row->archived, 'records.index'),
        ];
    }

    /**
     * One counter tile. `tone` is 'attention' when the number means work is waiting.
     *
     * `info` is the sentence behind the tile's ⓘ. A label alone cannot say which
     * records a number covers — "Requests in progress" is every stage except
     * draft, PO generated and rejected — so the tile carries its own definition.
     */
    private function stat(
        string $label,
        mixed $value,
        ?string $routeName = null,
        ?string $tone = null,
        ?string $info = null,
    ): array {
        return [
            'label' => $label,
            'value' => (int) $value,
            'href' => $routeName ? route($routeName) : null,
            'tone' => $tone,
            'info' => $info,
        ];
    }

    /* ------------------------------------------------------------------ *
     * Charts
     * ------------------------------------------------------------------ */

    /**
     * Transactions per calendar month for the last TREND_MONTHS months,
     * including the current one. Each role only gets the series it may see.
     */
    private function monthlyTrend(callable $can): array
    {
        $start = now()->startOfMonth()->subMonths(self::TREND_MONTHS - 1);
        $months = collect(range(0, self::TREND_MONTHS - 1))
            ->map(fn (int $offset) => $start->copy()->addMonths($offset)->format('Y-m'));

        $series = [];

        if ($can('dashboard.procurement')) {
            $series[] = [
                'key' => 'requests',
                'label' => 'Purchase requests filed',
                'values' => $this->countsPerMonth(PurchaseRequest::query(), 'created_at', $start, $months),
            ];
        }

        if ($can('dashboard.inventory')) {
            $series[] = [
                'key' => 'orders',
                'label' => 'Purchase orders opened',
                'values' => $this->countsPerMonth(PurchaseOrder::query(), 'created_at', $start, $months),
            ];
        }

        return [
            'months' => $months->all(),
            'series' => $series,
        ];
    }

    /** Row counts per "YYYY-MM", with months that have no rows filled in as 0. */
    private function countsPerMonth(Builder $query, string $column, Carbon $start, $months): array
    {
        $counts = $query
            ->where($column, '>=', $start)
            ->selectRaw("DATE_FORMAT({$column}, '%Y-%m') as month, COUNT(*) as total")
            ->groupBy('month')
            ->pluck('total', 'month');

        return $months->map(fn (string $month) => (int) ($counts[$month] ?? 0))->all();
    }

    private function prPipeline(): array
    {
        $counts = PurchaseRequest::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'stages' => $this->stagesFrom(self::PR_STAGES, $counts),
            'rejected' => (int) ($counts[self::PR_REJECTED] ?? 0),
            'href' => route('request-monitoring.index'),
        ];
    }

    private function poPipeline(): array
    {
        $counts = PurchaseOrder::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'stages' => $this->stagesFrom(self::PO_STAGES, $counts),
            'href' => route('request-monitoring.index'),
        ];
    }

    private function stagesFrom(array $stages, $counts): array
    {
        return array_map(fn (array $stage) => [
            'label' => $stage['label'],
            'value' => array_sum(array_map(fn ($status) => (int) ($counts[$status] ?? 0), $stage['statuses'])),
        ], $stages);
    }

    /** Top departments by request count; the tail folds into "Other". */
    private function requestsByDept(int $top = 7): array
    {
        $rows = PurchaseRequest::query()
            ->selectRaw('requester_department as dept, COUNT(*) as total')
            ->groupBy('requester_department')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => ['label' => $row->dept ?: 'No department', 'value' => (int) $row->total]);

        if ($rows->count() > $top + 1) {
            $rows = $rows->take($top)->push([
                'label' => 'Other departments',
                'value' => $rows->slice($top)->sum('value'),
            ]);
        }

        return $rows->all();
    }

    /* ------------------------------------------------------------------ *
     * Queues and lists
     * ------------------------------------------------------------------ */

    /** Purchase requests waiting at the given statuses, longest-waiting first. */
    private function prQueue(array $statuses, string $routeName): array
    {
        $query = PurchaseRequest::query()->whereIn('status', $statuses);

        return [
            'total' => (clone $query)->count(),
            'href' => route($routeName),
            'rows' => $query
                ->orderBy('updated_at')
                ->take(self::QUEUE_LIMIT)
                ->get(['id', 'pr_number', 'requester_department', 'status', 'updated_at'])
                ->map(fn ($pr) => [
                    'id' => 'pr-'.$pr->id,
                    'number' => $pr->pr_number,
                    'dept' => $pr->requester_department,
                    'status' => (int) $pr->status,
                    'date' => $pr->updated_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }

    /** Purchase orders waiting at the given statuses, longest-waiting first. */
    private function poQueue(array $statuses, string $routeName): array
    {
        $query = PurchaseOrder::query()->whereIn('purchase_order.status', $statuses);

        return [
            'total' => (clone $query)->count(),
            'href' => route($routeName),
            'rows' => $query
                ->leftJoin('purchase_requests', 'purchase_requests.pr_number', '=', 'purchase_order.PR_Number')
                ->orderBy('purchase_order.updated_at')
                ->take(self::QUEUE_LIMIT)
                ->get([
                    'purchase_order.id',
                    'purchase_order.PO_Number',
                    'purchase_order.PR_Number',
                    'purchase_order.status',
                    'purchase_order.updated_at',
                    'purchase_requests.requester_department',
                ])
                ->map(fn ($po) => [
                    'id' => 'po-'.$po->id,
                    'number' => $po->PO_Number ?: $po->PR_Number,
                    'secondary' => $po->PO_Number ? $po->PR_Number : null,
                    'dept' => $po->requester_department,
                    'status' => (int) $po->status,
                    'date' => $po->updated_at ? Carbon::parse($po->updated_at)->toIso8601String() : null,
                    // Every inventory page opens a given order with ?order=.
                    'href' => route($routeName, ['order' => $po->id]),
                ])
                ->all(),
        ];
    }

    /** Records already eligible for disposal or due within the window, soonest first. */
    private function disposalQueue(): array
    {
        $today = today();

        $query = Records::query()
            ->visibleTo(Auth::user())
            ->whereNull('archived_at')
            ->whereNotNull('eligible_for_disposal_on')
            ->where('eligible_for_disposal_on', '<=', today()->addDays(self::DISPOSAL_WINDOW_DAYS));

        return [
            'total' => (clone $query)->count(),
            'href' => route('records.index'),
            'rows' => $query
                ->orderBy('eligible_for_disposal_on')
                ->take(self::QUEUE_LIMIT)
                ->get(['id', 'reference_no', 'title', 'originating_office', 'eligible_for_disposal_on'])
                ->map(function ($record) use ($today) {
                    $due = Carbon::parse($record->eligible_for_disposal_on);

                    return [
                        'id' => 'record-'.$record->id,
                        'number' => $record->reference_no ?: $record->title,
                        'secondary' => $record->reference_no ? $record->title : null,
                        'dept' => $record->originating_office,
                        'badge' => $due->lte($today)
                            ? ['label' => 'Eligible now', 'tone' => 'critical']
                            : ['label' => 'Due soon', 'tone' => 'warning'],
                        'date' => $due->toDateString(),
                    ];
                })
                ->all(),
        ];
    }

    private function recentRequests(): array
    {
        $query = PurchaseRequest::query();

        return [
            'total' => (clone $query)->count(),
            'href' => route('request-monitoring.index'),
            'rows' => $query
                ->latest()
                ->take(self::QUEUE_LIMIT)
                ->get(['id', 'pr_number', 'requester_department', 'status', 'created_at'])
                ->map(fn ($pr) => [
                    'id' => 'pr-'.$pr->id,
                    'number' => $pr->pr_number,
                    'dept' => $pr->requester_department,
                    'status' => (int) $pr->status,
                    'date' => $pr->created_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }

    /**
     * Where an order at each status is worked on, and the permission that page
     * needs, so a tracker row links to the order only for someone who can open it.
     */
    private const STAGE_PAGES = [
        230 => ['inventory.index', 'inventory.incoming', []],
        300 => ['inspection-acceptance-reports.index', 'inventory.iar', []],
        400 => ['ris.index', 'inventory.ris', []],
        500 => ['ssmi.index', 'inventory.ssmi', []],
        550 => ['inventory.outgoings', 'inventory.outgoing', []],
        600 => ['inventory.outgoings', 'inventory.outgoing', ['view' => 'released']],
    ];

    /**
     * Open missing tags: how many, how many orders they hold, and the ones
     * waiting longest — the ones most likely to have been forgotten.
     */
    private function missingTracker(callable $can): array
    {
        $open = PurchaseOrderTag::open();

        return [
            'open' => (clone $open)->count(),
            'held_orders' => (clone $open)
                ->whereHas('tag', fn ($tag) => $tag->where('holds_order', true))
                ->distinct()
                ->count('purchase_order_id'),
            'href' => route('missing-tracker.index'),
            'rows' => (clone $open)
                ->with(['tag:id,name,color,holds_order', 'purchaseOrder:id,PO_Number,PR_Number,status', 'purchaseOrder.purchaseRequest:id,pr_number,requester_department'])
                ->oldest()
                ->take(5)
                ->get()
                ->map(function (PurchaseOrderTag $entry) use ($can) {
                    $po = $entry->purchaseOrder;
                    [$routeName, $permission, $query] = self::STAGE_PAGES[(int) $po?->status] ?? [null, null, []];

                    return [
                        'id' => $entry->id,
                        'tag' => $entry->tag?->only(['name', 'color', 'holds_order']),
                        'number' => $po?->PO_Number ?: $po?->PR_Number,
                        'dept' => $po?->purchaseRequest?->requester_department,
                        'status' => (int) $po?->status,
                        'note' => $entry->note,
                        'date' => $entry->created_at?->toIso8601String(),
                        'href' => $routeName && $can($permission) ? route($routeName, $query + ['order' => $po->id]) : null,
                    ];
                })
                ->all(),
        ];
    }

    /**
     * The month on screen when the page opens (padded to whole weeks, as the
     * grid shows them), what is coming up, and whether this person may edit.
     * Other months are fetched by the calendar as it is paged to.
     */
    private function calendar(callable $can): array
    {
        $start = now()->startOfMonth()->startOfWeek(Carbon::SUNDAY);
        $end = now()->endOfMonth()->endOfWeek(Carbon::SATURDAY);

        return [
            'month' => now()->format('Y-m'),
            'events' => CalendarEventController::eventsBetween($start->toDateString(), $end->toDateString()),
            'upcoming' => CalendarEventController::upcoming(),
            'categories' => CalendarEvent::CATEGORIES,
            'canManage' => $can('calendar.manage'),
        ];
    }

    /** Audit entries that record a change, not someone opening a page. */
    private function meaningfulActivity(): Builder
    {
        return AuditLog::query()->whereNotIn('action', ['viewed', 'viewed_index']);
    }

    private function recentActivity(): array
    {
        return [
            'href' => route('audit-logs.index'),
            'rows' => $this->meaningfulActivity()
                ->with('user:emp_id,emp_fname,emp_lname')
                ->latest('created_at')
                ->take(self::QUEUE_LIMIT)
                ->get(['id', 'user_id', 'action', 'description', 'created_at'])
                ->map(fn ($log) => [
                    'id' => $log->id,
                    'user' => $log->user ? trim("{$log->user->emp_fname} {$log->user->emp_lname}") : 'System',
                    'action' => $log->action,
                    'description' => $log->description,
                    'date' => $log->created_at?->toIso8601String(),
                ])
                ->all(),
        ];
    }
}

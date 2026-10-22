<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AuditLogController extends Controller
{
    /**
     * Page views. They are most of the log — every list opened writes one — so
     * they are left out unless asked for, or the changes are lost among them.
     */
    private const VIEW_ACTIONS = ['viewed', 'viewed_index'];

    /**
     * Display a listing of the audit logs.
     */
    public function index(Request $request)
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'action' => ['nullable', 'string', 'max:100'],
            'user' => ['nullable', 'integer'],
            'views' => ['nullable', 'boolean'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $withViews = (bool) ($filters['views'] ?? false);

        $logs = AuditLog::with(['user:emp_id,emp_fname,emp_lname'])
            ->when(! $withViews && empty($filters['action']), fn ($query) => $query->whereNotIn('action', self::VIEW_ACTIONS))
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $like = "%{$search}%";

                $query->where(fn ($query) => $query
                    ->where('description', 'like', $like)
                    ->orWhere('action', 'like', $like)
                    ->orWhere('auditable_type', 'like', $like)
                    ->orWhere('auditable_id', 'like', $like)
                    ->orWhereHas('user', fn ($user) => $user
                        ->where('emp_fname', 'like', $like)
                        ->orWhere('emp_lname', 'like', $like)
                        ->orWhere('emp_id', 'like', $like)
                        ->orWhereRaw("CONCAT(emp_fname, ' ', emp_lname) like ?", [$like])));
            })
            ->when($filters['action'] ?? null, fn ($query, string $action) => $query->where('action', $action))
            ->when($filters['user'] ?? null, fn ($query, int $user) => $query->where('user_id', $user))
            ->when($filters['from'] ?? null, fn ($query, string $from) => $query->whereDate('created_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($query, string $to) => $query->whereDate('created_at', '<=', $to))
            ->latest()
            ->latest('id')
            ->paginate(25)
            ->withQueryString(); // Page links keep the active filters

        $records = $this->recordsFor(collect($logs->items()));
        $logs->through(fn (AuditLog $log) => $log->setAttribute(
            'record',
            $records[$log->auditable_type][(string) $log->auditable_id] ?? null,
        ));

        $changes = AuditLog::whereNotIn('action', self::VIEW_ACTIONS);

        return Inertia::render('AuditLogs/IncomingIndex', [
            'logs' => $logs,
            'filters' => [
                'search' => $filters['search'] ?? '',
                'action' => $filters['action'] ?? '',
                'user' => isset($filters['user']) ? (string) $filters['user'] : '',
                'views' => $withViews,
                'from' => $filters['from'] ?? '',
                'to' => $filters['to'] ?? '',
            ],
            'actions' => AuditLog::query()
                ->when(! $withViews, fn ($query) => $query->whereNotIn('action', self::VIEW_ACTIONS))
                ->selectRaw('action, COUNT(*) as total')
                ->groupBy('action')
                ->orderBy('action')
                ->get(),
            // Everyone who has made a change, for the "who" filter.
            'people' => DB::table('audit_log')
                ->join('users', 'users.emp_id', '=', 'audit_log.user_id')
                ->whereNotIn('audit_log.action', self::VIEW_ACTIONS)
                ->groupBy('users.emp_id', 'users.emp_fname', 'users.emp_lname')
                ->orderBy('users.emp_fname')
                ->get(['users.emp_id', 'users.emp_fname', 'users.emp_lname', DB::raw('COUNT(*) as total')]),
            'stats' => [
                'changes_today' => (clone $changes)->whereDate('created_at', today())->count(),
                'changes_week' => (clone $changes)->where('created_at', '>=', now()->subDays(7))->count(),
                'people_today' => (clone $changes)->whereDate('created_at', today())->distinct()->count('user_id'),
                'views_today' => AuditLog::whereIn('action', self::VIEW_ACTIONS)->whereDate('created_at', today())->count(),
            ],
        ]);
    }

    /**
     * A readable name, and a link where there is a page for it, for the record
     * each entry on this page is about: "PO-2026-00123" rather than
     * "PurchaseOrder #8". Looked up in one query per kind of record.
     *
     * Purchase requests are logged by their PR number, everything else by id.
     *
     * @param  Collection<int, AuditLog>  $logs
     * @return array<string, array<string, array{label: string, url: ?string}>>
     */
    private function recordsFor(Collection $logs): array
    {
        $user = Auth::user();
        $can = fn (string $permission) => $user?->hasPermission($permission) ?? false;
        $timeline = fn ($prId) => $prId && $can('monitoring.view') ? route('request-monitoring.show', $prId) : null;

        $ids = $logs->groupBy('auditable_type')->map(fn ($group) => $group->pluck('auditable_id')->filter()->unique()->values());
        $records = [];

        if ($keys = $ids->get('App\Models\PurchaseRequest')) {
            DB::table('purchase_requests')
                ->whereIn('pr_number', $keys)->orWhereIn('id', $keys->filter(fn ($k) => ctype_digit((string) $k)))
                ->get(['id', 'pr_number'])
                ->each(function ($pr) use (&$records, $timeline) {
                    $record = ['label' => $pr->pr_number, 'url' => $timeline($pr->id)];
                    $records['App\Models\PurchaseRequest'][$pr->pr_number] = $record;
                    $records['App\Models\PurchaseRequest'][(string) $pr->id] = $record;
                });
        }

        if ($keys = $ids->get('App\Models\PurchaseOrder')) {
            DB::table('purchase_order as po')
                ->leftJoin('purchase_requests as pr', 'pr.pr_number', '=', 'po.PR_Number')
                ->whereIn('po.id', $keys)
                ->get(['po.id', 'po.PO_Number', 'po.PR_Number', 'pr.id as pr_id'])
                ->each(function ($po) use (&$records, $timeline) {
                    $records['App\Models\PurchaseOrder'][(string) $po->id] = [
                        'label' => $po->PO_Number ?: "Order for {$po->PR_Number}",
                        'url' => $timeline($po->pr_id),
                    ];
                });
        }

        if ($keys = $ids->get('App\Models\CanvasForms')) {
            DB::table('canvasForms as c')
                ->leftJoin('purchase_requests as pr', 'pr.pr_number', '=', 'c.pr_number')
                ->whereIn('c.id', $keys)
                ->get(['c.id', 'c.pr_number', 'pr.id as pr_id'])
                ->each(function ($canvas) use (&$records, $timeline) {
                    $records['App\Models\CanvasForms'][(string) $canvas->id] = [
                        'label' => "Canvass for {$canvas->pr_number}",
                        'url' => $timeline($canvas->pr_id),
                    ];
                });
        }

        if ($keys = $ids->get('App\Models\User')) {
            DB::table('users')->whereIn('id', $keys)->get(['id', 'emp_fname', 'emp_lname'])
                ->each(function ($u) use (&$records, $can) {
                    $records['App\Models\User'][(string) $u->id] = [
                        'label' => trim("{$u->emp_fname} {$u->emp_lname}"),
                        'url' => $can('users.manage') ? route('users.show', $u->id) : null,
                    ];
                });
        }

        if ($keys = $ids->get('App\Models\Role')) {
            DB::table('role')->whereIn('id', $keys)->get(['id', 'role_name', 'section'])
                ->each(function ($role) use (&$records, $can) {
                    $records['App\Models\Role'][(string) $role->id] = [
                        'label' => trim("{$role->role_name} · {$role->section}", ' ·'),
                        'url' => $can('permissions.manage') ? route('permissions.index') : null,
                    ];
                });
        }

        return $records;
    }

    /**
     * Display the specified audit log.
     */
    public function show(AuditLog $auditLog)
    {
        $auditLog->load(['user']);

        return Inertia::render('AuditLogs/Show', [
            'log' => $auditLog
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\PurchaseRequest;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Schema this is written against:
     *   purchase_requests: pr_number, requester_name, status,
     *                      requester_department, verify_by_emp_id,
     *                      verified_At, created_at
     *   roles:             role_name, section   (unique on the PAIR, not role_name)
     *
     * Renders Pages/Dashboard/Index.jsx — note the path change. Inertia's
     * default resolver maps the page name to ./Pages/{name}.jsx literally, so
     * 'Dashboard' would still hit the old flat file. Delete Pages/Dashboard.jsx
     * once you've moved over.
     */
    public function index(): Response
    {
        $user = Auth::user()->loadMissing('role');

        $permissions = $this->permissionsFor($user);
        $can = fn (string $permission) => in_array('*', $permissions, true)
            || in_array($permission, $permissions, true);

        $widgets = collect(config('dashboard.widgets'))
            ->filter(fn ($needed) => $needed === null || $can($needed))
            ->keys();

        // Only selected widgets get queried, so a role without 'pr.view_all'
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
            'widgets'    => $widgets,
            'widgetData' => $widgetData->only($widgets)->filter(fn ($v) => $v !== null),
        ]);
    }

    /**
     * Roles are identified by section AND role_name — "Section Head" exists in
     * Procurement, Motor Pool, Inventory and Sales, and Records, and they are
     * four different jobs.
     */
    private function permissionsFor($user): array
    {
        $section = $user->role?->section;
        $roleName = $user->role?->role_name;

        $permissions = config('DashboardConfig.permissions')[$section][$roleName] ?? null;

        if ($permissions === null) {
            // Loud in the log, quiet on screen: the user gets the "no dashboard
            // configured" empty state rather than an error page.
            Log::warning('Dashboard: no permissions configured for role.', [
                'user_id' => $user->id,
                'section' => $section,
                'role'    => $roleName,
            ]);

            return [];
        }

        return $permissions;
    }

    /**
     * The one place that decides what identifies "me" in verify_by_emp_id.
     *
     * Your login authenticates on empID and your users table carries emp_id, so
     * this column most likely holds the employee ID rather than the
     * auto-increment users.id. Check one row:
     *
     *   select verify_by_emp_id from purchase_requests
     *   where verify_by_emp_id is not null limit 1;
     *
     * If it matches users.id instead, change this method to Auth::id() and
     * nothing else in the file needs touching.
     */
    private function currentEmpKey(): int|string|null
    {
        return Auth::user()->emp_id;
    }

    private function dataFor(string $key, callable $can): mixed
    {
        return match ($key) {
            'stats'        => $this->stats($can),
            'deptPie'      => $this->requestsByDept(),
            'recentPrs'    => $this->recentRequests($can),
            'verifiedByMe' => $this->verifiedByMe(),
            'canvassQueue' => $this->canvassQueue(),
            default        => null, // welcome and clock need no server data
        };
    }

    /**
     * Counters are a list, not a fixed shape, so each role gets the numbers
     * that mean something to it. StatCards renders whatever it's handed.
     *
     * One pass over the table instead of a COUNT query per tile.
     */
    private function stats(callable $can): array
    {
        if (! $can('pr.view_all') && ! $can('pr.view_dept') && ! $can('pr.verify')) {
            return []; // non-PR sections get no counters until their modules exist
        }

        $row = $this->scopeToViewer(PurchaseRequest::query(), $can)
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 100 THEN 1 ELSE 0 END) as verified,
                SUM(CASE WHEN status IN (200, 201, 202) THEN 1 ELSE 0 END) as canvassing,
                SUM(CASE WHEN verify_by_emp_id = ? THEN 1 ELSE 0 END) as verified_by_me
            ', [$this->currentEmpKey()])
            ->first();

        $stats = [];

        $stats[] = ['label' => 'Total received PR', 'value' => (int) $row->total];
        $stats[] = ['label' => 'Pending PR', 'value' => (int) $row->pending];

        if ($can('pr.verify')) {
            $stats[] = ['label' => 'Verified PR', 'value' => (int) $row->verified];
            $stats[] = ['label' => 'Verified by you', 'value' => (int) $row->verified_by_me];
        }

        if ($can('pr.canvass') || $can('pr.po')) {
            $stats[] = ['label' => 'For canvassing', 'value' => (int) $row->canvassing];
        }

        return $stats;
    }

    /**
     * A Department Head sees their own department only; Procurement sees all.
     *
     * TODO: confirm the column that holds the user's department. This assumes
     * users.department matches purchase_requests.requester_department by name —
     * if departments are a table, join on the id instead, since matching
     * free-text department names will drift.
     */
    private function scopeToViewer(Builder $query, callable $can): Builder
    {
        if ($can('pr.view_all')) {
            return $query;
        }

        return $query->where('requester_department', Auth::user()->department);
    }

    private function recentRequests(callable $can): Collection
    {
        return $this->prRows(
            $this->scopeToViewer(PurchaseRequest::query(), $can)->orderByDesc('created_at'),
            'created_at',
        );
    }

    private function verifiedByMe(): Collection
    {
        return $this->prRows(
            PurchaseRequest::query()
                ->where('verify_by_emp_id', $this->currentEmpKey())
                ->orderByDesc('verified_At'),
            'verified_At',
        );
    }

    private function canvassQueue(): Collection
    {
        return $this->prRows(
            PurchaseRequest::query()
                ->whereIn('status', [200, 201, 202])
                ->orderByDesc('created_at'),
            'created_at',
        );
    }

    /**
     * Shared row shape for every PR table, so the frontend contract can't drift
     * between widgets.
     */
    private function prRows(Builder $query, string $dateColumn, int $limit = 25): Collection
    {
        return $query
            ->take($limit)
            ->get(['pr_number', 'requester_name', 'status', 'requester_department', $dateColumn])
            ->map(fn ($pr) => [
                'pr_num'    => $pr->pr_number,
                'requester' => $pr->requester_name,
                'status'    => $pr->status,
                'dept'      => $pr->requester_department,
                'date'      => $pr->{$dateColumn}
                    ? Carbon::parse($pr->{$dateColumn})->format('Y-m-d')
                    : null,
            ]);
    }

    private function requestsByDept(): Collection
    {
        return PurchaseRequest::query()
            ->selectRaw('requester_department as dept, COUNT(*) as total')
            ->groupBy('requester_department')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'dept'  => $row->dept ?? 'Unassigned',
                'total' => (int) $row->total,
            ]);
    }
}

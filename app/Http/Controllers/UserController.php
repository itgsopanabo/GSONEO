<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Role;
use App\Models\Status;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $users = User::query()
            ->when($request->input('search'), function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('emp_fname', 'like', "%{$search}%")
                        ->orWhere('emp_lname', 'like', "%{$search}%")
                        ->orWhere('emp_id', 'like', "%{$search}%");
                });
            })
            ->when($request->input('role'), fn ($query, $role) => $query->where('role_id', $role))
            ->when($request->input('status'), fn ($query, $status) => $query->where('status_id', $status))
            ->orderBy('emp_lname')
            ->paginate(15)
            ->withQueryString();

        $lastActive = $this->lastActive(collect($users->items())->pluck('emp_id'));

        $users->through(fn (User $user) => [
            'id' => $user->id,
            'emp_id' => $user->emp_id,
            'emp_fname' => $user->emp_fname,
            'emp_lname' => $user->emp_lname,
            'name' => "{$user->emp_lname}, {$user->emp_fname}",
            'role' => $user->role?->role_name,
            'section' => $user->role?->section,
            'status_id' => $user->status_id,
            'status' => $user->status?->status_desc,
            'status_code' => $user->status?->status_code,
            'is_active' => $user->isActive(),
            'last_active' => $lastActive[$user->emp_id] ?? null,
        ]);

        // Accounts per status, for the tiles at the top.
        $byStatus = User::query()
            ->join('status', 'status.id', '=', 'users.status_id')
            ->selectRaw('status.status_code as code, COUNT(*) as total')
            ->groupBy('status.status_code')
            ->pluck('total', 'code');

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => $request->only('search', 'role', 'status'),
            'defaultPassword' => config('Users.default_password'),
            'defaultStatusId' => Status::activeId(),
            'stats' => [
                'total' => (int) $byStatus->sum(),
                'by_code' => $byStatus,
                'active_today' => AuditLog::whereDate('created_at', today())->distinct()->count('user_id'),
            ],
            ...$this->options(),
        ]);
    }

    /**
     * When each person last did anything — any audit entry, page views included,
     * since a page view is the surest sign someone was signed in and working.
     *
     * @return array<int|string, string>  emp_id => ISO timestamp
     */
    private function lastActive($empIds): array
    {
        if ($empIds->isEmpty()) {
            return [];
        }

        return AuditLog::query()
            ->whereIn('user_id', $empIds)
            ->groupBy('user_id')
            ->selectRaw('user_id, MAX(created_at) as last_at')
            ->pluck('last_at', 'user_id')
            ->map(fn ($at) => \Illuminate\Support\Carbon::parse($at)->toIso8601String())
            ->all();
    }

    public function show(Request $request, User $user): Response
    {
        return Inertia::render('Users/Show', [
            'user' => [
                'id' => $user->id,
                'emp_id' => $user->emp_id,
                'emp_fname' => $user->emp_fname,
                'emp_lname' => $user->emp_lname,
                'role_id' => $user->role_id,
                'role' => $user->role?->role_name,
                'section' => $user->role?->section,
                'status_id' => $user->status_id,
                'status' => $user->status?->status_desc,
                'status_code' => $user->status?->status_code,
                'is_active' => $user->isActive(),
                'created_at' => $user->created_at?->toIso8601String(),
                'updated_at' => $user->updated_at?->diffForHumans(),
                'last_active' => $this->lastActive(collect([$user->emp_id]))[$user->emp_id] ?? null,
            ],
            // What this person has changed lately; page views are left out.
            'recent' => AuditLog::query()
                ->where('user_id', $user->emp_id)
                ->whereNotIn('action', ['viewed', 'viewed_index'])
                ->latest()
                ->latest('id')
                ->take(8)
                ->get(['id', 'action', 'description', 'created_at']),
            'changeCount' => AuditLog::where('user_id', $user->emp_id)->whereNotIn('action', ['viewed', 'viewed_index'])->count(),
            // An admin may not deactivate or remove the account they are using.
            'isSelf' => $user->is($request->user()),
            'statuses' => $this->statusOptions($user->status_id),
            'roles' => Role::orderBy('section')->orderBy('role_name')->get(['id', 'role_name', 'section']),
            'defaultPassword' => config('Users.default_password'),
        ]);
    }

    /**
     * Move a user to another role. The new role decides their menu, pages and
     * dashboard from their very next request.
     */
    public function updateRole(Request $request, User $user): RedirectResponse
    {
        // Changing your own role could lock you out of user management.
        if ($user->is($request->user())) {
            return back()->with('error', 'Change your own role from another admin account.');
        }

        $validated = $request->validate([
            'role_id' => ['required', Rule::exists('role', 'id')],
        ], [], ['role_id' => 'role']);

        $roleId = (int) $validated['role_id'];

        if ($roleId === $user->role_id) {
            return back();
        }

        $user->loadMissing('role');
        $oldRole = $user->role;
        $newRole = Role::find($roleId);

        $user->update(['role_id' => $roleId]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'role_changed',
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'description' => "Changed the role of {$user->emp_fname} {$user->emp_lname} (employee {$user->emp_id}) from "
                ."{$oldRole?->role_name} ({$oldRole?->section}) to {$newRole->role_name} ({$newRole->section})",
            'old_values' => ['role_id' => $oldRole?->id, 'role' => $oldRole?->role_name, 'section' => $oldRole?->section],
            'new_values' => ['role_id' => $newRole->id, 'role' => $newRole->role_name, 'section' => $newRole->section],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return back()->with('success', "{$user->emp_lname}, {$user->emp_fname} is now {$newRole->role_name} ({$newRole->section}).");
    }

    /**
     * Create an account from the Add user dialog on the list. By default it
     * starts on the shared default password, which the new user must replace
     * at first sign-in (RequirePasswordChange).
     */
    public function store(Request $request): RedirectResponse
    {
        $useDefault = $request->boolean('use_default_password') && filled(config('Users.default_password'));

        $validated = $request->validate([
            'emp_id' => ['required', 'integer', 'min:1', Rule::unique('users', 'emp_id')],
            'emp_fname' => ['required', 'string', 'max:255'],
            'emp_lname' => ['required', 'string', 'max:255'],
            'role_id' => ['required', Rule::exists('role', 'id')],
            'status_id' => ['required', Rule::in(Status::selectableIds())],
            'use_default_password' => ['boolean'],
            'password' => $useDefault ? ['nullable'] : ['required', 'confirmed', Password::defaults()],
        ], [
            'emp_id.unique' => 'Another account already uses this employee ID.',
        ], [
            'emp_id' => 'employee ID',
            'emp_fname' => 'first name',
            'emp_lname' => 'last name',
            'role_id' => 'role',
            'status_id' => 'status',
        ]);

        $user = User::create([
            'emp_id' => $validated['emp_id'],
            'emp_fname' => trim($validated['emp_fname']),
            'emp_lname' => trim($validated['emp_lname']),
            'role_id' => $validated['role_id'],
            'status_id' => $validated['status_id'],
            'password' => $useDefault ? config('Users.default_password') : $validated['password'],
        ]);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'description' => "Added user {$user->emp_fname} {$user->emp_lname} (employee {$user->emp_id})"
                .($useDefault ? ' with the default password' : ''),
            'old_values' => null,
            'new_values' => $user->only('emp_id', 'emp_fname', 'emp_lname', 'role_id', 'status_id'),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return back()->with('success', $useDefault
            ? "{$user->emp_lname}, {$user->emp_fname} was added. They sign in with the default password and choose their own."
            : "{$user->emp_lname}, {$user->emp_fname} was added.");
    }

    /**
     * Change only the account status. Kept separate from update() so the list
     * and detail pages can toggle access without touching anything else.
     */
    public function updateStatus(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'status_id' => ['required', Rule::in(Status::selectableIds())],
        ]);

        $statusId = (int) $validated['status_id'];

        if ($user->is($request->user()) && $statusId !== Status::activeId()) {
            return back()->with('error', 'You cannot deactivate the account you are signed in with.');
        }

        if ($statusId === $user->status_id) {
            return back();
        }

        $old = $user->status;
        $user->update(['status_id' => $statusId]);

        $status = Status::find($statusId);

        // Deactivating someone is the account change most worth a record of.
        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'status_changed',
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'description' => "Changed the account status of {$user->emp_fname} {$user->emp_lname} (employee {$user->emp_id}) "
                ."from {$old?->status_desc} to {$status?->status_desc}",
            'old_values' => ['status' => $old?->status_desc],
            'new_values' => ['status' => $status?->status_desc],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return back()->with(
            'success',
            "{$user->emp_lname}, {$user->emp_fname} is now {$status?->status_desc}."
        );
    }

    /**
     * Set a new password for another user — for someone who forgot theirs or
     * a new account handed over with a temporary one. The old password is a
     * one-way hash, so it is replaced, never shown.
     */
    public function updatePassword(Request $request, User $user): RedirectResponse
    {
        // Your own password goes through the profile page, which asks for the current one.
        if ($user->is($request->user())) {
            return back()->with('error', 'Change your own password from your profile page.');
        }

        $default = config('Users.default_password');
        $isDefault = filled($default) && $request->input('password') === $default;

        $validated = $request->validate([
            // The shared default is the one short password allowed: whoever
            // signs in with it is made to choose their own (RequirePasswordChange).
            'password' => ['required', 'confirmed', ...($isDefault ? [] : [Password::defaults()])],
            'sign_out' => ['boolean'],
        ]);

        // The model casts `password` as hashed. A new remember token stops an
        // old "keep me signed in" cookie from bringing the previous login back.
        $user->forceFill([
            'password' => $validated['password'],
            'remember_token' => Str::random(60),
        ])->save();

        if ($request->boolean('sign_out')) {
            DB::table(config('session.table', 'sessions'))->where('emp_id', $user->emp_id)->delete();
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'password_reset',
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'description' => ($isDefault ? 'Reset to the default password' : 'Set a new password')
                ." for {$user->emp_fname} {$user->emp_lname} (employee {$user->emp_id})"
                .($request->boolean('sign_out') ? ' and signed them out' : ''),
            'old_values' => null,
            'new_values' => null, // never record the password, hashed or not
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return back()->with('success', $isDefault
            ? "{$user->emp_lname}, {$user->emp_fname} was reset to the default password and must choose a new one at sign-in."
            : "New password set for {$user->emp_lname}, {$user->emp_fname}.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->is($request->user())) {
            return back()->with('error', 'You cannot delete the account you are signed in with.');
        }

        // Purchase requests, records and more reference users.id, so a delete
        // can fail on a foreign key. Deactivating keeps the audit trail.
        $snapshot = $user->only('emp_id', 'emp_fname', 'emp_lname', 'role_id', 'status_id');

        try {
            $user->delete();
        } catch (\Illuminate\Database\QueryException) {
            return back()->with('error', 'This user has existing records and cannot be deleted. Set them to inactive instead.');
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'deleted',
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'description' => "Deleted user {$snapshot['emp_fname']} {$snapshot['emp_lname']} (employee {$snapshot['emp_id']})",
            'old_values' => $snapshot,
            'new_values' => null,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return to_route('users.index')->with('success', "{$snapshot['emp_lname']}, {$snapshot['emp_fname']} was deleted.");
    }

    private function options(?int $includeStatus = null): array
    {
        return [
            'roles' => Role::orderBy('section')->orderBy('role_name')->get()
                ->map(fn (Role $role) => [
                    'id' => $role->id,
                    'label' => "{$role->role_name} ({$role->section})",
                ]),
            'statuses' => $this->statusOptions($includeStatus),
        ];
    }

    private function statusOptions(?int $alwaysInclude = null)
    {
        return Status::query()
            ->where(function ($query) use ($alwaysInclude) {
                $query->selectable();

                if ($alwaysInclude) {
                    $query->orWhere('id', $alwaysInclude);
                }
            })
            ->orderBy('status_code')
            ->get()
            ->map(fn (Status $status) => [
                'id' => $status->id,
                'code' => (int) $status->status_code,
                'label' => $status->status_desc,
                'selectable' => in_array($status->id, Status::selectableIds(), true),
            ]);
    }
}

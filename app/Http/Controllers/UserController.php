<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\Status;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'emp_id' => $user->emp_id,
                'name' => "{$user->emp_lname}, {$user->emp_fname}",
                'role' => $user->role?->role_name,
                'section' => $user->role?->section,
                'status_id' => $user->status_id,
                'status' => $user->status?->status_desc,
                'is_active' => $user->isActive(),
            ]);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => $request->only('search', 'role', 'status'),
            ...$this->options(),
        ]);
    }

    public function show(Request $request, User $user): Response
    {
        return Inertia::render('Users/Show', [
            'user' => [
                'id' => $user->id,
                'emp_id' => $user->emp_id,
                'emp_fname' => $user->emp_fname,
                'emp_lname' => $user->emp_lname,
                'role' => $user->role?->role_name,
                'section' => $user->role?->section,
                'status_id' => $user->status_id,
                'status' => $user->status?->status_desc,
                'is_active' => $user->isActive(),
                'created_at' => $user->created_at?->format('j M Y, g:i a'),
                'updated_at' => $user->updated_at?->diffForHumans(),
            ],
            // An admin may not deactivate or remove the account they are using.
            'isSelf' => $user->is($request->user()),
            'statuses' => $this->statusOptions($user->status_id),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Users/Create', [
            'defaultStatusId' => Status::activeId(),
            ...$this->options(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        User::create($request->validate($this->rules()));

        return to_route('users.index')->with('success', 'User created.');
    }

    public function edit(User $user): Response
    {
        return Inertia::render('Users/Edit', [
            'user' => $user->only('id', 'emp_id', 'emp_fname', 'emp_lname', 'role_id', 'status_id'),
            ...$this->options($user->status_id),
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate($this->rules($user));

        if ($user->is($request->user())) {
            if ((int) $validated['role_id'] !== $user->role_id) {
                return back()->withErrors([
                    'role_id' => 'Change your own role from another admin account.',
                ]);
            }

            if ((int) $validated['status_id'] !== Status::activeId()) {
                return back()->withErrors([
                    'status_id' => 'You cannot deactivate the account you are signed in with.',
                ]);
            }
        }

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        $user->update($validated);

        return to_route('users.index')->with('success', 'User updated.');
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

        $user->update(['status_id' => $statusId]);

        $status = Status::find($statusId);

        return back()->with(
            'success',
            "{$user->emp_lname}, {$user->emp_fname} is now {$status?->status_desc}."
        );
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        if ($user->is($request->user())) {
            return back()->with('error', 'You cannot delete the account you are signed in with.');
        }

        // Purchase requests, records and more reference users.id, so a delete
        // can fail on a foreign key. Deactivating keeps the audit trail.
        try {
            $user->delete();
        } catch (\Illuminate\Database\QueryException) {
            return back()->with('error', 'This user has existing records and cannot be deleted. Set them to inactive instead.');
        }

        return to_route('users.index')->with('success', 'User deleted.');
    }

    private function rules(?User $user = null): array
    {
        return [
            'emp_id' => [
                'required', 'integer', 'min:1',
                Rule::unique('users', 'emp_id')->ignore($user?->id),
            ],
            'emp_fname' => ['required', 'string', 'max:255'],
            'emp_lname' => ['required', 'string', 'max:255'],
            'role_id' => ['required', Rule::exists('role', 'id')],
            'status_id' => ['required', Rule::in(Status::selectableIds())],
            'password' => [$user ? 'nullable' : 'required', 'confirmed', Password::defaults()],
        ];
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
                'label' => $status->status_desc,
                'selectable' => in_array($status->id, Status::selectableIds(), true),
            ]);
    }
}

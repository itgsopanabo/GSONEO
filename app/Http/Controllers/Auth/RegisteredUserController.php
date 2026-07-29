<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        $roles = Role::select('id', 'role_name','section')
            ->whereNotIn('id', [1])
            ->orderBy('id', 'asc') // Sorts by ID from lowest to highest
            ->get();

        return Inertia::render('Auth/Register',
            ['roles' => $roles]
        );
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            // Fixed: Explicitly pointed unique validation to the 'emp_id' column
            'empID' => ['required', 'integer', 'unique:' . User::class . ',emp_id'],
            'fname' => ['required', 'string', 'max:255'],
            'lname' => ['required', 'string', 'max:255'],
            // Fixed: Standardized to 'integer' and added 'exists' check against the role table
            'role_id' => ['required', 'integer', 'exists:role,id'],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ], [
            // Custom friendly message for the employee portal
            'empID.unique' => 'This Employee ID is already registered to an account.',
        ]);

        $user = User::create([
            'emp_id' => $request->empID,
            'emp_fname' => $request->fname,
            'emp_lname' => $request->lname,
            'role_id' => $request->role_id,
            'password' => Hash::make($request->password),
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }
}

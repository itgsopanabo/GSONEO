<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Middleware\RequirePasswordChange;
use App\Models\AuditLog;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;

class RequiredPasswordChangeController extends Controller
{
    /**
     * Replace the shared default password with one the user chose. They just
     * signed in with the default, so it isn't asked for again here.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! RequirePasswordChange::isRequired($request)) {
            return back();
        }

        $validated = $request->validate([
            'password' => [
                'required',
                'confirmed',
                Password::defaults(),
                function (string $attribute, mixed $value, Closure $fail) {
                    if ($value === config('Users.default_password')) {
                        $fail('Choose a password different from the default one.');
                    }
                },
            ],
        ]);

        $user->forceFill(['password' => $validated['password']])->save();

        $request->session()->forget(RequirePasswordChange::SESSION_KEY);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'password_changed',
            'auditable_type' => $user::class,
            'auditable_id' => $user->id,
            'description' => "{$user->emp_fname} {$user->emp_lname} replaced the default password",
            'old_values' => null,
            'new_values' => null, // never record the password
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return back()->with('success', 'Your new password is set.');
    }
}

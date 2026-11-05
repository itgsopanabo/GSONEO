<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class RequiredPasswordChangeController extends Controller
{
    /**
     * Replace the one-time password from an admin with one the user chose.
     * They just signed in with it, so it isn't asked for again here.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user->hasTemporaryPassword()) {
            return back();
        }

        $validated = $request->validate([
            'password' => [
                'required',
                'confirmed',
                Password::defaults(),
                function (string $attribute, mixed $value, Closure $fail) use ($user) {
                    if (Hash::check($value, $user->getAuthPassword())) {
                        $fail('Choose a password different from your one-time password.');
                    }
                },
            ],
        ]);

        $user->forceFill([
            'password' => $validated['password'],
            'temporary_password_expires_at' => null,
        ])->save();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'password_changed',
            'auditable_type' => $user::class,
            'auditable_id' => $user->id,
            'description' => "{$user->emp_fname} {$user->emp_lname} replaced their one-time password",
            'old_values' => null,
            'new_values' => null, // never record the password
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return back()->with('success', 'Your new password is set.');
    }
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Holds back anyone signed in on a one-time password from an admin until they
 * choose their own, and signs them out once that password has expired.
 *
 * Pages still load so the layout can show the "set up a new password" dialog
 * over them, but nothing can be saved, changed or deleted in the meantime.
 */
class RequirePasswordChange
{
    /** Routes that must keep working while the change is pending. */
    private const ALLOWED_ROUTES = ['password.first-change', 'logout'];

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user?->hasTemporaryPassword()) {
            return $next($request);
        }

        // Still signed in after the one-time password ran out: it is spent.
        if ($user->temporaryPasswordExpired()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors([
                'empID' => 'Your one-time password has expired. Ask an administrator for a new one.',
            ]);
        }

        $readOnly = in_array($request->method(), ['GET', 'HEAD', 'OPTIONS'], true);

        if ($readOnly || in_array($request->route()?->getName(), self::ALLOWED_ROUTES, true)) {
            return $next($request);
        }

        $message = 'Set up a new password before making changes.';

        if ($request->expectsJson() && ! $request->header('X-Inertia')) {
            abort(403, $message);
        }

        return back()->with('error', $message);
    }

    /** Whether the signed-in user is still on a one-time password. */
    public static function isRequired(Request $request): bool
    {
        return (bool) $request->user()?->hasTemporaryPassword();
    }
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * Ends the session the moment an account stops being active, rather than
     * waiting for the next sign-in. Runs on every authenticated request, but
     * the status relation is eager loaded on User, so it costs no extra query.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->isActive()) {
            Auth::logout();

            $request->session()->invalidate();
            $request->session()->regenerateToken();

            $message = 'Your account has been deactivated. Please contact an administrator.';

            // An in-flight fetch or API call gets a status code it can act on
            // rather than a redirect it would render inside the current page.
            if ($request->expectsJson()) {
                abort(401, $message);
            }

            return redirect()->route('login')->with('error', $message);
        }

        return $next($request);
    }
}

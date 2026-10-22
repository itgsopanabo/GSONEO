<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

/**
 * Holds back anyone still signed in with the shared default password
 * (config Users.default_password) until they choose their own.
 *
 * Pages still load so the layout can show the "set up a new password" dialog
 * over them, but nothing can be saved, changed or deleted in the meantime.
 */
class RequirePasswordChange
{
    /** Session key holding the result, so the slow hash check runs once per password. */
    public const SESSION_KEY = 'default_password_check';

    /** Routes that must keep working while the change is pending. */
    private const ALLOWED_ROUTES = ['password.first-change', 'logout'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! static::isRequired($request)) {
            return $next($request);
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

    /**
     * Whether the signed-in user still has the default password.
     *
     * The result is remembered against a fingerprint of the stored hash, so it
     * is recomputed automatically after the password changes by any route.
     */
    public static function isRequired(Request $request): bool
    {
        $user = $request->user();
        $default = config('Users.default_password');

        if (! $user || blank($default) || ! $request->hasSession()) {
            return false;
        }

        $fingerprint = hash('sha256', (string) $user->getAuthPassword());
        $cached = $request->session()->get(self::SESSION_KEY);

        if (($cached['fingerprint'] ?? null) !== $fingerprint) {
            $cached = [
                'fingerprint' => $fingerprint,
                'required' => Hash::check($default, (string) $user->getAuthPassword()),
            ];
            $request->session()->put(self::SESSION_KEY, $cached);
        }

        return (bool) $cached['required'];
    }
}

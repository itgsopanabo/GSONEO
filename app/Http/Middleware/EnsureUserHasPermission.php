<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasPermission
{
    /**
     * Usage: ->middleware('permission:pr.verify')
     * Any of several: ->middleware('permission:inventory.incoming,inventory.outgoing')
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'Unauthenticated.');
        }

        if (! $user->hasAnyPermission($permissions)) {
            abort(403, 'You do not have permission to access this page.');
        }

        return $next($request);
    }
}

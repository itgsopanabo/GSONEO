<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserSection
{

    /**
     * Handle an incoming request.
     *
     * Usage: ->middleware('section:Procurement')
     * Supports multiple allowed sections: ->middleware('section:Procurement,Motor Pool')
     */
    public function handle(Request $request, Closure $next, string ...$sections): Response
    {
        $user = $request->user();

        if (! $user) {
            abort(403, 'Unauthenticated.');
        }

        $userSection = $user->role?->section;

        if (! $userSection || ! in_array($userSection, $sections, true)) {
            abort(403, 'You are not authorized to access this section.');
        }

        return $next($request);
    }
}

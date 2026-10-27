<?php

namespace App\Http\Middleware;

use App\Http\Controllers\MissingTrackerController;
use App\Models\Departments;
use App\Models\TrackerTag;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                // Permission names from the user's role; the menu reads these.
                'permissions' => fn () => $request->user()?->permissionNames() ?? [],
            ],
            'flash' => [
                'success' => fn() => $request->session()->get('success'),
                'error' => fn() => $request->session()->get('error'),
                'po_number' => fn() => $request->session()->get('po_number'),
                'created_pr' => fn() => $request->session()->get('created_pr'),
                // A one-time password an admin just issued, shown to them once.
                'temporary_password' => fn() => $request->session()->get('temporary_password'),
            ],
            'csrf_token' => csrf_token(),
            // The tags offered when marking an order as missing something. Only
            // inventory staff tag orders, so nobody else is sent the list.
            // The requesting offices every form offers, kept on the Requesting Offices screen.
            'offices' => fn () => $request->user() ? Departments::options() : [],
            'trackerTags' => fn () => $request->user()?->hasAnyPermission(MissingTrackerController::PERMISSIONS)
                ? TrackerTag::options()
                : [],
            // True while the user is still on a one-time password from an admin;
            // the layout then shows the "set up a new password" dialog.
            'mustChangePassword' => fn () => RequirePasswordChange::isRequired($request),
        ];
    }
}

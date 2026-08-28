<?php

namespace App\Http\Middleware;

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
                'can' => [
                    'verify_pr' => $request->user() ? $request->user()->can('verify-pr') : false,
                    'canvass' => $request->user() ? $request->user()->can('canvass') : false,
                    'proceedPO' => $request->user() ? $request->user()->can('proceedPO') : false,
                    'proceedIAR' => $request->user() ? $request->user()->can('proceedIAR') : false,
                ],
            ],
            'flash' => [
                'success' => fn() => $request->session()->get('success'),
                'error' => fn() => $request->session()->get('error'),
                'po_number' => fn() => $request->session()->get('po_number'),
                'created_pr' => fn() => $request->session()->get('created_pr'),
            ],
            'csrf_token' => csrf_token(),
        ];
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\PurchaseRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * Show the dashboard with live PR counts and the most recent requests.
     *
     * ASSUMPTIONS (adjust to match your actual `purchase_requests` schema):
     *  - table has columns: pr_number, requester_name, status, requester_department, created_at
     *  - status is an integer status_code (0 Pending, 100 Verified, 200-203 Canvassing
     *    variants, 300 Completed, 400 Rejected)
     *  - verify_by_emp_id stores the verifying user's `users.id` (Auth::id()).
     *    If it actually stores the human-readable emp_id instead, swap
     *    Auth::id() for Auth::user()->emp_id below.
     */
    public function index()
    {
        // Pull only what the view needs, most recent first, capped at 10
        // (5 visible rows + a few extra behind the fade mask, matches current UI)
        $recentRequests = PurchaseRequest::query()
            ->orderByDesc('created_at')
            ->take(10)
            ->get(['pr_number', 'requester_name', 'status', 'requester_department', 'created_at'])
            ->map(fn ($pr) => [
                'pr_num'    => $pr->pr_number,
                'requester' => $pr->requester_name,
                'status'    => $pr->status,
                'dept'      => $pr->requester_department,
                // cast to Y-m-d string so the frontend doesn't need to parse dates
                'date'      => Carbon::parse($pr->created_at)->format('Y-m-d'),
            ]);

        // PRs verified by the currently logged-in employee
        $verifiedByMe = PurchaseRequest::query()
            ->where('verify_by_emp_id', Auth::id())
            ->orderByDesc('verified_At')
            ->take(10)
            ->get(['pr_number', 'requester_name', 'status', 'requester_department', 'verified_At'])
            ->map(fn ($pr) => [
                'pr_num'    => $pr->pr_number,
                'requester' => $pr->requester_name,
                'status'    => $pr->status,
                'dept'      => $pr->requester_department,
                'date'      => $pr->verified_At ? Carbon::parse($pr->verified_At)->format('Y-m-d') : null,
            ]);

        // PR count grouped by department, for the pie chart
        $requestsByDept = PurchaseRequest::query()
            ->selectRaw('requester_department as dept, COUNT(*) as total')
            ->groupBy('requester_department')
            ->orderByDesc('total')
            ->get();

        return Inertia::render('Dashboard', [
            'purchaseRequests' => $recentRequests,
            'verifiedByMe' => $verifiedByMe,
            'requestsByDept' => $requestsByDept,
            'stats' => [
                'totalReceived' => PurchaseRequest::count(),
                'pending'       => PurchaseRequest::where('status', 0)->count(),
                'verified'      => PurchaseRequest::where('status', 100)->count(),
                'verifiedByMeCount' => PurchaseRequest::where('verify_by_emp_id', Auth::id())->count(),
            ],
        ]);
    }
}

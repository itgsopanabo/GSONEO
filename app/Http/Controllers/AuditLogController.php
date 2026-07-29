<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AuditLogController extends Controller
{
    /**
     * Display a listing of the audit logs.
     */
    public function index(Request $request)
    {
        // Eager load the user relationship.
        // Note: 'auditable' works out-of-the-box if the target models exist.
        $logs = AuditLog::with(['user'])
            ->latest()
            ->paginate(10)
            ->withQueryString(); // Keeps pagination links working with filters later



        return Inertia::render('AuditLogs/IncomingIndex', [
            'logs' => $logs
        ]);

    }

    /**
     * Display the specified audit log.
     */
    public function show(AuditLog $auditLog)
    {
        $auditLog->load(['user']);

        return Inertia::render('AuditLogs/Show', [
            'log' => $auditLog
        ]);
    }
}

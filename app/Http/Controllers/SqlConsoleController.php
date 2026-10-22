<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\SavedQuery;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/**
 * Runs read-only SQL typed by an administrator.
 *
 * The real protection is the connection: `mysql_readonly` authenticates as a
 * database user granted nothing but SELECT, so a write cannot succeed even if
 * every check below is defeated. Treat the checks as a way to give a clear
 * error message, not as the security boundary — SQL parsing by regular
 * expression is not something to bet a database on.
 */
class SqlConsoleController extends Controller
{
    use LogsAudit;

    private const CONNECTION = 'mysql_readonly';

    private const ROW_LIMIT = 1000;

    private const TIMEOUT_MS = 8000;

    /** Rejected outright. Redundant against a SELECT-only grant, but it fails fast and explains why. */
    private const FORBIDDEN = [
        'insert', 'update', 'delete', 'drop', 'truncate', 'alter', 'create',
        'rename', 'replace', 'grant', 'revoke', 'commit', 'rollback',
        'call', 'handler', 'lock', 'unlock', 'prepare', 'execute', 'deallocate',
        'outfile', 'dumpfile', 'load_file', 'load data', 'into out',
    ];

    /** Schemas holding credentials or server internals. */
    private const FORBIDDEN_SCHEMAS = ['mysql.', 'performance_schema.', 'sys.'];

    /**
     * Framework plumbing and audit trails — kept out of the reference panel so
     * the list shows business tables rather than 20 rows of Laravel internals.
     */
    private const HIDDEN_TABLES = [
        'migrations',
        'jobs',
        'job_batches',
        'failed_jobs',
        'cache',
        'cache_locks',
        'sessions',
        'password_reset_tokens',
        'personal_access_tokens',
        'audit_logs',
        'audit_log',
        'notifications',
    ];

    /** Anything starting with these is hidden too — Telescope, Horizon, and friends. */
    private const HIDDEN_TABLE_PREFIXES = ['telescope_', 'horizon_', 'pulse_'];

    public function index(Request $request)
    {
        $this->authorizeConsole($request);

        // ?saved=ID runs a saved query, so a report can be bookmarked.
        $saved = $request->filled('saved')
            ? SavedQuery::visibleTo($request->user())->findOrFail($request->integer('saved'))
            : null;

        $sql = $saved ? $saved->sql : trim((string) $request->input('sql', ''));
        $result = null;
        $error = null;

        if ($sql !== '') {
            try {
                $this->guard($sql);
                $result = $this->execute($sql, $request->input('export') === 'csv');

                $this->record($sql, $result['count']);
                $saved?->forceFill(['run_count' => $saved->run_count + 1, 'last_run_at' => now()])->saveQuietly();

                if ($request->input('export') === 'csv') {
                    return $this->csv($result, $saved?->name);
                }
            } catch (Throwable $e) {
                $error = $e->getMessage();
                $this->record($sql, null, $error);
            }
        }

        return Inertia::render('CustomReport/SqlConsole', [
            'savedQueries' => $this->savedQueriesFor($request->user()),
            'loadedQuery' => $saved?->only(['id', 'name']),
            'sql'         => $sql,
            'headers'     => $result['headers'] ?? [],
            'rows'        => $result['rows'] ?? [],
            'rowCount'    => $result['count'] ?? 0,
            'truncated'   => $result['truncated'] ?? false,
            'elapsedMs'   => $result['elapsed'] ?? null,
            'error'       => $error,
            'rowLimit'    => self::ROW_LIMIT,
            'tables'      => $this->tableList(),
            'generatedAt' => now()->toDateTimeString(),
        ]);
    }

    // ------------------------------------------------------------------
    // Saved queries
    // ------------------------------------------------------------------

    public function storeSaved(Request $request): RedirectResponse
    {
        $this->authorizeConsole($request);
        $data = $this->validatedSaved($request);

        $saved = SavedQuery::create($data + ['created_by_emp_id' => $request->user()->emp_id]);

        $this->audit('Saved query added', $saved, "Saved the SQL console query \"{$saved->name}\"".($saved->is_shared ? ', shared' : '').'.', null, $saved->only(['name', 'sql', 'is_shared']));

        return redirect()
            ->route('sql-console.index', ['saved' => $saved->id])
            ->with('success', "\"{$saved->name}\" saved.");
    }

    public function updateSaved(Request $request, SavedQuery $savedQuery): RedirectResponse
    {
        $this->authorizeConsole($request);
        abort_unless($savedQuery->ownedBy($request->user()), 403, 'Only the person who saved this query can change it.');

        $before = $savedQuery->only(['name', 'description', 'sql', 'is_shared']);
        $savedQuery->update($this->validatedSaved($request, $savedQuery));

        $this->audit('Saved query updated', $savedQuery, "Updated the saved SQL console query \"{$savedQuery->name}\".", $before, $savedQuery->only(['name', 'description', 'sql', 'is_shared']));

        return redirect()
            ->route('sql-console.index', ['saved' => $savedQuery->id])
            ->with('success', "\"{$savedQuery->name}\" updated.");
    }

    public function destroySaved(Request $request, SavedQuery $savedQuery): RedirectResponse
    {
        $this->authorizeConsole($request);
        abort_unless($savedQuery->ownedBy($request->user()), 403, 'Only the person who saved this query can delete it.');

        $before = $savedQuery->only(['name', 'sql', 'is_shared']);
        $name = $savedQuery->name;
        $savedQuery->delete();

        $this->audit('Saved query deleted', $savedQuery, "Deleted the saved SQL console query \"{$name}\".", $before);

        return redirect()->route('sql-console.index')->with('success', "\"{$name}\" deleted.");
    }

    /**
     * The SQL goes through the same check as running it, so a saved query is
     * always one the console will run.
     */
    private function validatedSaved(Request $request, ?SavedQuery $existing = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120', Rule::unique('saved_queries', 'name')
                ->where('created_by_emp_id', $request->user()->emp_id)
                ->ignore($existing)],
            'description' => ['nullable', 'string', 'max:255'],
            'sql' => ['required', 'string', 'max:20000'],
            'is_shared' => ['boolean'],
        ], [
            'name.unique' => 'You already have a saved query with this name.',
        ]);

        try {
            $this->guard(trim($data['sql']));
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['sql' => $e->getMessage()]);
        }

        return ['sql' => trim($data['sql']), 'is_shared' => (bool) ($data['is_shared'] ?? false)] + $data;
    }

    /** This person's own queries first, then what others have shared. */
    private function savedQueriesFor($user): array
    {
        return SavedQuery::visibleTo($user)
            ->with('owner:emp_id,emp_fname,emp_lname')
            ->orderByRaw('created_by_emp_id = ? DESC', [$user?->emp_id])
            ->orderBy('name')
            ->get()
            ->map(fn (SavedQuery $q) => [
                'id' => $q->id,
                'name' => $q->name,
                'description' => $q->description,
                'sql' => $q->sql,
                'is_shared' => $q->is_shared,
                'mine' => $q->ownedBy($user),
                'owner' => $q->owner ? trim("{$q->owner->emp_fname} {$q->owner->emp_lname}") : null,
                'run_count' => $q->run_count,
                'last_run_at' => $q->last_run_at?->toIso8601String(),
            ])
            ->all();
    }

    // ------------------------------------------------------------------

    /**
     * Console access is separate from ordinary admin access — anyone who can
     * open this can read every row in the database, including other people's
     * records.
     */
    private function authorizeConsole(Request $request): void
    {
        abort_unless($request->user()?->hasPermission('reports.sql'), 403, 'The SQL console is restricted.');
    }

    private function guard(string $sql): void
    {
        // Comments can hide keywords from the checks below, so refuse them.
        if (preg_match('#(/\*|--\s|\#)#', $sql)) {
            throw new \RuntimeException('Comments are not allowed in console queries.');
        }

        $trimmed = rtrim($sql, "; \t\n\r");

        if (str_contains($trimmed, ';')) {
            throw new \RuntimeException('Run one statement at a time.');
        }

        if (! preg_match('/^\s*(select|with)\s/i', $trimmed)) {
            throw new \RuntimeException('Only SELECT queries can be run here.');
        }

        $lower = strtolower($trimmed);

        foreach (self::FORBIDDEN as $word) {
            // Word boundaries so "created_at" doesn't trip the "create" check.
            if (preg_match('/\b' . preg_quote($word, '/') . '\b/', $lower)) {
                throw new \RuntimeException("The keyword \"{$word}\" is not permitted.");
            }
        }

        foreach (self::FORBIDDEN_SCHEMAS as $schema) {
            if (str_contains($lower, $schema)) {
                throw new \RuntimeException('That schema is out of scope for the console.');
            }
        }
    }

    private function execute(string $sql, bool $full): array
    {
        $trimmed = rtrim($sql, "; \t\n\r");

        // Wrapping rather than appending LIMIT — appending breaks on queries
        // that already have one, and on UNION.
        $limited = $full
            ? $trimmed
            : "SELECT * FROM ({$trimmed}) AS console_result LIMIT " . (self::ROW_LIMIT + 1);

        $connection = DB::connection(self::CONNECTION);

        // Stops a careless cross join from occupying the server. MySQL 5.7.8+.
        $connection->statement('SET SESSION MAX_EXECUTION_TIME = ' . self::TIMEOUT_MS);

        $started = microtime(true);
        $rows = $connection->select($limited);
        $elapsed = (int) round((microtime(true) - $started) * 1000);

        $truncated = ! $full && count($rows) > self::ROW_LIMIT;

        if ($truncated) {
            array_pop($rows);
        }

        return [
            'headers'   => empty($rows) ? [] : array_keys((array) $rows[0]),
            'rows'      => $rows,
            'count'     => count($rows),
            'truncated' => $truncated,
            'elapsed'   => $elapsed,
        ];
    }

    /** Table names for the reference panel, so nobody has to guess. */
    private function tableList(): array
    {
        try {
            return collect(DB::connection(self::CONNECTION)->select('SHOW TABLES'))
                ->map(fn ($row) => array_values((array) $row)[0])
                ->reject(fn ($table) => $this->isHidden($table))
                ->sort()
                ->values()
                ->all();
        } catch (Throwable) {
            return [];
        }
    }

    private function isHidden(string $table): bool
    {
        $name = strtolower($table);

        if (in_array($name, self::HIDDEN_TABLES, true)) {
            return true;
        }

        foreach (self::HIDDEN_TABLE_PREFIXES as $prefix) {
            if (str_starts_with($name, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Every query is logged with who ran it. On a system holding procurement
     * records, an unlogged ad-hoc query tool is an audit finding waiting to
     * happen.
     */
    private function record(string $sql, ?int $rows, ?string $error = null): void
    {
        Log::channel(config('logging.default'))->info('SQL console query', [
            'emp_id'  => Auth::user()?->emp_id,
            'sql'     => $sql,
            'rows'    => $rows,
            'error'   => $error,
            'ip'      => request()->ip(),
        ]);
    }

    private function csv(array $result, ?string $name = null): StreamedResponse
    {
        // A saved query downloads under its own name: "monthly-pos-2026-10-20-0930.csv".
        $file = ($name ? \Illuminate\Support\Str::slug($name) : 'query').'-'.now()->format('Y-m-d-Hi').'.csv';

        return response()->streamDownload(function () use ($result) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, $result['headers']);

            foreach ($result['rows'] as $row) {
                fputcsv($out, array_values((array) $row));
            }

            fclose($out);
        }, $file, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}

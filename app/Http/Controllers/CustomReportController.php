<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomReportController extends Controller
{
    /**
     * Datasets the builder can report on. Each names a base table and the joins
     * that hang off it; the columns themselves are read from the live schema,
     * so adding a table here is all that's needed to expose it.
     *
     * Nothing outside this array can be queried. Every table, column, operator
     * and direction in the request is checked against what's declared here
     * before it reaches SQL — user input never becomes an identifier.
     */
    private const DATASETS = [
        'procurement' => [
            'label' => 'Requests with purchase orders',
            'base'  => ['table' => 'purchase_requests', 'alias' => 'pr'],
            'joins' => [
                ['type' => 'left', 'table' => 'purchase_order', 'alias' => 'po', 'first' => 'po.PR_Number', 'second' => 'pr.pr_number'],
                ['type' => 'left', 'table' => 'status', 'alias' => 'st', 'first' => 'st.status_code', 'second' => 'pr.status'],
                ['type' => 'left', 'table' => 'users', 'alias' => 'vb', 'first' => 'vb.emp_id', 'second' => 'pr.verify_by_emp_id'],
            ],
        ],
        'requests' => [
            'label' => 'Purchase requests only',
            'base'  => ['table' => 'purchase_requests', 'alias' => 'pr'],
            'joins' => [
                ['type' => 'left', 'table' => 'status', 'alias' => 'st', 'first' => 'st.status_code', 'second' => 'pr.status'],
            ],
        ],
        'orders' => [
            'label' => 'Purchase orders only',
            'base'  => ['table' => 'purchase_order', 'alias' => 'po'],
            'joins' => [
                ['type' => 'left', 'table' => 'status', 'alias' => 'st', 'first' => 'st.status_code', 'second' => 'po.status'],
                ['type' => 'left', 'table' => 'users', 'alias' => 'nb', 'first' => 'nb.emp_id', 'second' => 'po.poNumbered_by'],
            ],
        ],
        'users' => [
            'label' => 'Users and roles',
            'base'  => ['table' => 'users', 'alias' => 'u'],
            'joins' => [
                ['type' => 'left', 'table' => 'role', 'alias' => 'r', 'first' => 'r.id', 'second' => 'u.role_id'],
            ],
        ],
    ];

    /** Never offered as a column, whatever table it turns up in. */
    private const HIDDEN_COLUMNS = ['password', 'remember_token'];

    private const OPERATORS = [
        'eq'       => ['label' => 'is', 'sql' => '='],
        'neq'      => ['label' => 'is not', 'sql' => '!='],
        'contains' => ['label' => 'contains', 'sql' => 'like'],
        'gt'       => ['label' => 'is after / greater than', 'sql' => '>'],
        'lt'       => ['label' => 'is before / less than', 'sql' => '<'],
        'empty'    => ['label' => 'is blank', 'sql' => null],
        'filled'   => ['label' => 'is not blank', 'sql' => null],
    ];

    private const AGGREGATES = ['count', 'sum', 'avg', 'min', 'max'];

    private const PREVIEW_LIMIT = 500;

    public function index(Request $request)
    {
        $dataset = array_key_exists($request->input('dataset'), self::DATASETS)
            ? $request->input('dataset')
            : array_key_first(self::DATASETS);

        $available = $this->availableColumns($dataset);

        $columns = $this->validColumns($request->input('columns', []), $available);
        $filters = $this->validFilters($request->input('filters', []), $available);
        $groupBy = $this->validColumn($request->input('group_by'), $available);
        $aggregates = $this->validAggregates($request->input('aggregates', []), $available);
        $sort = $this->validColumn($request->input('sort'), $available);
        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';

        // Nothing chosen yet — show the first handful so the page isn't empty.
        if (empty($columns) && ! $groupBy) {
            $columns = array_slice(array_keys($available), 0, 5);
        }

        $result = $this->run($dataset, $columns, $filters, $groupBy, $aggregates, $sort, $direction, $request->input('export') === 'csv');

        if ($request->input('export') === 'csv') {
            return $this->csv($dataset, $result);
        }

        return Inertia::render('CustomReport/Index', [
            'dataset'     => $dataset,
            'datasets'    => collect(self::DATASETS)->map(fn ($d, $k) => ['key' => $k, 'label' => $d['label']])->values(),
            'available'   => $available,
            'operators'   => collect(self::OPERATORS)->map(fn ($o, $k) => ['key' => $k, 'label' => $o['label']])->values(),
            'aggregateFns' => self::AGGREGATES,
            'selection'   => [
                'columns'    => $columns,
                'filters'    => $filters,
                'group_by'   => $groupBy,
                'aggregates' => $aggregates,
                'sort'       => $sort,
                'direction'  => $direction,
            ],
            'headers'     => $result['headers'],
            'rows'        => $result['rows'],
            'rowCount'    => $result['count'],
            'truncated'   => $result['truncated'],
            'generatedAt' => now()->toDateTimeString(),
        ]);
    }

    // ------------------------------------------------------------------
    // Schema discovery
    // ------------------------------------------------------------------

    /**
     * Every selectable column in a dataset, keyed "alias.column", read from the
     * database rather than hardcoded — so a new migration shows up on its own.
     */
    private function availableColumns(string $dataset): array
    {
        $config = self::DATASETS[$dataset];
        $tables = array_merge([$config['base']], $config['joins']);

        $columns = [];

        foreach ($tables as $t) {
            if (! Schema::hasTable($t['table'])) {
                continue;
            }

            foreach (Schema::getColumnListing($t['table']) as $column) {
                if (in_array($column, self::HIDDEN_COLUMNS, true)) {
                    continue;
                }

                $key = "{$t['alias']}.{$column}";

                $columns[$key] = [
                    'key'   => $key,
                    'table' => $t['table'],
                    'label' => $this->humanize($column),
                    'type'  => $this->columnType($t['table'], $column),
                ];
            }
        }

        return $columns;
    }

    private function columnType(string $table, string $column): string
    {
        $type = Schema::getColumnType($table, $column);

        return match (true) {
            in_array($type, ['date', 'datetime', 'timestamp'], true) => 'date',
            in_array($type, ['integer', 'bigint', 'smallint', 'decimal', 'float', 'double'], true) => 'number',
            default => 'text',
        };
    }

    private function humanize(string $column): string
    {
        $words = str_replace('_', ' ', $column);

        return ucfirst(trim(preg_replace('/\s+/', ' ', $words)));
    }

    // ------------------------------------------------------------------
    // Request validation — the only thing standing between input and SQL
    // ------------------------------------------------------------------

    private function validColumn(?string $key, array $available): ?string
    {
        return $key && isset($available[$key]) ? $key : null;
    }

    private function validColumns($columns, array $available): array
    {
        if (! is_array($columns)) {
            return [];
        }

        return array_values(array_filter($columns, fn ($c) => is_string($c) && isset($available[$c])));
    }

    private function validFilters($filters, array $available): array
    {
        if (! is_array($filters)) {
            return [];
        }

        $clean = [];

        foreach ($filters as $filter) {
            if (! is_array($filter)) {
                continue;
            }

            $column = $filter['column'] ?? null;
            $operator = $filter['operator'] ?? null;

            if (! isset($available[$column]) || ! isset(self::OPERATORS[$operator])) {
                continue;
            }

            $needsValue = self::OPERATORS[$operator]['sql'] !== null;
            $value = $filter['value'] ?? null;

            if ($needsValue && ($value === null || $value === '')) {
                continue;   // incomplete row, still being typed
            }

            $clean[] = [
                'column'   => $column,
                'operator' => $operator,
                'value'    => $needsValue ? (string) $value : null,
            ];
        }

        return $clean;
    }

    private function validAggregates($aggregates, array $available): array
    {
        if (! is_array($aggregates)) {
            return [];
        }

        $clean = [];

        foreach ($aggregates as $agg) {
            if (! is_array($agg)) {
                continue;
            }

            $column = $agg['column'] ?? null;
            $fn = strtolower($agg['fn'] ?? '');

            if (! isset($available[$column]) || ! in_array($fn, self::AGGREGATES, true)) {
                continue;
            }

            $clean[] = ['column' => $column, 'fn' => $fn];
        }

        return $clean;
    }

    // ------------------------------------------------------------------
    // Query
    // ------------------------------------------------------------------

    private function run(
        string $dataset,
        array $columns,
        array $filters,
        ?string $groupBy,
        array $aggregates,
        ?string $sort,
        string $direction,
        bool $full
    ): array {
        $config = self::DATASETS[$dataset];
        $available = $this->availableColumns($dataset);

        $query = DB::table("{$config['base']['table']} as {$config['base']['alias']}");

        foreach ($config['joins'] as $join) {
            if (! Schema::hasTable($join['table'])) {
                continue;
            }
            $method = $join['type'] === 'left' ? 'leftJoin' : 'join';
            $query->{$method}("{$join['table']} as {$join['alias']}", $join['first'], '=', $join['second']);
        }

        foreach ($filters as $filter) {
            $sql = self::OPERATORS[$filter['operator']]['sql'];

            if ($filter['operator'] === 'empty') {
                $query->whereNull($filter['column']);
            } elseif ($filter['operator'] === 'filled') {
                $query->whereNotNull($filter['column']);
            } elseif ($filter['operator'] === 'contains') {
                $query->where($filter['column'], 'like', '%' . $filter['value'] . '%');
            } else {
                $query->where($filter['column'], $sql, $filter['value']);
            }
        }

        $headers = [];
        $selects = [];

        if ($groupBy) {
            $alias = $this->alias($groupBy);
            $selects[] = DB::raw("{$groupBy} as `{$alias}`");
            $headers[] = ['key' => $alias, 'label' => $available[$groupBy]['label'], 'type' => $available[$groupBy]['type']];

            // A grouped report with no aggregate is just a distinct list, so
            // give it a row count to be useful.
            if (empty($aggregates)) {
                $aggregates = [['column' => $groupBy, 'fn' => 'count']];
            }

            foreach ($aggregates as $agg) {
                $alias = $agg['fn'] . '_' . $this->alias($agg['column']);
                $selects[] = DB::raw(strtoupper($agg['fn']) . "({$agg['column']}) as `{$alias}`");
                $headers[] = [
                    'key'   => $alias,
                    'label' => ucfirst($agg['fn']) . ' of ' . $available[$agg['column']]['label'],
                    'type'  => $agg['fn'] === 'count' ? 'number' : $available[$agg['column']]['type'],
                ];
            }

            $query->groupBy(DB::raw($groupBy));
        } else {
            foreach ($columns as $column) {
                $alias = $this->alias($column);
                $selects[] = DB::raw("{$column} as `{$alias}`");
                $headers[] = ['key' => $alias, 'label' => $available[$column]['label'], 'type' => $available[$column]['type']];
            }
        }

        // Sorting by a column that isn't selected confuses only_full_group_by,
        // so fall back to the first header instead.
        if ($sort && ! $groupBy) {
            $query->orderBy($sort, $direction);
        } elseif (! empty($headers)) {
            $query->orderBy(DB::raw("`{$headers[0]['key']}`"), $direction);
        }

        $count = (clone $query)->count();

        if (! $full) {
            $query->limit(self::PREVIEW_LIMIT);
        }

        return [
            'headers'   => $headers,
            'rows'      => $query->get($selects),
            'count'     => $count,
            'truncated' => ! $full && $count > self::PREVIEW_LIMIT,
        ];
    }

    /** "pr.pr_number" is not a legal result key in JS, so flatten it. */
    private function alias(string $column): string
    {
        return str_replace('.', '__', $column);
    }

    // ------------------------------------------------------------------

    private function csv(string $dataset, array $result): StreamedResponse
    {
        $filename = 'report-' . $dataset . '-' . now()->format('Y-m-d-Hi') . '.csv';

        return response()->streamDownload(function () use ($result) {
            $out = fopen('php://output', 'w');

            // Excel reads a bare UTF-8 CSV as Windows-1252 without this.
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, array_column($result['headers'], 'label'));

            foreach ($result['rows'] as $row) {
                fputcsv($out, array_map(fn ($h) => $row->{$h['key']} ?? '', $result['headers']));
            }

            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}

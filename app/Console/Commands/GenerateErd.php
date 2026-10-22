<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

/**
 * Reads the live database schema and writes an entity relationship diagram.
 *
 *   php artisan erd:generate
 *
 * Writes to docs/erd/:
 *   erd.html  the viewer shown on the Docs page (pan, zoom, search, SVG/PNG download).
 *             It loads Mermaid from the app's build, so it is opened through the app
 *             (Docs → ERD), not from disk, and needs `npm run build` to have run.
 *   erd.md    Mermaid diagram plus a column reference per table (GitHub, VS Code)
 *   erd.mmd   the diagram alone, for mermaid.live or other Mermaid tools
 *
 * Relationships come from real foreign keys only; columns that are joined in
 * code without a database constraint do not appear as lines.
 */
class GenerateErd extends Command
{
    protected $signature = 'erd:generate
        {--path=docs/erd : Folder to write to, relative to the project root}
        {--only= : Comma-separated tables to include (overrides the default exclusions)}
        {--all : Include framework tables such as sessions, cache and jobs}';

    protected $description = 'Generate an ERD (Mermaid) from the database schema into docs/erd';

    /** Laravel housekeeping tables left out unless --all is given. */
    private const FRAMEWORK_TABLES = [
        'migrations', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs',
        'sessions', 'password_reset_tokens',
    ];

    public function handle(): int
    {
        $tables = $this->tables();

        if ($tables->isEmpty()) {
            $this->error('No tables found. Check the database connection and run migrations first.');

            return self::FAILURE;
        }

        $schema = $tables->mapWithKeys(fn (string $table) => [$table => [
            'columns' => Schema::getColumns($table),
            'indexes' => Schema::getIndexes($table),
            'foreignKeys' => Schema::getForeignKeys($table),
        ]]);

        $relationships = $this->relationships($schema);
        $mermaid = $this->mermaid($schema, $relationships);

        $directory = base_path(trim($this->option('path'), '/\\'));
        File::ensureDirectoryExists($directory);
        File::put($directory.'/erd.mmd', $mermaid);
        File::put($directory.'/erd.md', $this->markdown($schema, $relationships, $mermaid));
        File::put($directory.'/erd.html', $this->html($schema, $relationships, $mermaid));

        $this->info(sprintf('ERD generated: %d tables, %d relationships.', $schema->count(), count($relationships)));
        $this->line('  '.$this->relative($directory.'/erd.md'));
        $this->line('  '.$this->relative($directory.'/erd.mmd'));
        $this->line('  '.$this->relative($directory.'/erd.html').'  ← shown on the Docs → ERD page');

        return self::SUCCESS;
    }

    /** @return Collection<int, string> */
    private function tables(): Collection
    {
        $all = collect(Schema::getTables())->pluck('name')->sort()->values();

        if ($only = $this->option('only')) {
            $wanted = collect(explode(',', $only))->map(fn ($t) => trim($t))->filter();
            $missing = $wanted->diff($all);

            if ($missing->isNotEmpty()) {
                $this->warn('Not found, skipped: '.$missing->join(', '));
            }

            return $all->intersect($wanted)->values();
        }

        return $this->option('all')
            ? $all
            : $all->reject(fn (string $table) => in_array($table, self::FRAMEWORK_TABLES, true))->values();
    }

    /**
     * One entry per foreign key whose both ends are in the diagram.
     *
     * @return array<int, array{parent: string, child: string, columns: array, parentColumns: array, nullable: bool, unique: bool}>
     */
    private function relationships(Collection $schema): array
    {
        $relationships = [];

        foreach ($schema as $table => $info) {
            foreach ($info['foreignKeys'] as $fk) {
                if (! $schema->has($fk['foreign_table'])) {
                    continue;
                }

                $columns = collect($info['columns'])->whereIn('name', $fk['columns']);

                $relationships[] = [
                    'parent' => $fk['foreign_table'],
                    'child' => $table,
                    'columns' => $fk['columns'],
                    'parentColumns' => $fk['foreign_columns'],
                    'nullable' => $columns->contains('nullable', true),
                    // A unique index on exactly the FK columns makes it one-to-one.
                    'unique' => collect($info['indexes'])->contains(
                        fn ($index) => $index['unique'] && $index['columns'] === $fk['columns']
                    ),
                ];
            }
        }

        return $relationships;
    }

    private function mermaid(Collection $schema, array $relationships): string
    {
        $lines = ['erDiagram'];

        foreach ($schema as $table => $info) {
            [$primary, $unique, $foreign] = $this->keyColumns($info);

            $lines[] = '    '.$this->entity($table).' {';

            foreach ($info['columns'] as $column) {
                $keys = array_values(array_filter([
                    in_array($column['name'], $primary, true) ? 'PK' : null,
                    in_array($column['name'], $foreign, true) ? 'FK' : null,
                    in_array($column['name'], $unique, true) ? 'UK' : null,
                ]));

                $lines[] = sprintf(
                    '        %s %s%s%s',
                    $this->word($column['type_name']),
                    $this->word($column['name']),
                    $keys ? ' '.implode(', ', $keys) : '',
                    $column['nullable'] ? ' "nullable"' : '',
                );
            }

            $lines[] = '    }';
        }

        foreach ($relationships as $rel) {
            $lines[] = sprintf(
                '    %s %s--%s %s : "%s"',
                $this->entity($rel['parent']),
                $rel['nullable'] ? '|o' : '||',
                $rel['unique'] ? 'o|' : 'o{',
                $this->entity($rel['child']),
                str_replace('"', "'", implode(', ', $rel['columns'])),
            );
        }

        return implode("\n", $lines)."\n";
    }

    private function markdown(Collection $schema, array $relationships, string $mermaid): string
    {
        $out = [
            '# Entity Relationship Diagram',
            '',
            '> Generated by `php artisan erd:generate` on '.$this->generatedAt().' from the `'.$this->databaseName().'` database.',
            '> For pan, zoom and search, open the Docs → ERD page in the app.',
            '> Do not edit by hand — run the command again after migrations change.',
            '',
            sprintf('**%d tables · %d relationships.** Lines come from database foreign keys only.', $schema->count(), count($relationships)),
            '',
            'Cardinality: `||` exactly one, `|o` zero or one, `o{` zero or many.',
            '',
            '```mermaid',
            rtrim($mermaid),
            '```',
            '',
            '## Relationships',
            '',
        ];

        if ($relationships) {
            $out[] = '| Child table | Column | References | Required |';
            $out[] = '|---|---|---|---|';

            foreach ($relationships as $rel) {
                $out[] = sprintf(
                    '| `%s` | `%s` | `%s.%s` | %s |',
                    $rel['child'],
                    implode(', ', $rel['columns']),
                    $rel['parent'],
                    implode(', ', $rel['parentColumns']),
                    $rel['nullable'] ? 'No' : 'Yes',
                );
            }
        } else {
            $out[] = '_No foreign keys between the included tables._';
        }

        $out[] = '';
        $out[] = '## Tables';

        foreach ($schema as $table => $info) {
            [$primary, $unique, $foreign] = $this->keyColumns($info);

            $out[] = '';
            $out[] = "### `{$table}`";
            $out[] = '';
            $out[] = '| Column | Type | Nullable | Default | Key |';
            $out[] = '|---|---|---|---|---|';

            foreach ($info['columns'] as $column) {
                $keys = array_filter([
                    in_array($column['name'], $primary, true) ? 'PK' : null,
                    in_array($column['name'], $foreign, true) ? 'FK' : null,
                    in_array($column['name'], $unique, true) ? 'Unique' : null,
                ]);

                $out[] = sprintf(
                    '| `%s` | %s | %s | %s | %s |',
                    $column['name'],
                    $this->cell($column['type'].($column['auto_increment'] ? ' auto_increment' : '')),
                    $column['nullable'] ? 'Yes' : 'No',
                    $column['default'] === null ? '—' : '`'.$this->cell((string) $column['default']).'`',
                    $keys ? implode(', ', $keys) : '',
                );
            }
        }

        return implode("\n", $out)."\n";
    }

    /** The viewer served at /docs/erd: pan, zoom, table search and details, SVG/PNG download. */
    private function html(Collection $schema, array $relationships, string $mermaid): string
    {
        $tables = $schema->map(function (array $info) {
            [$primary, $unique, $foreign] = $this->keyColumns($info);

            return ['columns' => array_map(fn (array $column) => [
                'name' => $column['name'],
                'type' => $column['type'],
                'nullable' => $column['nullable'],
                'keys' => array_values(array_filter([
                    in_array($column['name'], $primary, true) ? 'PK' : null,
                    in_array($column['name'], $foreign, true) ? 'FK' : null,
                    in_array($column['name'], $unique, true) ? 'UK' : null,
                ])),
            ], $info['columns'])];
        });

        return view('erd.viewer', [
            'database' => $this->databaseName(),
            'generatedAt' => $this->generatedAt(),
            // Relative, so the viewer loads Mermaid from whatever host it is opened on.
            'mermaidUrl' => route('docs.erd.mermaid', absolute: false),
            'mermaid' => $mermaid,
            'tables' => $tables->all(),
            'relationships' => $relationships,
        ])->render();
    }

    private function databaseName(): string
    {
        return (string) config('database.connections.'.config('database.default').'.database');
    }

    private function generatedAt(): string
    {
        return now()->format('M j, Y g:i A T');
    }

    /** @return array{0: array, 1: array, 2: array} primary, single-column unique, and foreign key columns */
    private function keyColumns(array $info): array
    {
        $indexes = collect($info['indexes']);

        return [
            $indexes->where('primary', true)->pluck('columns')->flatten()->all(),
            $indexes->where('unique', true)->where('primary', false)
                ->filter(fn ($index) => count($index['columns']) === 1)
                ->pluck('columns')->flatten()->all(),
            collect($info['foreignKeys'])->pluck('columns')->flatten()->all(),
        ];
    }

    /** Mermaid entity names allow letters, digits, underscores and hyphens. */
    private function entity(string $name): string
    {
        return preg_replace('/[^A-Za-z0-9_-]/', '_', $name);
    }

    /** Attribute types and names must be a single word in Mermaid. */
    private function word(string $value): string
    {
        return preg_replace('/[^A-Za-z0-9_-]/', '_', $value) ?: 'unknown';
    }

    private function cell(string $value): string
    {
        return str_replace(['|', "\n"], ['\|', ' '], $value);
    }

    private function relative(string $path): string
    {
        return ltrim(str_replace(base_path(), '', $path), '/\\');
    }
}

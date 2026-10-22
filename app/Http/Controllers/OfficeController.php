<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\Departments;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * The Requesting Offices screen: the offices every form offers.
 *
 * Requests, records and releases store an office's name, not its id, so a
 * rename here is carried onto every row that used the old name — otherwise
 * the monitoring filter, the dashboard chart and the SSMI office code would
 * stop recognising them. An office that has been used is retired, not deleted.
 */
class OfficeController extends Controller
{
    use LogsAudit;

    public function index()
    {
        $usage = $this->usage();

        return Inertia::render('Offices/Index', [
            'offices' => Departments::orderBy('Department_Name')->get()->map(fn (Departments $office) => [
                'id' => $office->id,
                'name' => $office->Department_Name,
                'code' => $office->Department_Code,
                'description' => $office->Department_Desc,
                'is_active' => $office->is_active,
                'requests' => $usage['purchase_requests'][$office->Department_Name] ?? 0,
                'records' => $usage['records'][$office->Department_Name] ?? 0,
                'releases' => $usage['purchase_order'][$office->Department_Name] ?? 0,
            ]),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $office = Departments::create($this->validated($request) + ['is_active' => true]);

        $this->audit('Office added', $office, "Added the requesting office {$office->Department_Name} ({$office->Department_Code}).", null, $this->snapshot($office));

        return back()->with('success', "{$office->Department_Name} added.");
    }

    public function update(Request $request, Departments $office): RedirectResponse
    {
        $data = $this->validated($request, $office);
        $before = $this->snapshot($office);
        $oldName = $office->Department_Name;
        $renamed = $data['Department_Name'] !== $oldName;
        $carried = 0;

        DB::transaction(function () use ($office, $data, $renamed, $oldName, &$carried) {
            $office->update($data);

            if ($renamed) {
                foreach (Departments::USED_IN as [$table, $column]) {
                    $carried += DB::table($table)->where($column, $oldName)->update([$column => $data['Department_Name']]);
                }
            }
        });

        $this->audit(
            'Office updated',
            $office,
            "Updated the requesting office {$office->Department_Name}"
                .($renamed ? " (renamed from {$oldName}; {$carried} existing ".($carried === 1 ? 'entry' : 'entries').' updated)' : '').'.',
            $before,
            $this->snapshot($office),
        );

        return back()->with('success', $renamed && $carried
            ? "{$office->Department_Name} saved. {$carried} existing ".($carried === 1 ? 'entry now uses' : 'entries now use').' the new name.'
            : "{$office->Department_Name} saved.");
    }

    public function destroy(Departments $office): RedirectResponse
    {
        if ($this->timesUsed($office->Department_Name) > 0) {
            return back()->with('error', "{$office->Department_Name} is used by existing requests or records. Retire it instead so they keep it.");
        }

        $before = $this->snapshot($office);
        $name = $office->Department_Name;
        $office->delete();

        $this->audit('Office deleted', $office, "Deleted the requesting office {$name}.", $before);

        return back()->with('success', "{$name} deleted.");
    }

    public function deactivate(Departments $office): RedirectResponse
    {
        $office->update(['is_active' => false]);
        $this->audit('Office retired', $office, "Retired the requesting office {$office->Department_Name}.", ['is_active' => true], ['is_active' => false]);

        return back()->with('success', "{$office->Department_Name} is no longer offered. Existing requests and records keep it.");
    }

    public function reactivate(Departments $office): RedirectResponse
    {
        $office->update(['is_active' => true]);
        $this->audit('Office restored', $office, "Restored the requesting office {$office->Department_Name}.", ['is_active' => false], ['is_active' => true]);

        return back()->with('success', "{$office->Department_Name} is offered again.");
    }

    private function validated(Request $request, ?Departments $office = null): array
    {
        $request->merge([
            'name' => trim((string) $request->input('name')),
            'code' => strtoupper(trim((string) $request->input('code'))),
        ]);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('departments', 'Department_Name')->ignore($office)],
            'code' => ['required', 'string', 'max:20', 'regex:/^[A-Z0-9][A-Z0-9\-]*$/', Rule::unique('departments', 'Department_Code')->ignore($office)],
            'description' => ['nullable', 'string', 'max:255'],
        ], [
            'name.unique' => 'There is already an office with this name.',
            'code.unique' => 'Another office already uses this code.',
            'code.regex' => 'Use capital letters, numbers and hyphens only, e.g. CAGRO.',
        ]);

        return [
            'Department_Name' => $data['name'],
            'Department_Code' => $data['code'],
            'Department_Desc' => $data['description'] ?? null,
        ];
    }

    /** How often each office name appears, per table: [table => [name => count]]. */
    private function usage(): array
    {
        $usage = [];
        foreach (Departments::USED_IN as [$table, $column]) {
            $usage[$table] = DB::table($table)
                ->whereNotNull($column)
                ->groupBy($column)
                ->selectRaw("{$column} as name, COUNT(*) as total")
                ->pluck('total', 'name')
                ->all();
        }

        return $usage;
    }

    private function timesUsed(string $name): int
    {
        return collect(Departments::USED_IN)->sum(fn ($use) => DB::table($use[0])->where($use[1], $name)->count());
    }

    private function snapshot(Departments $office): array
    {
        return $office->only(['Department_Name', 'Department_Code', 'Department_Desc', 'is_active']);
    }
}

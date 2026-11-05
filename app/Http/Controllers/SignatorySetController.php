<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\Departments;
use App\Models\SignatorySet;
use App\Services\Signatories;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The Signatories screen: each document's named signer sets, how many people
 * sign in each, and which requesting offices use which set.
 */
class SignatorySetController extends Controller
{
    use LogsAudit;

    public function index(): Response
    {
        $sets = SignatorySet::with('departments:id')->orderByDesc('is_default')->orderBy('name')->get();

        return Inertia::render('DocumentSettings/Signatories', [
            'documents' => collect(Signatories::documents())->map(fn ($definition) => [
                'label' => $definition['label'],
                'note' => $definition['note'] ?? null,
                'fixed' => collect($definition['fixed'] ?? [])->map(fn ($slot) => $slot[0])->all(),
            ])->all(),
            'sets' => $sets->groupBy('document')->map(fn ($group) => $group->map(fn (SignatorySet $set) => $this->present($set))->values())->all(),
            // Active offices, plus any retired one still linked so it can be unlinked.
            'offices' => Departments::query()
                ->where('is_active', true)
                ->orWhereIn('id', DB::table('department_signatory_set')->select('department_id'))
                ->orderBy('Department_Name')
                ->get(['id', 'Department_Name', 'Department_Code', 'is_active'])
                ->map(fn ($office) => ['id' => $office->id, 'name' => $office->Department_Name, 'code' => $office->Department_Code, 'active' => $office->is_active]),
            'maxSigners' => config('documents.max_signers'),
        ]);
    }

    /** A new set, starting as a copy of the document's current default. */
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'document' => ['required', Rule::in(array_keys(Signatories::documents()))],
            'name' => ['required', 'string', 'max:80', Rule::unique('signatory_sets')->where('document', $request->input('document'))],
        ], [], ['name' => 'set name']);

        $template = Signatories::automatic($validated['document'], null);
        $isFirst = ! SignatorySet::forDocument($validated['document'])->exists();

        $set = SignatorySet::create([
            'document' => $validated['document'],
            'name' => trim($validated['name']),
            'is_default' => $isFirst,
            'signers' => $template->signers,
            'fixed' => $template->fixed,
        ]);

        $label = Signatories::documents()[$set->document]['label'];
        $this->audit('signatory_set_created', $set, "Added signer set \"{$set->name}\" for {$label}", null, $this->present($set));

        return back()->with('success', "Signer set \"{$set->name}\" added. It starts as a copy of the default; change it below.");
    }

    public function update(Request $request, SignatorySet $signatorySet): RedirectResponse
    {
        $document = $signatorySet->document;
        $fixedSlots = array_keys(Signatories::documents()[$document]['fixed'] ?? []);

        $rules = [
            'name' => ['required', 'string', 'max:80', Rule::unique('signatory_sets')->where('document', $document)->ignore($signatorySet->id)],
            'is_default' => ['boolean'],
            'signers' => ['required', 'array', 'min:1', 'max:'.config('documents.max_signers')],
            'signers.*.label' => ['nullable', 'string', 'max:80'],
            'signers.*.name' => ['nullable', 'string', 'max:120'],
            'signers.*.position' => ['nullable', 'string', 'max:120'],
            'office_ids' => ['array'],
            'office_ids.*' => ['integer', 'distinct', 'exists:departments,id'],
        ];
        foreach ($fixedSlots as $slot) {
            $rules["fixed.{$slot}.name"] = ['nullable', 'string', 'max:120'];
            $rules["fixed.{$slot}.position"] = ['nullable', 'string', 'max:120'];
        }

        $validated = $request->validate($rules, [
            'signers.required' => 'A set needs at least one signer.',
            'signers.min' => 'A set needs at least one signer.',
            'signers.max' => 'A set can have at most :max signers.',
        ], [
            'name' => 'set name',
            'signers.*.label' => 'label',
            'signers.*.name' => 'name',
            'signers.*.position' => 'position',
        ]);

        $officeIds = collect($validated['office_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();

        // An office's requests can follow only one set per document.
        $taken = DB::table('department_signatory_set')
            ->join('signatory_sets', 'signatory_sets.id', '=', 'department_signatory_set.signatory_set_id')
            ->join('departments', 'departments.id', '=', 'department_signatory_set.department_id')
            ->where('signatory_sets.document', $document)
            ->where('signatory_sets.id', '!=', $signatorySet->id)
            ->whereIn('department_signatory_set.department_id', $officeIds)
            ->get(['departments.Department_Name as office', 'signatory_sets.name as set']);

        if ($taken->isNotEmpty()) {
            throw ValidationException::withMessages([
                'office_ids' => $taken->map(fn ($row) => "{$row->office} already uses \"{$row->set}\"")->join('; ').'. Remove it there first.',
            ]);
        }

        $clean = fn ($value) => trim((string) $value);
        $before = $this->present($signatorySet->load('departments:id'));

        DB::transaction(function () use ($signatorySet, $validated, $fixedSlots, $officeIds, $clean, $document) {
            $makeDefault = (bool) ($validated['is_default'] ?? false);

            if ($makeDefault) {
                SignatorySet::forDocument($document)->whereKeyNot($signatorySet->id)->update(['is_default' => false]);
            }

            $signatorySet->update([
                'name' => $clean($validated['name']),
                // The default stays the default until another set takes over.
                'is_default' => $signatorySet->is_default || $makeDefault,
                'signers' => collect($validated['signers'])->map(fn ($signer) => [
                    'label' => $clean($signer['label'] ?? ''),
                    'name' => $clean($signer['name'] ?? ''),
                    'position' => $clean($signer['position'] ?? ''),
                ])->values()->all(),
                'fixed' => $fixedSlots ? collect($fixedSlots)->mapWithKeys(fn ($slot) => [$slot => [
                    'name' => $clean(data_get($validated, "fixed.{$slot}.name")),
                    'position' => $clean(data_get($validated, "fixed.{$slot}.position")),
                ]])->all() : null,
            ]);

            $signatorySet->departments()->sync($officeIds->all());
        });

        $after = $this->present($signatorySet->fresh('departments:id'));
        $changed = collect($after)->filter(fn ($value, $key) => $value != ($before[$key] ?? null))->keys();

        if ($changed->isEmpty()) {
            return back()->with('success', 'No changes to save.');
        }

        $label = Signatories::documents()[$document]['label'];
        $this->audit(
            'signatory_set_updated',
            $signatorySet,
            "Updated signer set \"{$signatorySet->name}\" for {$label}: ".$changed->map(fn ($key) => str_replace('_', ' ', $key))->join(', '),
            collect($before)->only($changed)->all(),
            collect($after)->only($changed)->all(),
        );

        return back()->with('success', "Signer set \"{$signatorySet->name}\" saved. PDFs printed from now on use it.");
    }

    public function destroy(SignatorySet $signatorySet): RedirectResponse
    {
        if ($signatorySet->is_default) {
            return back()->with('error', 'The default set cannot be removed. Make another set the default first.');
        }

        $before = $this->present($signatorySet->load('departments:id'));
        $signatorySet->delete();   // Requests that chose it fall back to automatic (Signatories::for).

        $label = Signatories::documents()[$signatorySet->document]['label'];
        $this->audit('signatory_set_deleted', $signatorySet, "Removed signer set \"{$signatorySet->name}\" for {$label}", $before, null);

        return back()->with('success', "Signer set \"{$signatorySet->name}\" removed. Requests that used it now print with their office's set or the default.");
    }

    /** What the screen edits and the audit trail compares. */
    private function present(SignatorySet $set): array
    {
        return [
            'id' => $set->id,
            'name' => $set->name,
            'is_default' => $set->is_default,
            'signers' => $set->signers,
            'fixed' => $set->fixed,
            'office_ids' => $set->relationLoaded('departments') ? $set->departments->pluck('id')->sort()->values()->all() : [],
        ];
    }
}

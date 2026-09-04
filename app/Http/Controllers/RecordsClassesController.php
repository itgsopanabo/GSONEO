<?php

namespace App\Http\Controllers;

use App\Http\Requests\RecordClassRequest;
use App\Models\RecordsClasses;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class RecordsClassesController extends Controller
{
    public function index()
    {
        return Inertia::render('RecordClasses/Index', [
            'classes' => RecordsClasses::withCount('records')
                ->orderBy('code')
                ->get(),
            'pending' => RecordsClasses::where('rds_item_no', 'TODO')->count(),

            // the modal form needs these, since there is no create/edit page
            'sensitivities' => RecordsClasses::SENSITIVITIES,
            'triggers'      => RecordsClasses::TRIGGERS,
        ]);
    }

    public function store(RecordClassRequest $request)
    {
        $class = RecordsClasses::create($request->validated());

        return back()->with('success', "Record class {$class->code} added.");
    }

    public function show(RecordsClasses $recordClass)
    {
        return Inertia::render('RecordClasses/Show', [
            'class'   => $recordClass->loadCount('records'),
            'samples' => $recordClass->records()
                ->latest('record_date')
                ->limit(10)
                ->get(['id', 'title', 'reference_no', 'record_date', 'eligible_for_disposal_on']),
        ]);
    }

    public function update(RecordClassRequest $request, RecordsClasses $recordClass)
    {
        $data = $request->validated();

        // Retention is derived, so a change here invalidates every stored
        // disposal date in the class. Detect before the update overwrites it.
        $retentionChanged =
            (string) $recordClass->retention_years !== (string) ($data['retention_years'] ?? '')
            || $recordClass->is_permanent !== (bool) ($data['is_permanent'] ?? false)
            || $recordClass->retention_trigger !== ($data['retention_trigger'] ?? null);

        $recalculated = 0;

        DB::transaction(function () use ($recordClass, $data, $retentionChanged, &$recalculated) {
            $recordClass->update($data);

            if ($retentionChanged) {
                $recordClass->records()->chunkById(200, function ($records) use (&$recalculated) {
                    foreach ($records as $record) {
                        $record->save();   // saving hook recomputes eligible_for_disposal_on
                        $recalculated++;
                    }
                });
            }
        });

        $message = "Record class {$recordClass->code} updated.";
        if ($recalculated) {
            $message .= " Disposal dates recalculated for {$recalculated} "
                . ($recalculated === 1 ? 'record.' : 'records.');
        }

        return back()->with('success', $message);
    }

    public function destroy(RecordsClasses $recordClass)
    {
        if ($recordClass->records()->exists()) {
            return back()->with('error',
                'This class is in use. Retire it instead so existing records keep their classification.');
        }

        $code = $recordClass->code;
        $recordClass->delete();

        return back()->with('success', "Record class {$code} deleted.");
    }

    public function deactivate(RecordsClasses $recordClass)
    {
        $recordClass->update(['is_active' => false]);

        return back()->with('success', "{$recordClass->code} is no longer offered for new records.");
    }

    public function reactivate(RecordsClasses $recordClass)
    {
        $recordClass->update(['is_active' => true]);

        return back()->with('success', "{$recordClass->code} is available again.");
    }
}

<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRecordRequest;
use App\Models\Records;
use App\Models\RecordsClasses;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RecordsController extends Controller
{
    public function index(Request $request)
    {
        $view = $request->query('view', 'active');

        $records = Records::query()
            ->with('recordClass:id,code,title,sensitivity,is_permanent,retention_years,retention_trigger,rds_source,rds_item_no,is_vital')
            ->visibleTo($request->user())
            ->search($request->query('q'))
            ->when($view === 'active',   fn ($q) => $q->active())
            ->when($view === 'archived', fn ($q) => $q->archived())
            ->when($request->query('class'), fn ($q, $id) => $q->where('record_class_id', $id))
            ->latest('record_date')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Records/Index', [
            'records'  => $records,
            'classes'  => RecordsClasses::where('is_active', true)->orderBy('code')->get(),
            'statuses' => Records::STATUSES,
            'filters'  => $request->only('q', 'view', 'class'),
            'counts'   => [
                'active'   => Records::visibleTo($request->user())->active()->count(),
                'archived' => Records::visibleTo($request->user())->archived()->count(),
            ],
        ]);
    }

    public function create(Request $request)
    {
        return Inertia::render('Records/Create', [
            'classes'  => RecordsClasses::where('is_active', true)->orderBy('code')->get(),
            'statuses' => Records::STATUSES,
        ]);
    }

    public function store(StoreRecordRequest $request)
    {
        $record = Records::create($request->validated());

        return redirect()
            ->route('records.show', $record)
            ->with('success', 'Record registered.');
    }

    public function show(Request $request, Records $record)
    {


        return Inertia::render('Records/Show', [
            'record' => $record->load('recordClass', 'archivedBy:emp_id,name'),
        ]);
    }

    public function edit(Request $request, Records $record)
    {

        return Inertia::render('Records/Edit', [
            'record'   => $record->load('recordClass'),
            'classes'  => RecordsClasses::where('is_active', true)->orderBy('code')->get(),
            'statuses' => Records::STATUSES,
        ]);
    }

    public function update(UpdateRecordRequest $request, Records $record)
    {
        $this->authorize('update', $record);

        if ($record->is_archived) {
            return back()->with('error', 'Unarchive this record before editing it.');
        }

        $record->update($request->validated());

        return redirect()
            ->route('records.show', $record)
            ->with('success', 'Record updated.');
    }

    public function archive(Request $request, Records $record)
    {
        $this->authorize('update', $record);

        $record->forceFill([
            'archived_at' => now(),
            'archived_by' => $request->user()->emp_id,
        ])->save();

        return back()->with('success', 'Record archived.');
    }

    public function unarchive(Request $request, Records $record)
    {
        $this->authorize('update', $record);

        $record->forceFill([
            'archived_at' => null,
            'archived_by' => null,
        ])->save();

        return back()->with('success', 'Record restored to active.');
    }
}

<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Http\Requests\itemRequest;
use App\Models\items;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Throwable;

class ItemsController extends Controller
{
    use LogsAudit;

    /**
     * ==========================================================
     *  TEMPLATE SETTINGS
     *  Validation now lives in App\Http\Requests\ItemRequest.
     * ==========================================================
     */

    /** Columns searched by index(). */
    protected array $searchable = [
        'item_desc',
        'item_unit',
    ];

    /** Column shown in flash messages and audit descriptions. */
    protected string $labelColumn = 'item_desc';

    /**
     * ==========================================================
     *  Everything below is column-agnostic — no edits needed
     * ==========================================================
     */

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $search = $request->string('search')->trim()->value();

        $items = items::query()
            ->when($search && $this->searchable, function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    foreach ($this->searchable as $column) {
                        $q->orWhere($column, 'like', "%{$search}%");
                    }
                });
            })
            ->latest()
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Item/index', [
            'items'   => $items,
            'filters' => ['search' => $search],
        ]);
    }


    /**
     * Store a newly created resource in storage.
     */
    public function store(itemRequest $request)
    {
        //  already validated by ItemRequest before we got here
        $data = $request->validated();

        try {
            //  insert the item + log to audit log (all-or-nothing)
            $item = DB::transaction(function () use ($data) {
                $item = items::create($data);

                $this->audit(
                    'Created',
                    $item,
                    "Created item {$this->label($item)}",
                    null,
                    $item->getAttributes(),
                );

                return $item;
            });
        } catch (Throwable $e) {
            return $this->failed($e, 'The item could not be saved.');
        }

        //  return to index
        return redirect()
            ->route('items.index')
            ->with('status', "Item {$this->label($item)} was created.");
    }


    /**
     * Update the specified resource in storage.
     */
    public function update(itemRequest $request, items $item)
    {
        //  already validated by ItemRequest before we got here
        $data = $request->validated();

        try {
            DB::transaction(function () use ($item, $data) {
                $item->fill($data);

                //  only touch the DB if something actually changed
                $changes = $item->getDirty();

                if (empty($changes)) {
                    return;
                }

                $before = array_intersect_key($item->getOriginal(), $changes);

                $item->save();

                //  log to audit log
                $this->audit(
                    'Updated',
                    $item,
                    "Updated " . implode(', ', array_keys($changes)) . " on item {$this->label($item)}",
                    $before,
                    $changes,
                );
            });
        } catch (Throwable $e) {
            return $this->failed($e, 'The item could not be updated.');
        }

        //  return to index
        return redirect()
            ->route('items.index')
            ->with('status', "Item {$this->label($item)} was updated.");
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(items $item)
    {
        $label = $this->label($item);

        try {
            DB::transaction(function () use ($item) {
                $snapshot = $item->getAttributes();

                $item->delete();

                $this->audit(
                    'Deleted',
                    $item,
                    "Deleted item {$this->label($item)}",
                    $snapshot,
                    null,
                );
            });
        } catch (QueryException $e) {
            //  1451 / 23000 = row is still referenced by a foreign key
            if (in_array($e->getCode(), ['23000', '23503'], true)) {
                return back()->with('error', "\"{$label}\" is still used by other records and cannot be deleted.");
            }

            return $this->failed($e, 'The item could not be deleted.');
        } catch (Throwable $e) {
            return $this->failed($e, 'The item could not be deleted.');
        }

        return redirect()
            ->route('items.index')
            ->with('status', "Item {$label} was deleted.");
    }

    /**
     * Human-readable label for flash messages.
     */
    protected function label(items $item): string
    {
        return $item->{$this->labelColumn} ?? "#{$item->getKey()}";
    }

    /**
     * Log the real exception, show the user something readable.
     *
     * The transaction has already rolled back by the time we land here,
     * so no partial write and no orphan audit row.
     */
    protected function failed(Throwable $e, string $message)
    {
        Log::error($message, [
            'exception' => $e,
            'user_id'   => auth()->id(),
            'url'       => request()->fullUrl(),
        ]);

        if (request()->expectsJson()) {
            return response()->json(['message' => $message], 500);
        }

        return back()
            ->withInput()
            ->with('error', $message);
    }

    /**
     * Create many items at once from a pasted list.
     */
    public function bulkStore(Request $request)
    {
        $payload = $request->validate([
            'rows'              => ['required', 'array', 'min:1', 'max:1000'],
            'rows.*.item_desc'  => ['required', 'string', 'max:1000'],
            'rows.*.item_unit'  => ['nullable', 'string', 'max:2000'],
            'rows.*.item_price' => ['required', 'numeric', 'min:0'],
        ], [
            'rows.required' => 'There was nothing to import.',
            'rows.max'      => 'Import up to 1000 rows at a time.',
        ]);

        $rows = collect($payload['rows'])
            ->map(fn (array $row) => [
                'item_desc'  => trim($row['item_desc']),
                'item_unit'  => filled($row['item_unit'] ?? null) ? trim($row['item_unit']) : null,
                'item_price' => $row['item_price'],
            ])
            ->unique(fn (array $row) => mb_strtolower($row['item_desc']))
            ->values();

        // Already on file gets skipped, not rejected — the unique index on
        // item_desc would otherwise abort the whole transaction.
        $onFile = items::query()
            ->whereIn('item_desc', $rows->pluck('item_desc'))
            ->pluck('item_desc')
            ->map(fn ($desc) => mb_strtolower($desc))
            ->all();

        $fresh = $rows->reject(
            fn (array $row) => in_array(mb_strtolower($row['item_desc']), $onFile, true)
        );

        if ($fresh->isEmpty()) {
            return back()->with('error', 'Nothing imported — every item was already on file.');
        }

        $created = DB::transaction(function () use ($fresh) {
            foreach ($fresh as $row) {
                $item = items::create($row);
                $this->audit('created', $item, null, $item->getAttributes());
            }

            return $fresh->count();
        });

        $skipped = $rows->count() - $created;

        $message = "Imported {$created} item" . ($created === 1 ? '' : 's') . '.';
        if ($skipped > 0) {
            $message .= " Skipped {$skipped} already on file.";
        }

        return back()->with('status', $message);
    }
}

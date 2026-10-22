<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\TrackerTag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * The Tracker Tags screen: the list of things an order can be missing.
 *
 * Mirrors Record Classes. A tag that has never been used can be deleted; one
 * that has is retired instead, so the orders that carried it keep their history.
 */
class TrackerTagController extends Controller
{
    use LogsAudit;

    public function index()
    {
        return Inertia::render('TrackerTags/Index', [
            'tags' => TrackerTag::query()
                ->withCount(['uses', 'uses as open_count' => fn ($q) => $q->open()])
                // When it was last put on an order, so stale tags can be spotted.
                ->withMax('uses as last_used_at', 'created_at')
                ->orderBy('name')
                ->get(),
            'colors' => TrackerTag::COLORS,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $tag = TrackerTag::create($this->validated($request));

        $this->audit('Tracker tag added', $tag, "Added the tracker tag \"{$tag->name}\".", null, $tag->only(['name', 'description', 'color', 'holds_order']));

        return back()->with('success', "Tag \"{$tag->name}\" added.");
    }

    public function update(Request $request, TrackerTag $trackerTag): RedirectResponse
    {
        $before = $trackerTag->only(['name', 'description', 'color', 'holds_order']);

        $trackerTag->update($this->validated($request, $trackerTag));

        $this->audit('Tracker tag updated', $trackerTag, "Updated the tracker tag \"{$trackerTag->name}\".", $before, $trackerTag->only(['name', 'description', 'color', 'holds_order']));

        return back()->with('success', "Tag \"{$trackerTag->name}\" updated.");
    }

    public function destroy(TrackerTag $trackerTag): RedirectResponse
    {
        if ($trackerTag->uses()->exists()) {
            return back()->with('error', "\"{$trackerTag->name}\" has been used on orders. Retire it instead so their history keeps it.");
        }

        $name = $trackerTag->name;
        $before = $trackerTag->only(['name', 'description', 'color', 'holds_order']);
        $trackerTag->delete();

        $this->audit('Tracker tag deleted', $trackerTag, "Deleted the tracker tag \"{$name}\".", $before);

        return back()->with('success', "Tag \"{$name}\" deleted.");
    }

    public function deactivate(TrackerTag $trackerTag): RedirectResponse
    {
        $trackerTag->update(['is_active' => false]);

        $this->audit('Tracker tag retired', $trackerTag, "Retired the tracker tag \"{$trackerTag->name}\".", ['is_active' => true], ['is_active' => false]);

        return back()->with('success', "\"{$trackerTag->name}\" is no longer offered. Orders that have it keep it.");
    }

    public function reactivate(TrackerTag $trackerTag): RedirectResponse
    {
        $trackerTag->update(['is_active' => true]);

        $this->audit('Tracker tag restored', $trackerTag, "Restored the tracker tag \"{$trackerTag->name}\".", ['is_active' => false], ['is_active' => true]);

        return back()->with('success', "\"{$trackerTag->name}\" is offered again.");
    }

    private function validated(Request $request, ?TrackerTag $tag = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('tracker_tags', 'name')->ignore($tag)],
            'description' => ['nullable', 'string', 'max:255'],
            'color' => ['required', Rule::in(TrackerTag::COLORS)],
            'holds_order' => ['required', 'boolean'],
        ], [
            'name.unique' => 'There is already a tag with this name.',
        ]);
    }
}

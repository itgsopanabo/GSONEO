<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Departments;
use App\Models\PurchaseRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class EncodingController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        // Encoders only. Better as route middleware or a policy, but inline works.
        abort_unless($request->user()?->role_id === 7, 403);

        $purchaseRequests = PurchaseRequest::query()
            ->with('items')
            ->where('status', 0)
            ->orderBy('created_at')
            ->paginate(15);

        return Inertia::render('Procurement/Encoding/Index', [
            'purchaseRequests' => $purchaseRequests,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $departments = Departments::select('Department_Code', 'Department_Name')
            ->orderBy('Department_Code', 'asc')->get();

        return Inertia::render('Procurement/Encoding/Create', [
            'departments' => $departments
        ]);
    }

    /**
     * Store a newly created resource in storage.
     * @throws \Throwable
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'requester_name' => 'required|string|max:255',
            'requester_department' => 'required|string|max:255',
            'needed_by_date' => 'nullable|date|after_or_equal:today',
            'remarks_or_notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.item_name' => 'required|string|max:255',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit' => 'required|string|max:50',
            'items.*.estimated_unit_price' => 'required|numeric|min:0',
        ]);

        $purchaseRequest = DB::transaction(function () use ($validated) {
            $prNumber = 'EPR-' . date('Y') . '-' . str_pad(PurchaseRequest::count() + 1, 4, '0', STR_PAD_LEFT);

            $purchaseRequest = PurchaseRequest::create([
                'pr_number' => $prNumber,
                'requester_name' => $validated['requester_name'],
                'requester_department' => $validated['requester_department'],
                'remarks_or_notes' => $validated['remarks_or_notes'],
                'status' => 1,
                'verify_by_emp_id' => null,
            ]);

            $itemsData = array_map(function ($item) use ($prNumber) {
                return [
                    'purchase_request_id' => $prNumber,
                    'item_name' => $item['item_name'],
                    'item_desc' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit' => $item['unit'],
                    'estimated_unit_cost' => $item['estimated_unit_price'],
                    'total_estimated_cost' => $item['quantity'] * $item['estimated_unit_price'],
                ];
            }, $validated['items']);

            $purchaseRequest->items()->createMany($itemsData);

            return $purchaseRequest;
        });

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $purchaseRequest->pr_number,
            'description' => "Created Purchase Request {$purchaseRequest->pr_number} for {$purchaseRequest->requester_name}",
            'old_values' => null,
            'new_values' => $purchaseRequest->load('items')->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $request->replace([]);

        return redirect()->route('encode.create')
            ->with('success', 'Purchase Request created successfully.');
    }

    /**
     * @throws \Throwable
     */
    public function draft(Request $request)
    {
        $validated = $request->validate([
            'requester_name' => 'required|string|max:255',
            'requester_department' => 'required|string|max:255',
            'needed_by_date' => 'nullable|date|after_or_equal:today',
            'remarks_or_notes' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.item_name' => 'required|string|max:255',
            'items.*.description' => 'required|string',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit' => 'required|string|max:50',
            'items.*.estimated_unit_price' => 'required|numeric|min:0',
        ]);

        $purchaseRequest = DB::transaction(function () use ($validated) {
            $prNumber = 'EPR-' . date('Y') . '-' . str_pad(PurchaseRequest::count() + 1, 4, '0', STR_PAD_LEFT);

            $purchaseRequest = PurchaseRequest::create([
                'pr_number' => $prNumber,
                'requester_name' => $validated['requester_name'],
                'requester_department' => $validated['requester_department'],
                'remarks_or_notes' => $validated['remarks_or_notes'],
                'status' => 0,
                'verify_by_emp_id' => null,
            ]);

            $itemsData = array_map(function ($item) use ($prNumber) {
                return [
                    'purchase_request_id' => $prNumber,
                    'item_name' => $item['item_name'],
                    'item_desc' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit' => $item['unit'],
                    'estimated_unit_cost' => $item['estimated_unit_price'],
                    'total_estimated_cost' => $item['quantity'] * $item['estimated_unit_price'],
                ];
            }, $validated['items']);

            $purchaseRequest->items()->createMany($itemsData);

            return $purchaseRequest;
        });

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $purchaseRequest->pr_number,
            'description' => "Created Purchase Request {$purchaseRequest->pr_number} for {$purchaseRequest->requester_name}",
            'old_values' => null,
            'new_values' => $purchaseRequest->load('items')->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return redirect()->route('encode.index')
            ->with('success', 'Purchase Request created successfully.');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(PurchaseRequest $purchaseRequest)
    {
        $purchaseRequest->load('items');

        // Only a request still in the encoding stage can be reopened. Once it has
        // moved on, the encoder's edits would silently contradict later steps.
        abort_unless(
            in_array($purchaseRequest->status, [0, 0], true),
            403,
            'That request can no longer be edited here.'
        );

        return Inertia::render('Procurement/Encoding/Edit', [
            'purchaseRequest' => $purchaseRequest,
            'departments'     => Departments::orderBy('Department_Name')->get(),
            'isDraft' => $purchaseRequest->status === 0,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */

    public function update(Request $request, PurchaseRequest $purchaseRequest)
    {
        // NOTE: [0, 0] is a typo — list the real editable statuses here.
        abort_unless(
            (int)$purchaseRequest->status === 0,
            403,
            'That request can no longer be edited here.'
        );

        $isDraft = $request->input('status') === 'draft';
        $ifFinal = $isDraft ? 'nullable' : 'required';

        $ownedItem = Rule::exists('purchase_request_items', 'id')
            ->where('purchase_request_id', $purchaseRequest->id);

        $validated = $request->validate([
            'status' => ['required', 'in:draft,submitted'],
            'requester_name' => [$ifFinal, 'string', 'max:255'],
            'requester_department' => [$ifFinal, 'string', 'max:100'],
            'remarks_or_notes' => ['nullable', 'string'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['nullable', 'integer', $ownedItem],
            'items.*.item_name' => [$ifFinal, 'string', 'max:255'],
            'items.*.description' => ['nullable', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:20'],
            'items.*.estimated_unit_price' => [$ifFinal, 'numeric', 'min:0'],

            'removed_item_ids' => ['array'],
            'removed_item_ids.*' => ['integer', $ownedItem],
        ]);

        DB::transaction(function () use ($purchaseRequest, $validated, $isDraft) {
            if (!empty($validated['removed_item_ids'])) {
                $purchaseRequest->items()
                    ->whereIn('id', $validated['removed_item_ids'])
                    ->delete();
            }

            $existing = $purchaseRequest->items()->get()->keyBy('id');

            foreach ($validated['items'] as $row) {
                $qty = (int)$row['quantity'];
                $price = $row['estimated_unit_price'] ?? null;

                $attributes = [
                    'item_name' => $row['item_name'] ?? '',
                    'item_desc' => $row['description'] ?? null,
                    'quantity' => $qty,
                    'unit' => $row['unit'] ?? 'pcs',
                    'estimated_unit_cost' => $price,
                    'total_estimated_cost' => $price === null ? null : $qty * (float)$price,
                ];

                $item = !empty($row['id']) ? $existing->get($row['id']) : null;

                $item
                    ? $item->update($attributes)
                    : $purchaseRequest->items()->create($attributes);
            }

            $purchaseRequest->update([
                'requester_name' => $validated['requester_name'] ?? $purchaseRequest->requester_name,
                'requester_department' => $validated['requester_department'] ?? $purchaseRequest->requester_department,
                'remarks_or_notes' => $validated['remarks_or_notes'] ?? null,
                'status' => $isDraft ? 0 : 1,
                'encoded_by' => auth()->id(),
                'encoded_at' => $isDraft ? null : now(),
            ]);
        });

        $message = $isDraft
            ? "{$purchaseRequest->pr_number} saved as draft."
            : "{$purchaseRequest->pr_number} encoded.";

        return to_route('encode.index')->with('success', $message);
    }


    /**
     * Remove the specified resource from storage.
     * @throws \Throwable
     */
    public function destroy(PurchaseRequest $purchaseRequest)
    {
        abort_unless(
            (int) $purchaseRequest->status === 0,
            403,
            'That request can no longer be deleted here.'
        );

        $number = $purchaseRequest->pr_number;

        DB::transaction(function () use ($purchaseRequest) {
            $purchaseRequest->items()->delete();
            $purchaseRequest->delete();
        });

        return to_route('encode.index')->with('success', "{$number} deleted.");
    }
}

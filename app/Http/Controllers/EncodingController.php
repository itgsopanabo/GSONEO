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
        // Active offices only; the form stores the name, as every other module does.
        $departments = Departments::select('Department_Code', 'Department_Name')
            ->where('is_active', true)
            ->orderBy('Department_Name')->get();

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
        return $this->persist($request, status: 1, redirectTo: 'encode.create');
    }

    /**
     * @throws \Throwable
     */
    public function draft(Request $request)
    {
        return $this->persist($request, status: 0, redirectTo: 'encode.index');
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
            (int) $purchaseRequest->status === 0,
            403,
            'That request can no longer be edited here.'
        );

        return Inertia::render('Procurement/Encoding/Edit', [
            'purchaseRequest' => $purchaseRequest,
            'departments'     => Departments::orderBy('Department_Name')->get(),
            'isDraft' => (int) $purchaseRequest->status === 0,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, PurchaseRequest $purchaseRequest)
    {
        abort_unless(
            (int) $purchaseRequest->status === 0,
            403,
            'That request can no longer be edited here.'
        );

        $isDraft = $request->input('status') === 'draft';
        $ifFinal = $isDraft ? 'nullable' : 'required';

        // Checked against the request's own item ids rather than an exists rule,
        // so it holds whichever column the items table uses for the foreign key.
        $ownedIds = $purchaseRequest->items()->pluck('id')->all();

        $validated = $request->validate([
            'status' => ['required', 'in:draft,submitted'],
            // An office from the list, or the one the request already has.
            'requester_department' => [$ifFinal, ...Departments::nameRule($purchaseRequest->requester_department)],
            'remarks_or_notes' => ['nullable', 'string'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['nullable', 'integer', Rule::in($ownedIds)],
            ...$this->itemRules($ifFinal),

            'removed_item_ids' => ['array'],
            'removed_item_ids.*' => ['integer', Rule::in($ownedIds)],
        ], $this->itemMessages());

        DB::transaction(function () use ($purchaseRequest, $validated, $isDraft) {
            if (!empty($validated['removed_item_ids'])) {
                $purchaseRequest->items()
                    ->whereIn('id', $validated['removed_item_ids'])
                    ->delete();
            }

            $existing = $purchaseRequest->items()->get()->keyBy('id');

            foreach ($validated['items'] as $row) {
                $attributes = $this->itemAttributes($row);
                $item = !empty($row['id']) ? $existing->get($row['id']) : null;

                $item
                    ? $item->update($attributes)
                    : $purchaseRequest->items()->create($attributes);
            }

            $purchaseRequest->update([
                'requester_department' => $validated['requester_department'] ?? $purchaseRequest->requester_department,
                'remarks_or_notes' => $validated['remarks_or_notes'] ?? $purchaseRequest->remarks_or_notes,
                'status' => $isDraft ? 0 : 1,
                'encoded_by' => Auth::id(),
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

    /* ------------------------------------------------------------------ */
    /* Shared write path                                                   */
    /* ------------------------------------------------------------------ */

    /**
     * Creating a draft and creating a submitted request differ only in the
     * status they land on and where the encoder goes next. A draft is allowed
     * to be incomplete; a submitted request is not.
     *
     * @throws \Throwable
     */
    private function persist(Request $request, int $status, string $redirectTo)
    {
        $isDraft = $status === 0;
        $ifFinal = $isDraft ? 'nullable' : 'required';

        $validated = $request->validate([
            'requester_department' => [$ifFinal, ...Departments::nameRule()],
            'needed_by_date' => ['nullable', 'date', 'after_or_equal:today'],
            'remarks_or_notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            ...$this->itemRules($ifFinal),
        ], $this->itemMessages());

        $purchaseRequest = DB::transaction(function () use ($validated, $status) {
            $purchaseRequest = PurchaseRequest::create([
                'pr_number' => $this->nextPrNumber(),
                'requester_department' => $validated['requester_department'] ?? null,
                'needed_by_date' => $validated['needed_by_date'] ?? null,
                'remarks_or_notes' => $validated['remarks_or_notes'] ?? null,
                'status' => $status,
                'verify_by_emp_id' => null,
            ]);

            // The relationship sets the foreign key, so it isn't listed here.
            $purchaseRequest->items()->createMany(
                array_map(fn ($item) => $this->itemAttributes($item), $validated['items'])
            );

            return $purchaseRequest;
        });

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'auditable_type' => PurchaseRequest::class,
            'auditable_id' => $purchaseRequest->id,
            'description' => "Created Purchase Request {$purchaseRequest->pr_number}",
            'old_values' => null,
            'new_values' => $purchaseRequest->load('items')->toArray(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return redirect()->route($redirectTo)
            ->with('success', 'Purchase Request created successfully.');
    }

    /**
     * Description carries the item: name, brand, model and specs in one field.
     *
     * On a final submit the price has to be a real amount — min:0.01 rather than
     * min:0, because 'required' passes on a zero and 0.004 would round down to
     * nothing in any peso total. Drafts stay loose so a half-filled request can
     * still be parked.
     */
    private function itemRules(string $presence): array
    {
        $isFinal = $presence === 'required';

        return [
            'items.*.description' => [$presence, 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.estimated_unit_price' => [
                $presence,
                'numeric',
                $isFinal ? 'min:0.01' : 'min:0',
            ],
        ];
    }

    private function itemMessages(): array
    {
        return [
            'items.*.description.required' => 'Every line needs a description.',
            'items.*.quantity.min' => 'Quantity has to be at least 1.',
            'items.*.estimated_unit_price.required' => 'Every line needs an estimated unit price.',
            'items.*.estimated_unit_price.min' => 'Estimated unit price must be greater than 0.00.',
        ];
    }

    /**
     * Maps one submitted row onto the item columns.
     */
    private function itemAttributes(array $row): array
    {
        $quantity = (int) $row['quantity'];
        $price = $row['estimated_unit_price'] ?? null;
        $description = trim((string) ($row['description'] ?? ''));
        $unit = trim((string) ($row['unit'] ?? ''));

        return [
            'item_desc' => $description !== '' ? $description : null,
            'quantity' => $quantity,
            'unit' => $unit !== '' ? $unit : 'pcs',
            'estimated_unit_cost' => $price,
            'total_estimated_cost' => $price === null ? null : $quantity * (float) $price,
        ];
    }

    /**
     * Counting rows reused a number after a deletion and could hand the same one
     * to two encoders at once. Reading the highest number under a lock, inside
     * the caller's transaction, avoids both.
     */
    private function nextPrNumber(): string
    {
        $prefix = 'EPR-' . date('Y') . '-';

        $last = PurchaseRequest::query()
            ->where('pr_number', 'like', $prefix . '%')
            ->lockForUpdate()
            ->max('pr_number');

        $sequence = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix . str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}

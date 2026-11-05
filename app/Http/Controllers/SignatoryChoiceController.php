<?php

namespace App\Http\Controllers;

use App\LogsAudit;
use App\Models\PurchaseRequest;
use App\Models\SignatorySet;
use App\Services\Signatories;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The signer set a request's document prints with, chosen beside its print
 * button. Anyone who may print the document may change it.
 */
class SignatoryChoiceController extends Controller
{
    use LogsAudit;

    public function show(Request $request, string $document): JsonResponse
    {
        $purchaseRequest = $this->purchaseRequest($request, $document);

        return response()->json($this->state($document, $purchaseRequest));
    }

    public function update(Request $request, string $document): JsonResponse
    {
        $purchaseRequest = $this->purchaseRequest($request, $document);

        $validated = $request->validate([
            'set_id' => ['nullable', 'integer', Rule::exists('signatory_sets', 'id')->where('document', $document)],
        ]);

        $choices = $purchaseRequest->signatory_set_ids ?? [];
        $old = $choices[$document] ?? null;
        $new = $validated['set_id'] ?? null;

        if ($old !== $new) {
            if ($new === null) {
                unset($choices[$document]);
            } else {
                $choices[$document] = $new;
            }

            $purchaseRequest->update(['signatory_set_ids' => $choices ?: null]);

            $name = fn ($id) => $id ? (SignatorySet::find($id)?->name ?? "set #{$id}") : 'Automatic';
            $label = Signatories::documents()[$document]['label'];

            $this->audit(
                'signatory_set_chosen',
                $purchaseRequest,
                "{$label} of {$purchaseRequest->pr_number} now prints with: {$name($new)}",
                ["{$document} signers" => $name($old)],
                ["{$document} signers" => $name($new)],
            );
        }

        return response()->json($this->state($document, $purchaseRequest));
    }

    /** The request named by ?pr_number=, once the user may print this document. */
    private function purchaseRequest(Request $request, string $document): PurchaseRequest
    {
        abort_unless(Signatories::exists($document), 404);
        abort_unless($request->user()->can(Signatories::documents()[$document]['permission']), 403);

        return PurchaseRequest::where('pr_number', (string) $request->input('pr_number'))->firstOrFail();
    }

    private function state(string $document, PurchaseRequest $purchaseRequest): array
    {
        $automatic = Signatories::automatic($document, $purchaseRequest->requester_department);
        $chosen = $purchaseRequest->signatory_set_ids[$document] ?? null;
        $sets = SignatorySet::forDocument($document)->orderByDesc('is_default')->orderBy('name')->get(['id', 'name', 'signers']);

        return [
            'chosen' => $sets->contains('id', $chosen) ? $chosen : null,
            'automatic' => ['id' => $automatic->id, 'name' => $automatic->name],
            'sets' => $sets->map(fn ($set) => [
                'id' => $set->id,
                'name' => $set->name,
                'signers' => collect($set->signers)->pluck('name')->filter()->values(),
            ]),
        ];
    }
}

<?php

namespace App\Services;

use App\Models\PurchaseRequest;
use App\Models\SignatorySet;
use Throwable;

/**
 * Which signer set a document prints for a request.
 *
 * In order: the set chosen on the request, the set linked to the request's
 * requesting office, the document's default set, and finally the config
 * defaults. A chosen set that was since deleted falls through to the next.
 */
class Signatories
{
    /** The documents with signer sets, document => definition from config. */
    public static function documents(): array
    {
        return config('documents.signatories');
    }

    public static function exists(string $document): bool
    {
        return array_key_exists($document, self::documents());
    }

    /** The set a document prints for this request. */
    public static function for(string $document, ?PurchaseRequest $request): SignatorySet
    {
        try {
            $chosen = $request?->signatory_set_ids[$document] ?? null;

            return ($chosen ? SignatorySet::forDocument($document)->find($chosen) : null)
                ?? self::automatic($document, $request?->requester_department);
        } catch (Throwable) {
            return SignatorySet::fromDefaults($document);   // Tables not migrated yet: print the defaults rather than fail the PDF.
        }
    }

    /** The set used when none is chosen: the office's, else the default. */
    public static function automatic(string $document, ?string $office): SignatorySet
    {
        $linked = filled($office)
            ? SignatorySet::forDocument($document)
                ->whereHas('departments', fn ($query) => $query->where('Department_Name', $office))
                ->first()
            : null;

        return $linked
            ?? SignatorySet::forDocument($document)->where('is_default', true)->first()
            ?? SignatorySet::forDocument($document)->orderBy('id')->first()
            ?? SignatorySet::fromDefaults($document);
    }
}

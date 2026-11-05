<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A named list of the people who sign one kind of document: "IT Equipment"
 * for the IAR, signed by the IT inspectors.
 *
 * `signers` is the list in print order, each {label, name, position}.
 * `fixed` holds the placements a layout keeps apart from the list, keyed as
 * in config('documents.signatories.<document>.fixed'), each {name, position}.
 * Requests from a linked office print with this set unless staff chose
 * another one on the request.
 */
class SignatorySet extends Model
{
    protected $fillable = ['document', 'name', 'is_default', 'signers', 'fixed'];

    protected $casts = [
        'is_default' => 'boolean',
        'signers' => 'array',
        'fixed' => 'array',
    ];

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Departments::class, 'department_signatory_set', 'signatory_set_id', 'department_id');
    }

    public function scopeForDocument(Builder $query, string $document): Builder
    {
        return $query->where('document', $document);
    }

    /**
     * An unsaved set holding the config defaults, for a document that has no
     * set at all (the table emptied by hand, or not migrated yet).
     */
    public static function fromDefaults(string $document): self
    {
        $definition = config("documents.signatories.{$document}");

        return new self([
            'document' => $document,
            'name' => 'Default',
            'is_default' => true,
            'signers' => collect($definition['signers'] ?? [])
                ->map(fn ($slot) => ['label' => $slot[0], 'name' => $slot[1], 'position' => $slot[2]])
                ->values()->all(),
            'fixed' => collect($definition['fixed'] ?? [])
                ->map(fn ($slot) => ['name' => $slot[1], 'position' => $slot[2]])
                ->all(),
        ]);
    }

    /** Signature blocks per printed row: up to three, but four print as two rows of two. */
    public static function columns(int $count): int
    {
        return $count === 4 ? 2 : max(1, min($count, 3));
    }

    /** One fixed placement, blank when the set never saved it. */
    public function fixedSigner(string $slot): array
    {
        return [
            'name' => (string) ($this->fixed[$slot]['name'] ?? ''),
            'position' => (string) ($this->fixed[$slot]['position'] ?? ''),
        ];
    }
}

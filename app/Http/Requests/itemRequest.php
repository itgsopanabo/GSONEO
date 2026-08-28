<?php

namespace App\Http\Requests;

use App\Models\items;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ItemRequest extends FormRequest
{
    /**
     * Who is allowed to send this request.
     *
     * Returning true lets any authenticated route through — replace with a
     * real check (policy, role, ownership) when you have one.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Normalise input before the rules run.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'item_desc' => is_string($this->item_desc) ? trim($this->item_desc) : $this->item_desc,
            'item_unit' => is_string($this->item_unit) ? trim($this->item_unit) : $this->item_unit,
        ]);
    }

    /**
     * Validation rules.
     */
    public function rules(): array
    {
        return [
            'item_desc'  => ['required', 'string', 'max:64', Rule::unique('items', 'item_desc')->ignore($this->item())],
            'item_unit'  => ['nullable', 'string', 'max:2000'],
            'item_price' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * Friendlier field names in error messages.
     */
    public function attributes(): array
    {
        return [
            'item_desc'  => 'item description',
            'item_unit'  => 'unit',
            'item_price' => 'price',
        ];
    }

    /**
     * Custom messages. Delete any you don't need — Laravel's defaults are fine.
     */
    public function messages(): array
    {
        return [
            'item_desc.unique' => 'An item with this description already exists.',
        ];
    }

    /**
     * The record being updated, or null when creating.
     *
     * Route model binding puts the items instance on the {item} parameter,
     * which is what the unique rule needs to ignore.
     */
    protected function item(): ?items
    {
        $item = $this->route('item');

        return $item instanceof items ? $item : null;
    }
}

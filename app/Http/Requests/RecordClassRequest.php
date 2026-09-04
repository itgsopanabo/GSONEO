<?php

namespace App\Http\Requests;

use App\Models\RecordsClasses;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordClassRequest extends FormRequest
{
    public function rules(): array
    {
        $id = $this->route('record_class')?->id;

        return [
            'code'              => ['required', 'string', 'max:30', 'regex:/^[A-Z0-9\-]+$/',
                Rule::unique('record_classes', 'code')->ignore($id)],
            'title'             => ['required', 'string', 'max:255'],
            'description'       => ['nullable', 'string'],
            'rds_source'        => ['required', 'string', 'max:50'],
            'rds_item_no'       => ['required', 'string', 'max:30'],
            'is_permanent'      => ['boolean'],
            'retention_years'   => ['nullable', 'integer', 'min:1', 'max:200',
                Rule::requiredIf(fn () => ! $this->boolean('is_permanent'))],
            'retention_trigger' => ['required', Rule::in(RecordsClasses::TRIGGERS)],
            'is_vital'          => ['boolean'],
            'sensitivity'       => ['required', Rule::in(RecordsClasses::SENSITIVITIES)],
            'is_active'         => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'rds_item_no.required' => 'Cite the item number from the disposition schedule. Enter TODO if it is not yet confirmed.',
            'code.regex'           => 'Use uppercase letters, numbers and hyphens only, e.g. PROP-TITLE.',
        ];
    }
}

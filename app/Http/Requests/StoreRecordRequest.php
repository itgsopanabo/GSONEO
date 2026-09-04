<?php

namespace App\Http\Requests;

use App\Models\Records;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRecordRequest extends FormRequest
{

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'record_class_id'     => ['required', 'exists:record_classes,id'],
            'title'               => ['required', 'string', 'max:255'],
            'reference_no'        => ['nullable', 'string', 'max:100'],
            'record_date'         => ['required', 'date', 'before_or_equal:today'],
            'originating_office'  => ['required', 'string', 'max:255'],
            'custodian'           => ['required', 'string', 'max:255'],
            'physical_location'   => ['required', 'string', 'max:255'],
            'box_no'              => ['nullable', 'string', 'max:50'],
            'retention_starts_on' => ['nullable', 'date', 'after_or_equal:record_date'],
            'status'              => ['required', Rule::in(Records::STATUSES)],
        ];
    }
}

<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'requester_name' => ['required', 'string', 'max:255'],
            'requester_department' => ['required', 'string', 'max:255'],
            'remarks_or_notes' => ['required', 'string', 'max:2000'],
        ];
    }
}

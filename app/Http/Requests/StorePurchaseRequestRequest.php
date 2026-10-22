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
            // One of the offices on the Requesting Offices screen.
            'requester_department' => ['required', ...\App\Models\Departments::nameRule()],
            'remarks_or_notes' => ['required', 'string', 'max:2000'],
        ];
    }
}

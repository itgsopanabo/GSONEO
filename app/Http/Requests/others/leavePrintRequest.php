<?php

namespace App\Http\Requests\others;

use Illuminate\Foundation\Http\FormRequest;

class leavePrintRequest extends FormRequest
{
    /**
     * Access is already gated by the auth middleware on the route.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'office' => ['nullable', 'string', 'max:60'],
            'last' => ['required', 'string', 'max:60'],
            'first' => ['required', 'string', 'max:60'],
            'middle' => ['nullable', 'string', 'max:60'],
            'position' => ['nullable', 'string', 'max:80'],
            'salary' => ['nullable', 'string', 'max:40'],
            'date_filing' => ['nullable', 'date'],
            'within_ph' => ['nullable', 'string', 'max:120'],
            'abroad' => ['nullable', 'string', 'max:120'],
            'in_hospital' => ['nullable', 'string', 'max:120'],
            'out_patient' => ['nullable', 'string', 'max:120'],
            'women_illness' => ['nullable', 'string', 'max:120'],
            'working_days' => ['nullable', 'string', 'max:40'],
            'inclusive_dates' => ['nullable', 'string', 'max:80'],
            'credits_as_of' => ['nullable', 'string', 'max:40'],
            'vl_earned' => ['nullable', 'string', 'max:20'],
            'sl_earned' => ['nullable', 'string', 'max:20'],
            'vl_less' => ['nullable', 'string', 'max:20'],
            'sl_less' => ['nullable', 'string', 'max:20'],
            'vl_balance' => ['nullable', 'string', 'max:20'],
            'sl_balance' => ['nullable', 'string', 'max:20'],
            'days_with_pay' => ['nullable', 'string', 'max:20'],
            'days_without_pay' => ['nullable', 'string', 'max:20'],
            'days_others' => ['nullable', 'string', 'max:40'],
            'ticks' => ['nullable', 'array'],
            'ticks.*' => ['string', 'max:30'],
        ];
    }

    /**
     * Every top-level field, used to fill blanks so the print view never hits
     * an undefined variable for a box the user left empty.
     *
     * @return array<int, string>
     */
    public function fieldNames(): array
    {
        return array_values(array_filter(
            array_keys($this->rules()),
            fn (string $key): bool => ! str_contains($key, '.'),
        ));
    }
}

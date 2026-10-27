<?php

namespace App\Http\Requests\Auth;

use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /** Failed attempts allowed for one employee ID from one IP address, per minute. */
    private const MAX_ATTEMPTS_PER_ID = 5;

    /**
     * Failed attempts allowed from one IP address across every employee ID,
     * per IP_DECAY_SECONDS. Stops one password being tried against many IDs,
     * which the per-ID limit alone never notices.
     */
    private const MAX_ATTEMPTS_PER_IP = 20;

    private const IP_DECAY_SECONDS = 600;

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'empID' => ['required', 'integer'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $credentials = [
            'emp_id' => (int) $this->input('empID'),
            'password' => $this->input('password'),
        ];

        // 1. One message for an unknown ID and a wrong password, so the form
        //    can't be used to find out which employee IDs have accounts.
        //    Auth::attempt also takes the same time for both.
        if (! Auth::attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey());
            RateLimiter::hit($this->ipThrottleKey(), self::IP_DECAY_SECONDS);

            throw ValidationException::withMessages([
                'empID' => 'The employee ID or password is incorrect.',
            ]);
        }

        // 2. Only active accounts may proceed. Checked after the password so a
        //    wrong password never reveals whether an account is deactivated.
        if (! Auth::user()->isActive()) {
            $this->refuse('This account is inactive. Please contact an administrator.');
        }

        // 3. A one-time password from an admin stops working once it expires.
        if (Auth::user()->temporaryPasswordExpired()) {
            $this->refuse('Your one-time password has expired. Ask an administrator for a new one.');
        }

        // The IP count is left to run out on its own, so one working account
        // can't be used to reset it between guesses at others.
        RateLimiter::clear($this->throttleKey());
    }

    /** Sign back out after a correct password that still may not be used. */
    private function refuse(string $message): never
    {
        Auth::logout();
        $this->session()->invalidate();
        $this->session()->regenerateToken();

        throw ValidationException::withMessages(['empID' => $message]);
    }

    /**
     * Ensure the login request is not rate limited.
     */
    public function ensureIsNotRateLimited(): void
    {
        $limits = [
            $this->throttleKey() => self::MAX_ATTEMPTS_PER_ID,
            $this->ipThrottleKey() => self::MAX_ATTEMPTS_PER_IP,
        ];

        foreach ($limits as $key => $maxAttempts) {
            if (! RateLimiter::tooManyAttempts($key, $maxAttempts)) {
                continue;
            }

            event(new Lockout($this));

            $seconds = RateLimiter::availableIn($key);

            throw ValidationException::withMessages([
                'empID' => trans('auth.throttle', [
                    'seconds' => $seconds,
                    'minutes' => ceil($seconds / 60),
                ]),
            ]);
        }
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        // Fixes the global lockout bug by separating keys per Employee ID
        return Str::transliterate($this->input('empID') . '|' . $this->ip());
    }

    /** Every failed attempt from this IP address, whatever employee ID it used. */
    public function ipThrottleKey(): string
    {
        return 'login-ip|' . $this->ip();
    }
}

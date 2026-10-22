import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';

/**
 * Palette (kept inline so it doesn't depend on tailwind.config changes):
 *   ink      #151A1E   text + primary button
 *   muted    #5A6570   labels, secondary copy
 *   rule     #E2E6E4   hairlines
 *   accent   #1D6F63   focus, links      (dark: #4FB3A2)
 *   warn     #7A5312   lockout notice
 *   danger   #B3261E   field errors
 */

function Field({ label, htmlFor, invalid = false, children }) {
    return (
        <div
            className={
                "relative flex items-center gap-4 px-4 py-3.5 transition-colors motion-reduce:transition-none " +
                "after:absolute after:inset-y-1.5 after:left-0 after:w-[3px] after:rounded-full after:bg-transparent after:content-[''] " +
                'focus-within:bg-[#1D6F63]/[0.04] focus-within:after:bg-[#1D6F63] ' +
                'dark:focus-within:bg-[#4FB3A2]/[0.07] dark:focus-within:after:bg-[#4FB3A2] ' +
                (invalid ? 'bg-[#B3261E]/[0.04] dark:bg-[#B3261E]/[0.10]' : '')
            }
        >
            <label
                htmlFor={htmlFor}
                className="w-[104px] shrink-0 text-[13px] text-[#5A6570] dark:text-zinc-400"
            >
                {label}
            </label>
            {children}
        </div>
    );
}

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, clearErrors, reset } = useForm({
        empID: '',
        password: '',
        remember: false,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [lockUntil, setLockUntil] = useState(0);
    const [secondsLeft, setSecondsLeft] = useState(0);

    const locked = secondsLeft > 0;
    // While locked, the throttle message lives in the banner, not under the field.
    const empIDError = locked ? null : errors.empID;

    // Read the lockout window out of Laravel's throttle message once, then run
    // the countdown off a deadline so it can't drift or double-tick.
    useEffect(() => {
        const match = errors.empID?.match(/(\d+)\s*second/i);
        if (match) {
            setLockUntil(Date.now() + Number(match[1]) * 1000);
        }
    }, [errors.empID]);

    useEffect(() => {
        if (!lockUntil) return;

        const tick = () => {
            const left = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
            setSecondsLeft(left);
            if (left === 0) {
                setLockUntil(0);
                clearErrors('empID');
            }
        };

        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [lockUntil]);

    const submit = (e) => {
        e.preventDefault();
        if (locked) return;

        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    const inputBase =
        'w-full min-w-0 border-0 bg-transparent p-0 text-[15px] text-[#151A1E] ' +
        'focus:outline-none focus:ring-0 disabled:text-[#A3ABB2] dark:text-zinc-50';

    return (
        <GuestLayout>
            <Head title="Sign in" />

            <div className="mb-7">
                <h1 className="text-[22px] font-semibold tracking-tight text-[#151A1E] dark:text-zinc-50">
                    Sign in
                </h1>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#5A6570] dark:text-zinc-400">
                    Use the employee ID printed on your badge.
                </p>
            </div>

            {status && (
                <div
                    role="status"
                    className="mb-5 rounded-xl border border-[#C7DED9] bg-[#F1F8F6] px-4 py-3 text-[13px] leading-relaxed text-[#1D6F63] dark:border-[#4FB3A2]/30 dark:bg-[#4FB3A2]/10 dark:text-[#7FD0C1]"
                >
                    {status}
                </div>
            )}

            {locked && (
                <div
                    role="status"
                    aria-live="polite"
                    className="mb-5 rounded-xl border border-[#E7D9BC] bg-[#FBF6EC] px-4 py-3 text-[13px] leading-relaxed text-[#7A5312] dark:border-[#B98A2E]/35 dark:bg-[#B98A2E]/10 dark:text-[#DDB86A]"
                >
                    Too many sign-in attempts. You can try again in{' '}
                    <span className="font-mono tabular-nums">{secondsLeft}</span>{' '}
                    {secondsLeft === 1 ? 'second' : 'seconds'}.
                </div>
            )}

            <form onSubmit={submit} noValidate>
                <div
                    className={
                        'divide-y overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900/40 ' +
                        (empIDError || errors.password
                            ? 'divide-[#EBD3D1] border-[#E3BDBA] dark:divide-zinc-800 dark:border-[#B3261E]/40'
                            : 'divide-[#E2E6E4] border-[#E2E6E4] dark:divide-zinc-800 dark:border-zinc-800')
                    }
                >
                    <Field label="Employee ID" htmlFor="empID" invalid={!!empIDError}>
                        <input
                            id="empID"
                            name="empID"
                            type="text"
                            inputMode="numeric"
                            autoComplete="username"
                            autoFocus
                            disabled={locked}
                            value={data.empID}
                            aria-invalid={!!empIDError}
                            aria-describedby={empIDError ? 'empID-error' : undefined}
                            onChange={(e) => setData('empID', e.target.value.replace(/\D/g, ''))}
                            placeholder="e.g. 100482"
                            className={
                                inputBase +
                                ' font-mono text-[17px] tracking-[0.18em] tabular-nums ' +
                                'placeholder:font-sans placeholder:text-[13px] placeholder:tracking-normal placeholder:text-[#A3ABB2]'
                            }
                        />
                    </Field>

                    <Field label="Password" htmlFor="password" invalid={!!errors.password}>
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            disabled={locked}
                            value={data.password}
                            aria-invalid={!!errors.password}
                            aria-describedby={errors.password ? 'password-error' : undefined}
                            onChange={(e) => setData('password', e.target.value)}
                            className={inputBase}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-pressed={showPassword}
                            className="shrink-0 rounded text-[12px] font-medium text-[#1D6F63] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6F63] focus-visible:ring-offset-2 dark:text-[#4FB3A2] dark:focus-visible:ring-offset-zinc-950"
                        >
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </Field>
                </div>

                {(empIDError || errors.password) && (
                    <p
                        id={empIDError ? 'empID-error' : 'password-error'}
                        aria-live="polite"
                        className="mt-2.5 text-[13px] text-[#B3261E] dark:text-[#E4938D]"
                    >
                        {empIDError || errors.password}
                    </p>
                )}

                <div className="mt-5 flex items-center justify-between">
                    <label className="flex cursor-pointer select-none items-center gap-2.5">
                        <input
                            type="checkbox"
                            name="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            className="h-4 w-4 rounded border-[#CFD5D2] text-[#1D6F63] focus:ring-[#1D6F63] focus:ring-offset-0 dark:border-zinc-700 dark:bg-zinc-900 dark:text-[#4FB3A2]"
                        />
                        <span className="text-[13px] text-[#5A6570] dark:text-zinc-400">
                            Keep me signed in
                        </span>
                    </label>

                    {/* Uncomment once the password reset route is live.
                    {canResetPassword && (
                        <Link
                            href={route('password.request')}
                            className="text-[13px] text-[#1D6F63] hover:underline dark:text-[#4FB3A2]"
                        >
                            Forgot password?
                        </Link>
                    )}
                    */}
                </div>

                <button
                    type="submit"
                    disabled={processing || locked}
                    className="mt-6 h-12 w-full rounded-xl bg-[#151A1E] text-[15px] font-medium text-white transition-colors hover:bg-[#2A3238] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6F63] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none dark:bg-zinc-50 dark:text-[#151A1E] dark:hover:bg-white dark:focus-visible:ring-[#4FB3A2] dark:focus-visible:ring-offset-zinc-950"
                >
                    {processing ? 'Signing in…' : locked ? `Locked for ${secondsLeft}s` : 'Sign in'}
                </button>
            </form>

            <p className="mt-8 border-t border-[#E2E6E4] pt-6 text-center text-[13px] text-[#5A6570] dark:border-zinc-800 dark:text-zinc-400">
                No account yet? Ask your system administrator to add you.
            </p>
        </GuestLayout>
    );
}

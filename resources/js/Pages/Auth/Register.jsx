import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';

/* Same palette as Login:
 *   ink #151A1E · muted #5A6570 · rule #E2E6E4 · accent #1D6F63 (dark #4FB3A2) · danger #B3261E
 * If you'd rather not repeat this helper, lift it into @/Components/FieldRow
 * and import it in both Login and Register.
 */
function Field({ label, htmlFor, error, children, trailing }) {
    return (
        <div
            className={
                "relative px-4 py-3.5 transition-colors motion-reduce:transition-none " +
                "after:absolute after:inset-y-1.5 after:left-0 after:w-[3px] after:rounded-full after:bg-transparent after:content-[''] " +
                'focus-within:bg-[#1D6F63]/[0.04] focus-within:after:bg-[#1D6F63] ' +
                'dark:focus-within:bg-[#4FB3A2]/[0.07] dark:focus-within:after:bg-[#4FB3A2] ' +
                (error ? 'bg-[#B3261E]/[0.04] dark:bg-[#B3261E]/[0.10]' : '')
            }
        >
            <div className="flex items-center gap-4">
                <label
                    htmlFor={htmlFor}
                    className="w-[108px] shrink-0 text-[13px] leading-tight text-[#5A6570] dark:text-zinc-400"
                >
                    {label}
                </label>
                {children}
                {trailing}
            </div>
            {error && (
                <p
                    id={`${htmlFor}-error`}
                    aria-live="polite"
                    className="mt-1.5 text-[13px] text-[#B3261E] dark:text-[#E4938D]"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

const inputBase =
    'w-full min-w-0 border-0 bg-transparent p-0 text-[15px] text-[#151A1E] ' +
    'focus:outline-none focus:ring-0 placeholder:text-[13px] placeholder:text-[#A3ABB2] dark:text-zinc-50';

export default function Register({ roles = [] }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        empID: '',
        fname: '',
        lname: '',
        role_id: '',
        password: '',
        password_confirmation: '',
    });

    const [showPassword, setShowPassword] = useState(false);

    const groupedRoles = useMemo(() => {
        const list = Array.isArray(roles) ? roles : [];
        const groups = list.reduce((acc, role) => {
            const section = role.section || 'Other';
            (acc[section] ||= []).push(role);
            return acc;
        }, {});
        return Object.entries(groups);
    }, [roles]);

    // Only wrap in optgroups when the roles actually carry sections.
    const useOptgroups = groupedRoles.length > 1 || groupedRoles[0]?.[0] !== 'Other';

    const mismatch =
        data.password_confirmation.length > 0 &&
        data.password !== data.password_confirmation;

    const submit = (e) => {
        e.preventDefault();

        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    const groupClasses = (hasError) =>
        'divide-y overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900/40 ' +
        (hasError
            ? 'divide-[#EBD3D1] border-[#E3BDBA] dark:divide-zinc-800 dark:border-[#B3261E]/40'
            : 'divide-[#E2E6E4] border-[#E2E6E4] dark:divide-zinc-800 dark:border-zinc-800');

    const roleOptions = (list) =>
        list.map((role) => (
            <option key={role.id} value={role.id}>
                {role.role_name}
            </option>
        ));

    return (
        <GuestLayout>
            <Head title="Create account" />

            <div className="mb-7">
                <h1 className="text-[22px] font-semibold tracking-tight text-[#151A1E] dark:text-zinc-50">
                    Create your account
                </h1>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#5A6570] dark:text-zinc-400">
                    Register with the employee ID printed on your badge.
                </p>
            </div>

            <form onSubmit={submit}>
                <div
                    className={groupClasses(
                        !!(errors.empID || errors.fname || errors.lname || errors.role_id),
                    )}
                >
                    <Field label="Employee ID" htmlFor="empID" error={errors.empID}>
                        <input
                            id="empID"
                            name="empID"
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            autoFocus
                            required
                            value={data.empID}
                            aria-invalid={!!errors.empID}
                            aria-describedby={errors.empID ? 'empID-error' : undefined}
                            onChange={(e) => setData('empID', e.target.value.replace(/\D/g, ''))}
                            placeholder="e.g. 100482"
                            className={
                                inputBase +
                                ' font-mono text-[17px] tracking-[0.18em] tabular-nums ' +
                                'placeholder:font-sans placeholder:tracking-normal'
                            }
                        />
                    </Field>

                    <Field label="First name" htmlFor="fname" error={errors.fname}>
                        <input
                            id="fname"
                            name="fname"
                            type="text"
                            autoComplete="given-name"
                            required
                            value={data.fname}
                            aria-invalid={!!errors.fname}
                            aria-describedby={errors.fname ? 'fname-error' : undefined}
                            onChange={(e) => setData('fname', e.target.value)}
                            className={inputBase}
                        />
                    </Field>

                    <Field label="Last name" htmlFor="lname" error={errors.lname}>
                        <input
                            id="lname"
                            name="lname"
                            type="text"
                            autoComplete="family-name"
                            required
                            value={data.lname}
                            aria-invalid={!!errors.lname}
                            aria-describedby={errors.lname ? 'lname-error' : undefined}
                            onChange={(e) => setData('lname', e.target.value)}
                            className={inputBase}
                        />
                    </Field>

                    <Field
                        label="Role"
                        htmlFor="role_id"
                        error={errors.role_id}d
                    >
                        <select
                            id="role_id"
                            name="role_id"
                            required
                            value={data.role_id}
                            aria-invalid={!!errors.role_id}
                            aria-describedby={errors.role_id ? 'role_id-error' : undefined}
                            onChange={(e) =>
                                setData(
                                    'role_id',
                                    e.target.value === '' ? '' : Number(e.target.value),
                                )
                            }
                            className={
                                inputBase +
                                ' -mr-1 cursor-pointer appearance-none pr-1 ' +
                                (data.role_id === '' ? 'text-[#A3ABB2] dark:text-zinc-500' : '')
                            }
                        >
                            <option value="" disabled>
                                Select your position
                            </option>
                            {useOptgroups
                                ? groupedRoles.map(([section, sectionRoles]) => (
                                    <optgroup key={section} label={section}>
                                        {roleOptions(sectionRoles)}
                                    </optgroup>
                                ))
                                : roleOptions(groupedRoles[0]?.[1] ?? [])}
                        </select>
                    </Field>
                </div>

                <div
                    className={
                        'mt-4 ' +
                        groupClasses(!!(errors.password || errors.password_confirmation))
                    }
                >
                    <Field
                        label="Password"
                        htmlFor="password"
                        error={errors.password}
                        trailing={
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-pressed={showPassword}
                                className="shrink-0 rounded text-[12px] font-medium text-[#1D6F63] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6F63] focus-visible:ring-offset-2 dark:text-[#4FB3A2] dark:focus-visible:ring-offset-zinc-950"
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        }
                    >
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            value={data.password}
                            aria-invalid={!!errors.password}
                            aria-describedby={errors.password ? 'password-error' : undefined}
                            onChange={(e) => setData('password', e.target.value)}
                            className={inputBase}
                        />
                    </Field>

                    <Field
                        label="Confirm"
                        htmlFor="password_confirmation"
                        error={errors.password_confirmation}
                    >
                        <input
                            id="password_confirmation"
                            name="password_confirmation"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            required
                            value={data.password_confirmation}
                            aria-invalid={!!errors.password_confirmation}
                            aria-describedby={
                                errors.password_confirmation
                                    ? 'password_confirmation-error'
                                    : undefined
                            }
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            className={inputBase}
                        />
                    </Field>
                </div>

                {mismatch && !errors.password_confirmation && (
                    <p aria-live="polite" className="mt-2 text-[13px] text-[#5A6570] dark:text-zinc-400">
                        Both passwords need to match before you can register.
                    </p>
                )}

                <button
                    type="submit"
                    disabled={processing}
                    className="mt-6 h-12 w-full rounded-xl bg-[#151A1E] text-[15px] font-medium text-white transition-colors hover:bg-[#2A3238] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6F63] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none dark:bg-zinc-50 dark:text-[#151A1E] dark:hover:bg-white dark:focus-visible:ring-[#4FB3A2] dark:focus-visible:ring-offset-zinc-950"
                >
                    {processing ? 'Creating account…' : 'Create account'}
                </button>
            </form>

            <p className="mt-8 border-t border-[#E2E6E4] pt-6 text-center text-[13px] text-[#5A6570] dark:border-zinc-800 dark:text-zinc-400">
                Already have an account?{' '}
                <Link
                    href={route('login')}
                    className="font-medium text-[#1D6F63] hover:underline dark:text-[#4FB3A2]"
                >
                    Sign in
                </Link>
            </p>
        </GuestLayout>
    );
}

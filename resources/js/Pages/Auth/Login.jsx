import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';


export default function Login({ status, canResetPassword, canRegister, laravelVersion, phpVersion }) {
    const { data, setData, post, processing,setError, errors, reset } = useForm({
        empID: '', password: '', remember: false,
    });

    // Local state to keep track of the countdown seconds
    const [secondsLeft, setSecondsLeft] = useState(null);


    // Watch errors.empID for a throttling message
    useEffect(() => {
        if (errors.empID && errors.empID.includes('try again in')) {
            // Regex to grab the number out of the backend string
            const match = errors.empID.match(/\d+/);
            if (match && secondsLeft === null) {
                setSecondsLeft(parseInt(match[0], 10));
            }
        } else {
            setSecondsLeft(null);
        }
    }, [errors.empID]);


    // Handle the live second-by-second countdown timer
    useEffect(() => {
        if (secondsLeft === null) return;

        if (secondsLeft <= 0) {
            setSecondsLeft(null);
            // Clear the error message once the countdown hits zero
            setError('empID', '');
            return;
        }

        const timer = setTimeout(() => {
            setSecondsLeft(prev => prev - 1);
            // Update the displayed message dynamically
            setError('empID', `Too many login attempts. Please try again in ${secondsLeft - 1} seconds.`);
        }, 1000);

        return () => clearTimeout(timer);
    }, [secondsLeft]);
    const submit = (e) => {
        e.preventDefault();


        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <GuestLayout>
            <Head title="Log in" />

            {/* Header Branding Section */}
            <div className="mb-8 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
                    Welcome Back
                </h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                    Sign in to access your employee portal
                </p>
            </div>

            {status && (
                <div className="mb-6 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-xl text-sm font-medium text-green-600 dark:text-green-400 backdrop-blur-sm">
                    {status}
                </div>
            )}

            <form onSubmit={submit} className="space-y-5">
                {/* Employee ID Input */}
                <div className="space-y-1.5">
                    <InputLabel htmlFor="empID" value="Employee ID" className="text-xs uppercase font-semibold tracking-wider text-gray-500 dark:text-zinc-400" />
                    <div className="relative group">
                        <TextInput
                            id="empID"
                            type="text"
                            inputMode="numeric"
                            name="empID"
                            value={data.empID}
                            className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm placeholder-gray-400"
                            placeholder="Enter your ID number"
                            autoComplete="empID"
                            isFocused={true}
                            pattern="[0-9]*"
                            onChange={(e) => setData('empID', e.target.value)}
                        />
                    </div>
                    <InputError message={errors.empID} className="mt-1 text-xs" />
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <InputLabel htmlFor="password" value="Password" className="text-xs uppercase font-semibold tracking-wider text-gray-500 dark:text-zinc-400" />
                        {/*{canResetPassword && (*/}
                        {/*    <Link*/}
                        {/*        href={route('password.request')}*/}
                        {/*        className="text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-none"*/}
                        {/*    >*/}
                        {/*        Forgot password?*/}
                        {/*    </Link>*/}
                        {/*)}*/}
                    </div>
                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="mt-1 block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 transition-all duration-200 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm placeholder-gray-400"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        onChange={(e) => setData('password', e.target.value)}
                    />
                    <InputError message={errors.password} className="mt-1 text-xs" />
                </div>

                {/* Remember Me Box */}
                <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center group cursor-pointer select-none">
                        <Checkbox
                            name="remember"
                            checked={data.remember}
                            className="rounded-md border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 dark:bg-zinc-900 dark:border-zinc-700"
                            onChange={(e) => setData('remember', e.target.checked)}
                        />
                        <span className="ms-2 text-sm text-gray-600 dark:text-zinc-400 group-hover:text-gray-900 dark:group-hover:text-zinc-200 transition-colors">
                            Keep me signed in
                        </span>
                    </label>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                    <PrimaryButton
                        className="w-full h-11 justify-center rounded-xl font-semibold tracking-wide bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all duration-150"
                        disabled={processing}
                    >
                        {processing ? 'Signing in...' : 'Sign In'}
                    </PrimaryButton>
                </div>
            </form>

            {/* Separator Line */}
            {canRegister && (
                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-200/60 dark:border-zinc-800" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase font-medium tracking-widest">
                        <span className="bg-gray-50 dark:bg-zinc-950 px-3 text-gray-400 dark:text-zinc-500">
                            New Account
                        </span>
                    </div>
                </div>
            )}

            {/* Bottom Register Action */}
            {canRegister && (
                <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                        Need access?{' '}
                        <Link
                            href={route('register')}
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 underline underline-offset-4 decoration-2 transition-colors focus:outline-none"
                        >
                            Create employee account
                        </Link>
                    </p>
                </div>
            )}

            {/* Dynamic Framework Version Details */}
            {laravelVersion && phpVersion && (
                <footer className="mt-8 pt-4 border-t border-gray-100 dark:border-zinc-900 text-center text-[10px] font-mono tracking-wider text-gray-400 dark:text-zinc-600">
                    Laravel v{laravelVersion} • PHP v{phpVersion}
                </footer>
            )}
        </GuestLayout>
    );
}

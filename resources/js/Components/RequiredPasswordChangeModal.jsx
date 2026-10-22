import { useState } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';

/**
 * Shown on every page while the signed-in user still has the shared default
 * password. It can't be dismissed: the only ways out are choosing a new
 * password or signing out. The server blocks changes in the meantime too.
 */
export default function RequiredPasswordChangeModal() {
    const { mustChangePassword, auth } = usePage().props;
    const [visible, setVisible] = useState(false);
    const { data, setData, put, processing, errors, reset } = useForm({
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        put(route('password.first-change'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <Modal show={Boolean(mustChangePassword)} closeable={false} maxWidth="md">
            <form onSubmit={submit} className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Set up a new password</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Welcome{auth?.user?.emp_fname ? `, ${auth.user.emp_fname}` : ''}. You signed in with the default
                    password, so choose your own before you continue. Use at least 8 characters.
                </p>

                <div className="mt-5 space-y-4">
                    <div>
                        <InputLabel htmlFor="required-new-password" value="New password" />
                        <div className="mt-1 flex gap-2">
                            <TextInput
                                id="required-new-password"
                                type={visible ? 'text' : 'password'}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                autoComplete="new-password"
                                className="block w-full"
                                isFocused
                            />
                            <button
                                type="button"
                                onClick={() => setVisible((v) => !v)}
                                className="shrink-0 rounded-md border border-gray-300 px-3 text-xs font-semibold uppercase tracking-widest text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                                {visible ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="required-new-password-confirmation" value="Type it again" />
                        <TextInput
                            id="required-new-password-confirmation"
                            type={visible ? 'text' : 'password'}
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            autoComplete="new-password"
                            className="mt-1 block w-full"
                        />
                        <InputError message={errors.password_confirmation} className="mt-2" />
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="text-sm text-gray-600 underline hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        Sign out instead
                    </Link>
                    <PrimaryButton disabled={processing || !data.password || !data.password_confirmation}>
                        {processing ? 'Saving…' : 'Save new password'}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

import { useEffect, useState } from 'react';
import { useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';

// No look-alikes (0/O, 1/l/I), so a password read aloud or copied by hand survives.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';

function generatePassword(length = 14) {
    const values = crypto.getRandomValues(new Uint32Array(length));
    return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join('');
}

/**
 * Lets an admin set a new password for another user. `user` needs
 * { id, emp_id, name }; pass null to close.
 */
export default function SetPasswordModal({ user, onClose, defaultPassword = null }) {
    const [visible, setVisible] = useState(false);
    const [copied, setCopied] = useState(false);
    const { data, setData, put, processing, errors, reset, clearErrors } = useForm({
        password: '',
        password_confirmation: '',
        sign_out: true,
    });

    // Start clean each time the dialog opens for a user.
    useEffect(() => {
        if (user) {
            reset();
            clearErrors();
            setVisible(false);
            setCopied(false);
        }
    }, [user?.id]);

    const close = () => {
        if (processing) return;
        reset();
        onClose();
    };

    const generate = () => {
        const password = generatePassword();
        setData((prev) => ({ ...prev, password, password_confirmation: password }));
        setVisible(true);
        setCopied(false);
    };

    const useDefault = () => {
        setData((prev) => ({ ...prev, password: defaultPassword, password_confirmation: defaultPassword }));
        setVisible(true);
        setCopied(false);
    };

    const isDefault = Boolean(defaultPassword) && data.password === defaultPassword;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(data.password);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    const submit = (e) => {
        e.preventDefault();
        put(route('users.password', user.id), {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <Modal show={user !== null} onClose={close} maxWidth="md">
            <form onSubmit={submit} className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Set a new password
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    For {user?.name} (employee {user?.emp_id}). Their current password stops working right away.
                    Give them the new one in person or through a channel only they can read.
                </p>

                <div className="mt-5 space-y-4">
                    <div>
                        <div className="flex items-center justify-between">
                            <InputLabel htmlFor="new-password" value="New password" />
                            <button
                                type="button"
                                onClick={generate}
                                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                                Generate a strong password
                            </button>
                        </div>
                        <div className="mt-1 flex gap-2">
                            <TextInput
                                id="new-password"
                                type={visible ? 'text' : 'password'}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                autoComplete="new-password"
                                className="block w-full font-mono"
                                isFocused
                            />
                            <SecondaryButton type="button" onClick={() => setVisible((v) => !v)}>
                                {visible ? 'Hide' : 'Show'}
                            </SecondaryButton>
                        </div>
                        {visible && data.password && (
                            <button
                                type="button"
                                onClick={copy}
                                className="mt-1 text-xs font-medium text-gray-600 hover:underline dark:text-gray-300"
                            >
                                {copied ? 'Copied' : 'Copy password'}
                            </button>
                        )}
                        <InputError message={errors.password} className="mt-2" />
                        {defaultPassword && (
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                {isDefault ? (
                                    'This is the default password. They will be asked to choose their own the next time they sign in.'
                                ) : (
                                    <>
                                        Or{' '}
                                        <button
                                            type="button"
                                            onClick={useDefault}
                                            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                        >
                                            reset to the default password
                                        </button>
                                        , which they must change at their next sign-in.
                                    </>
                                )}
                            </p>
                        )}
                    </div>

                    <div>
                        <InputLabel htmlFor="new-password-confirmation" value="Type it again" />
                        <TextInput
                            id="new-password-confirmation"
                            type={visible ? 'text' : 'password'}
                            value={data.password_confirmation}
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            autoComplete="new-password"
                            className="mt-1 block w-full font-mono"
                        />
                        <InputError message={errors.password_confirmation} className="mt-2" />
                    </div>

                    <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={data.sign_out}
                            onChange={(e) => setData('sign_out', e.target.checked)}
                            className="mt-0.5 rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                        />
                        <span>
                            Sign them out on every device
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                                Recommended if the account may have been used by someone else.
                            </span>
                        </span>
                    </label>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton type="button" onClick={close} disabled={processing}>
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton disabled={processing || !data.password || !data.password_confirmation}>
                        {processing ? 'Saving…' : 'Set password'}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

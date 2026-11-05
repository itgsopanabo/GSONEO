import { useEffect } from 'react';
import { useForm } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

/**
 * Lets an admin issue another user a new one-time password. The server makes
 * it; TemporaryPasswordModal shows it once. `user` needs { id, emp_id, name };
 * pass null to close.
 */
export default function SetPasswordModal({ user, onClose }) {
    const { data, setData, put, processing, reset } = useForm({
        sign_out: true,
    });

    // Start clean each time the dialog opens for a user.
    useEffect(() => {
        if (user) {
            reset();
        }
    }, [user?.id]);

    const close = () => {
        if (processing) return;
        reset();
        onClose();
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
                    Issue a one-time password
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    For {user?.name} (employee {user?.emp_id}). Their current password stops working right away. You
                    see the new one once, on the next screen. They must choose their own at first sign-in.
                </p>

                <label className="mt-5 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
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

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton type="button" onClick={close} disabled={processing}>
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton disabled={processing}>
                        {processing ? 'Issuing…' : 'Issue password'}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

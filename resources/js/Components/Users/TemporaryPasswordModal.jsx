import { useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { formatDateTime } from '@/Utils/formatDate.js';

/**
 * Shows a one-time password right after an admin issues it. The server sends
 * it once, in the flash; after this dialog closes nobody can see it again, so
 * it only closes from its own button.
 */
export default function TemporaryPasswordModal() {
    const issued = usePage().props.flash?.temporary_password;
    const [shown, setShown] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (issued) {
            setShown(issued);
            setCopied(false);
        }
    }, [issued]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(shown.password);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <Modal show={shown !== null} closeable={false} maxWidth="md">
            {shown && (
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">One-time password</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        For {shown.name} (employee {shown.emp_id}). Give it to them in person or through a channel
                        only they can read. It is shown only this once.
                    </p>

                    <div className="mt-5 flex items-center gap-2">
                        <code className="block w-full select-all rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-center font-mono text-lg tracking-wider text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                            {shown.password}
                        </code>
                        <SecondaryButton type="button" onClick={copy}>
                            {copied ? 'Copied' : 'Copy'}
                        </SecondaryButton>
                    </div>

                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        They must choose their own password at first sign-in. If they don't sign in by{' '}
                        {formatDateTime(shown.expires_at)}, it stops working and you issue a new one.
                    </p>

                    <div className="mt-6 flex justify-end">
                        <PrimaryButton type="button" onClick={() => setShown(null)}>
                            Done
                        </PrimaryButton>
                    </div>
                </div>
            )}
        </Modal>
    );
}

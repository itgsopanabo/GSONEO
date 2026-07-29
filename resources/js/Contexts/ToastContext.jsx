import { createContext, useContext, useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const { flash } = usePage().props;

    // Show banner when a backend session flash arrives
    useEffect(() => {
        if (flash?.success) {
            showToast(flash.success, 'success');
        } else if (flash?.error) {
            showToast(flash.error, 'error');
        }
    }, [flash]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
            setToast(null);
        }, 4000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Floating Toast Banner */}
            {toast && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-slide-down">
                    <div className={`p-4 rounded-xl border shadow-lg flex items-center justify-between gap-3 transition-all ${
                        toast.type === 'error'
                            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-900/60 dark:text-red-400'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-400'
                    }`}>
                        <div className="flex items-center gap-2">
                            {/* Checkmark or Warning Icon */}
                            {toast.type === 'error' ? (
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                            <p className="text-xs font-semibold tracking-wide">{toast.message}</p>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setToast(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);

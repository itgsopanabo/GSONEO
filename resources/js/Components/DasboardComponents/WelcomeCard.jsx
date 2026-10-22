import { useEffect, useState } from 'react';
import { CalendarDays, IdCard } from 'lucide-react';
import { formatDate } from '@/Utils/formatDate.js';

function greetingFor(hour) {
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

/**
 * The top of everyone's dashboard: who is signed in, their role, and the date
 * and time — the clock used to be a card of its own beside this one.
 */
export default function WelcomeCard({ auth }) {
    const user = auth?.user;
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!user) return null;

    const role = user.role?.role_name ?? 'No role assigned';
    const section = user.role?.section;
    const firstName = user.emp_fname || user.emp_lname || 'there';
    const initials = [user.emp_fname, user.emp_lname].filter(Boolean).map((part) => part[0]).join('').toUpperCase();

    return (
        <section className="overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-white shadow-sm dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-gray-800 dark:to-gray-800">
            <div className="flex flex-col gap-5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                    <span
                        aria-hidden="true"
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-base font-semibold text-white shadow-sm"
                    >
                        {initials || '?'}
                    </span>
                    <div className="min-w-0">
                        <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                            {greetingFor(now.getHours())}, {firstName}
                        </h1>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30">
                                {role}{section ? ` · ${section}` : ''}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <IdCard className="h-3.5 w-3.5" />
                                Employee ID {user.emp_id}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="sm:text-right">
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-gray-900 dark:text-white" aria-live="off">
                        {now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {now.toLocaleDateString('en-PH', { weekday: 'long' })}, {formatDate(now)}
                    </p>
                </div>
            </div>
        </section>
    );
}

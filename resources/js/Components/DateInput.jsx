import {CalendarDays} from "lucide-react";
import {formatDate, toDateInputValue} from "@/Utils/formatDate.js";

/**
 * A date field that shows its value as "Sept. 12, 2026".
 *
 * A native date input always renders in the browser's locale (09/12/2026), so
 * the real input sits invisibly on top of a formatted label: clicking anywhere
 * still opens the browser's calendar, and `onChange` receives the usual
 * "YYYY-MM-DD" value.
 */
export default function DateInput({value, onChange, placeholder = 'Select a date', className = '', disabled = false, ...props}) {
    const label = formatDate(value, '');

    return (
        <div className={`relative rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 ${className}`}>
            <div
                aria-hidden="true"
                className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-600 ${
                    disabled ? 'bg-gray-100 dark:bg-gray-800' : 'bg-white dark:bg-gray-700'
                }`}
            >
                <span className={label && !disabled ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
                    {label || placeholder}
                </span>
                <CalendarDays className="h-4 w-4 shrink-0 text-gray-400"/>
            </div>
            <input
                {...props}
                type="date"
                value={toDateInputValue(value)}
                onChange={onChange}
                disabled={disabled}
                onClick={(e) => {
                    // Not every browser supports showPicker, and it throws outside a user gesture.
                    try {
                        e.currentTarget.showPicker?.();
                    } catch {
                        // The browser's own click handling still applies.
                    }
                }}
                className={`absolute inset-0 h-full w-full opacity-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            />
        </div>
    );
}

import { getStatusConfig } from '@/Constants/statusConfig.js';
import { formatDateTime, parseDate } from '@/Utils/formatDate.js';

/** Pieces shared by the user list and a user's profile. */

export function initialsOf(fname, lname) {
    return [fname, lname].filter(Boolean).map((part) => part[0]).join('').toUpperCase() || '?';
}

/** "Just now", "12 min ago", "3 h ago", "Yesterday", "5 days ago", or the date. */
export function lastSeen(value) {
    const date = parseDate(value);
    if (!date) return null;
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return formatDateTime(value);
}

/** An account status (900 Active, 901 Inactive, 902 Locked) in the app's status colours. */
export function StatusBadge({ code, label }) {
    const config = getStatusConfig(Number(code));
    return (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.style}`}>
            <span className="h-1 w-1 rounded-full bg-current" />
            {label || config.label}
        </span>
    );
}

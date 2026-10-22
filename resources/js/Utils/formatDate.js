// Month abbreviations in the "Sept. 12, 2026" style. May, June and July are
// short enough to spell out.
const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/**
 * Parses a date string or Date into a local Date.
 *
 * Date-only strings ("2026-09-12", or "2026-09" for a month) are read as local dates — `new Date()` would
 * treat them as UTC midnight, which lands on the previous day west of UTC.
 * MySQL-style "2026-09-12 14:30:00" gets a "T" so every browser can parse it.
 */
export function parseDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    const text = String(value);
    const dateOnly = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(text);
    const date = dateOnly
        ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3] ?? 1))
        : new Date(text.replace(/^(\d{4}-\d{2}-\d{2}) (\d)/, '$1T$2'));

    return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats a date as "Sept. 12, 2026". Returns `fallback` for empty or invalid input. */
export function formatDate(value, fallback = '—') {
    const date = parseDate(value);
    if (!date) return fallback;
    return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Formats a date without the year, as "Sept. 12". */
export function formatMonthDay(value, fallback = '—') {
    const date = parseDate(value);
    if (!date) return fallback;
    return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** Formats a month as "Sept. 2026", or just "Sept." with `{year: false}`. Accepts "2026-09". */
export function formatMonth(value, {year = true} = {}, fallback = '—') {
    const date = parseDate(value);
    if (!date) return fallback;
    return year ? `${MONTHS[date.getMonth()]} ${date.getFullYear()}` : MONTHS[date.getMonth()];
}

/** Formats a time as "3:45 PM". Pass `{seconds: true}` for "3:45:09 PM". */
export function formatTime(value, {seconds = false} = {}, fallback = '') {
    const date = parseDate(value);
    if (!date) return fallback;
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', ...(seconds ? {second: '2-digit'} : {}),
    });
}

/**
 * Formats a timestamp as "Sept. 12, 2026, 3:45 PM".
 *
 * With `{dateOnlyAtMidnight: true}`, values at exactly midnight drop the time —
 * useful for columns that mix dates and timestamps.
 */
export function formatDateTime(value, {seconds = false, dateOnlyAtMidnight = false} = {}, fallback = '—') {
    const date = parseDate(value);
    if (!date) return fallback;
    const midnight = date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
    if (dateOnlyAtMidnight && midnight) return formatDate(date);
    return `${formatDate(date)}, ${formatTime(date, {seconds})}`;
}

/** Converts a date string or Date to the "YYYY-MM-DD" value a date input expects. */
export function toDateInputValue(value) {
    const date = parseDate(value);
    if (!date) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

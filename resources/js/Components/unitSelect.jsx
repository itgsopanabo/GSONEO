import { UNIT_GROUPS, DEFAULT_UNIT, unitGroupOf } from '@/Constants/units.js';

const OTHER = '__other__';

/**
 * Unit picker for a single line item. Groups the common units so the encoder
 * scans one short list, and keeps a text field for anything the list doesn't
 * cover — units off a scanned form are unpredictable and losing one silently
 * is worse than showing an unfamiliar word.
 */
export default function UnitSelect({ value, onChange, className = '', id }) {
    const current = String(value ?? '').trim();
    const known = current !== '' && unitGroupOf(current) !== null;
    const isOther = current !== '' && !known;

    const base =
        'w-full text-xs rounded-md border-gray-200 dark:border-gray-700 ' +
        'dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500';

    const handleSelect = (e) => {
        const picked = e.target.value;
        // Switching to "Other" clears the field so the text input starts empty
        // rather than inheriting a unit the encoder just rejected.
        onChange(picked === OTHER ? '' : picked);
    };

    return (
        <div className="space-y-1">
            <select
                id={id}
                value={isOther ? OTHER : current}
                onChange={handleSelect}
                className={`${base} ${className}`}
            >
                <option value="">{DEFAULT_UNIT}</option>

                {UNIT_GROUPS.map(group => (
                    <optgroup key={group.label} label={group.label}>
                        {group.units.map(unit => (
                            <option key={`${group.label}-${unit}`} value={unit}>
                                {unit}
                            </option>
                        ))}
                    </optgroup>
                ))}

                <option value={OTHER}>Other…</option>
            </select>

            {isOther && (
                <input
                    type="text"
                    value={current}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Type the unit"
                    aria-label="Unit"
                    autoFocus
                    className={`${base} ${className}`}
                />
            )}
        </div>
    );
}

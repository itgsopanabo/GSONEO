import { useEffect, useState } from 'react';
import { PenLine } from 'lucide-react';

/**
 * Which signer set a request's document prints with, saved on the request as
 * soon as it changes. "Automatic" follows the requesting office's set, or the
 * default (App\Services\Signatories).
 *
 * document: purchase_request | canvass_form | iar | ssmi
 */
export default function SignerSetPicker({ document, prNumber, className = '' }) {
    const [state, setState] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!prNumber) return undefined;
        let cancelled = false;
        setState(null);
        setError(null);

        window.axios
            .get(route('signatory-choice.show', { document, pr_number: prNumber }))
            .then(({ data }) => !cancelled && setState(data))
            .catch(() => !cancelled && setError('Signers unavailable'));

        return () => {
            cancelled = true;
        };
    }, [document, prNumber]);

    if (!prNumber || error) {
        return error ? <span className={`text-[11px] text-gray-400 ${className}`}>{error}</span> : null;
    }

    const change = (value) => {
        setSaving(true);
        setError(null);
        window.axios
            .put(route('signatory-choice.update', { document }), { pr_number: prNumber, set_id: value === '' ? null : Number(value) })
            .then(({ data }) => setState(data))
            .catch(() => setError('Could not save the signers'))
            .finally(() => setSaving(false));
    };

    const chosen = state?.sets.find((s) => s.id === state.chosen);
    const printing = chosen ?? state?.sets.find((s) => s.id === state?.automatic?.id);
    const names = printing?.signers?.join(', ');

    return (
        <label
            className={`inline-flex items-center gap-1.5 rounded-full border border-gray-200 py-0.5 pl-2.5 pr-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300 ${className}`}
            title={names ? `Signed by: ${names}` : 'Who signs the printed document'}
        >
            <PenLine className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span className="font-medium">Signers</span>
            <select
                value={state?.chosen ?? ''}
                disabled={!state || saving}
                onChange={(e) => change(e.target.value)}
                className="max-w-[12rem] truncate rounded-full border-0 bg-gray-50 py-0.5 pl-2 pr-7 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 dark:bg-gray-900 dark:text-gray-100"
            >
                {!state ? (
                    <option value="">Loading…</option>
                ) : (
                    <>
                        <option value="">Automatic ({state.automatic.name})</option>
                        {state.sets.map((set) => (
                            <option key={set.id} value={set.id}>
                                {set.name}
                            </option>
                        ))}
                    </>
                )}
            </select>
        </label>
    );
}

import { useMemo, useState } from 'react'
import { useForm } from '@inertiajs/react'
import Modal from '@/Components/Modal'
import InputLabel from '@/Components/InputLabel'
import TextInput from '@/Components/TextInput'
import InputError from '@/Components/InputError'
import PrimaryButton from '@/Components/PrimaryButton'
import SecondaryButton from '@/Components/SecondaryButton'

const MAX_DESC = 1000
const MAX_ROWS = 1000

const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
})

/**
 * Splits one pasted line into fields, preferring the delimiter that is
 * least likely to appear inside an item description.
 *
 * Tab wins because that is what a spreadsheet paste produces.
 */
function splitLine(line) {
    if (line.includes('\t')) return { parts: line.split('\t'), sep: '\t' }
    if (line.includes('|')) return { parts: line.split('|'), sep: '|' }
    return { parts: line.split(','), sep: ',' }
}

/** Accepts 1250, 1,250.00, ₱1,250 and P 1250. Returns null when it isn't a number. */
function toPrice(value) {
    if (value === null || value === undefined) return null
    const cleaned = String(value).replace(/[₱P$,\s]/gi, '')
    if (cleaned === '') return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
}

/**
 * Parses one line into { item_desc, item_unit, item_price } plus a problem
 * string when the row can't be imported.
 *
 * Column order is description, unit, price. The price is read off the end of
 * the line, so commas inside a description survive as long as a numeric price
 * follows them.
 */
function parseLine(line, defaults) {
    const { parts, sep } = splitLine(line)
    const trimmed = parts.map((p) => p.trim())

    let desc = ''
    let unit = defaults.unit
    let price = toPrice(defaults.price)

    if (trimmed.length === 1) {
        desc = trimmed[0]
    } else {
        const tailPrice = toPrice(trimmed[trimmed.length - 1])

        if (tailPrice === null) {
            // No price at the end — treat the whole line as the description.
            desc = trimmed.join(sep === '\t' ? ' ' : `${sep} `)
        } else {
            price = tailPrice

            if (trimmed.length >= 3) {
                unit = trimmed[trimmed.length - 2]
                desc = trimmed.slice(0, -2).join(sep === '\t' ? ' ' : `${sep} `)
            } else {
                desc = trimmed[0]
            }
        }
    }

    const row = {
        item_desc: desc,
        item_unit: unit?.trim() ? unit.trim() : null,
        item_price: price,
    }

    let problem = null
    if (!desc) problem = 'No description'
    else if (desc.length > MAX_DESC) problem = `Description is ${desc.length} characters, limit is ${MAX_DESC}`
    else if (price === null) problem = 'No price on this line, and no default price set'
    else if (price < 0) problem = 'Price is negative'

    return { ...row, problem }
}

export default function BulkPasteItems({ show, onClose }) {
    const [text, setText] = useState('')
    const [defaultUnit, setDefaultUnit] = useState('')
    const [defaultPrice, setDefaultPrice] = useState('')

    const { transform, post, processing, errors, reset, clearErrors } = useForm({
        rows: [],
    })

    // Re-parses on every keystroke so you see what the app made of the paste
    // before committing 200 rows.
    const parsed = useMemo(() => {
        const seen = new Set()

        return text
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => {
                const row = parseLine(line, { unit: defaultUnit, price: defaultPrice })
                const key = row.item_desc.toLowerCase()

                if (!row.problem && seen.has(key)) {
                    return { ...row, problem: 'Repeated earlier in this paste' }
                }
                if (!row.problem) seen.add(key)

                return row
            })
    }, [text, defaultUnit, defaultPrice])

    const ready = parsed.filter((r) => !r.problem)
    const rejected = parsed.filter((r) => r.problem)
    const overLimit = ready.length > MAX_ROWS

    const close = () => {
        setText('')
        setDefaultUnit('')
        setDefaultPrice('')
        reset()
        clearErrors()
        onClose()
    }

    const submit = (e) => {
        e.preventDefault()
        if (!ready.length || overLimit) return

        // setData wouldn't have landed yet by the time post() reads the form,
        // so transform supplies the payload at request time instead.
        transform(() => ({
            rows: ready.map(({ problem, ...row }) => row),
        }))

        post(route('items.bulk'), {
            preserveScroll: true,
            preserveState: true,
            onSuccess: close,
        })
    }

    return (
        <Modal show={show} onClose={close} maxWidth="2xl">
            <form onSubmit={submit} className="p-6">
                <h2 className="text-lg font-semibold text-gray-900">
                    Paste a list of items
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                    One item per line, in the order description, unit, price. Copying
                    three columns straight out of a spreadsheet works as-is.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                        <InputLabel htmlFor="bulk_unit" value="Default unit" />
                        <TextInput
                            id="bulk_unit"
                            value={defaultUnit}
                            onChange={(e) => setDefaultUnit(e.target.value)}
                            className="mt-1 block w-full"
                            placeholder="pc, box, ream…"
                        />
                        <p className="mt-1 text-xs text-gray-500">Used for lines with no unit.</p>
                    </div>

                    <div>
                        <InputLabel htmlFor="bulk_price" value="Default price" />
                        <TextInput
                            id="bulk_price"
                            inputMode="decimal"
                            value={defaultPrice}
                            onChange={(e) => setDefaultPrice(e.target.value)}
                            className="mt-1 block w-full"
                            placeholder="0.00"
                        />
                        <p className="mt-1 text-xs text-gray-500">Used for lines with no price.</p>
                    </div>
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="bulk_text" value="Items" />
                    <textarea
                        id="bulk_text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={8}
                        autoFocus
                        spellCheck={false}
                        placeholder={
                            'Bond paper A4 substance 20\tream\t250\n' +
                            'Ballpen, black, 0.5mm\tbox\t180\n' +
                            'Stapler heavy duty\tpc\t450'
                        }
                        className="mt-1 block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-gray-900 focus:ring-gray-900"
                    />
                    {/* Row-level failures come back keyed rows.3.item_price, so fall
                        back to whatever the first error is. */}
                    <InputError
                        message={errors.rows ?? Object.values(errors)[0]}
                        className="mt-2"
                    />
                </div>

                {parsed.length > 0 && (
                    <div className="mt-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700">
                                {ready.length} ready
                                {rejected.length > 0 && (
                                    <span className="text-gray-500">
                                        {' '}· {rejected.length} skipped
                                    </span>
                                )}
                            </span>
                            {overLimit && (
                                <span className="text-red-600">
                                    Import is capped at {MAX_ROWS} rows
                                </span>
                            )}
                        </div>

                        <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-gray-200">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium">Description</th>
                                    <th className="px-3 py-2 text-left font-medium">Unit</th>
                                    <th className="px-3 py-2 text-right font-medium">Price</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                {parsed.map((row, i) => (
                                    <tr
                                        key={i}
                                        className={
                                            row.problem
                                                ? 'bg-red-50'
                                                : 'bg-white'
                                        }
                                    >
                                        <td className="px-3 py-1.5 text-gray-900">
                                            {row.item_desc || <span className="text-gray-400">—</span>}
                                            {row.problem && (
                                                <span className="block text-xs text-red-600">
                                                        {row.problem}
                                                    </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-1.5 text-gray-600">
                                            {row.item_unit || <span className="text-gray-400">&mdash;</span>}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">
                                            {row.item_price === null ? (
                                                <span className="text-gray-400">&mdash;</span>
                                            ) : (
                                                peso.format(row.item_price)
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        <p className="mt-2 text-xs text-gray-500">
                            Items already on file are skipped on save, so pasting the same
                            list twice won&rsquo;t duplicate anything.
                        </p>
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton type="button" onClick={close}>
                        Cancel
                    </SecondaryButton>
                    <PrimaryButton disabled={processing || !ready.length || overLimit}>
                        {processing
                            ? 'Importing…'
                            : `Import ${ready.length} item${ready.length === 1 ? '' : 's'}`}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    )
}

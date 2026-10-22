import Layout from '@/Layouts/AuthenticatedLayout'
import { Head, Link } from '@inertiajs/react'
import { formatDate } from '@/Utils/formatDate.js'

const ITEM_FIELDS = {
    stockNo: ['stock_no', 'stock_number', 'item_code', 'code', 'product_id'],
    description: ['item_name', 'description', 'item_description', 'particulars', 'name'],
    details: ['item_desc', 'description', 'item_description', 'particulars'],
    unit: ['unit', 'uom', 'unit_of_measure'],
    quantity: ['quantity', 'qty'],
    unitCost: ['estimated_unit_cost', 'bidding_unit_cost', 'unit_cost', 'unit_price', 'price'],
}

const AGENCY_NAME = 'REPLACE WITH YOUR AGENCY NAME'
const FUND_CLUSTER = ''

function pick(source, candidates) {
    if (!source) return null
    for (const key of candidates) {
        if (source[key] !== undefined && source[key] !== null) return source[key]
    }
    return null
}

const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
})

function Field({ label, value, className = '' }) {
    return (
        <div className={className}>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 print:text-black">{label}</div>
            <div className="border-b border-gray-400 pb-0.5 text-sm font-medium">{value ?? '—'}</div>
        </div>
    )
}

function Signature({ role, name, position }) {
    return (
        <div className="pt-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-600 print:text-black">{role}</div>
            <div className="mt-8 border-b border-black" />
            <div className="pt-1 text-sm font-semibold uppercase">{name || '\u00A0'}</div>
            <div className="text-[11px] text-gray-600 print:text-black">{position || '\u00A0'}</div>
        </div>
    )
}

export default function Document({ purchaseOrder }) {
    const po = purchaseOrder ?? {}
    const request = po.purchase_request ?? po.purchaseRequest ?? {}
    const items = request.items ?? []
    const iars = po.i_a_rs ?? po.IARs ?? po.iars ?? []

    const rows = items.map((item, index) => {
        const quantity = Number(pick(item, ITEM_FIELDS.quantity) ?? 0)
        const unitCost = Number(pick(item, ITEM_FIELDS.unitCost) ?? 0)

        return {
            key: item.id ?? index,
            stockNo: pick(item, ITEM_FIELDS.stockNo),
            description: pick(item, ITEM_FIELDS.description),
            details: pick(item, ITEM_FIELDS.details),
            unit: pick(item, ITEM_FIELDS.unit),
            quantity,
            unitCost,
            total: quantity * unitCost,
        }
    })

    const grandTotal = rows.reduce((sum, row) => sum + row.total, 0)

    return (
        <Layout>
            <Head title={po.SSMI_Number ? `SSMI ${po.SSMI_Number}` : 'SSMI document'} />

            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 12mm; }
                    body * { visibility: hidden; }
                    #ssmi-sheet, #ssmi-sheet * { visibility: visible; }
                    #ssmi-sheet {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        border: 0;
                        box-shadow: none;
                        padding: 0;
                    }
                    thead { display: table-header-group; }
                    tr { break-inside: avoid; }
                    .signatures { break-inside: avoid; }
                }
            `}</style>

            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <Link
                        href="/ssmi"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                        Back to SSMI list
                    </Link>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        Print
                    </button>
                </div>

                <article
                    id="ssmi-sheet"
                    className="rounded-lg border border-gray-300 bg-white p-8 shadow-sm print:rounded-none"
                >
                    <header className="text-center">
                        <p className="text-sm uppercase tracking-wide">{AGENCY_NAME}</p>
                        <h1 className="mt-3 text-lg font-bold uppercase tracking-wide">
                            Summary of Supplies and Materials Issued
                        </h1>
                    </header>

                    <div className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                        <Field label="SSMI Number" value={po.SSMI_Number} />
                        <Field label="Date" value={formatDate(po.SSMI_Date)} />
                        <Field label="Purchase Order No." value={po.PO_Number ?? po.po_number ?? `#${po.id ?? ''}`} />
                        <Field label="Purchase Request No." value={po.PR_Number ?? request.pr_number ?? request.id} />
                        <Field label="Supplier" value={po.PO_Supplier ?? po.supplier?.name ?? po.supplier_name} />
                        <Field
                            label="IAR Reference"
                            value={
                                iars.length
                                    ? iars.map((iar) => iar.iar_number ?? `#${iar.id}`).join(', ')
                                    : null
                            }
                        />
                        {FUND_CLUSTER && <Field label="Fund Cluster" value={FUND_CLUSTER} />}
                    </div>

                    <table className="mt-8 w-full border-collapse text-sm">
                        <thead>
                        <tr className="bg-gray-100 print:bg-transparent">
                            <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">
                                Stock No.
                            </th>
                            <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">
                                Item / Description
                            </th>
                            <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">
                                Unit
                            </th>
                            <th className="border border-gray-400 px-2 py-1.5 text-right font-semibold">
                                Qty
                            </th>
                            <th className="border border-gray-400 px-2 py-1.5 text-right font-semibold">
                                Unit Cost
                            </th>
                            <th className="border border-gray-400 px-2 py-1.5 text-right font-semibold">
                                Amount
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="border border-gray-400 px-2 py-6 text-center text-gray-500"
                                >
                                    No items are attached to this purchase request.
                                </td>
                            </tr>
                        )}

                        {rows.map((row) => (
                            <tr key={row.key}>
                                <td className="border border-gray-400 px-2 py-1.5">
                                    {row.stockNo ?? '—'}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5">
                                    {row.description ?? '—'}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5">{row.unit ?? '—'}</td>
                                <td className="border border-gray-400 px-2 py-1.5 text-right tabular-nums">
                                    {row.quantity.toLocaleString()}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-right tabular-nums">
                                    {peso.format(row.unitCost)}
                                </td>
                                <td className="border border-gray-400 px-2 py-1.5 text-right tabular-nums">
                                    {peso.format(row.total)}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                        <tfoot>
                        <tr>
                            <td
                                colSpan={5}
                                className="border border-gray-400 px-2 py-1.5 text-right font-semibold"
                            >
                                Total
                            </td>
                            <td className="border border-gray-400 px-2 py-1.5 text-right font-bold tabular-nums">
                                {peso.format(grandTotal)}
                            </td>
                        </tr>
                        </tfoot>
                    </table>

                    <div className="signatures mt-12 grid gap-8 sm:grid-cols-3">
                        <Signature role="Prepared by" name={po.prepared_by?.name} position="Supply Officer" />
                        <Signature role="Approved by" name={po.approved_by?.name} position="Head of Agency" />
                        <Signature role="Received by" name="" position="" />
                    </div>
                </article>
            </div>
        </Layout>
    )
}

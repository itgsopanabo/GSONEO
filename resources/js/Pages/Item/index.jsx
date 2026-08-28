import { useEffect, useRef, useState } from 'react'
import { Head, Link, router, useForm, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.jsx'
import Modal from '@/Components/Modal'
import InputLabel from '@/Components/InputLabel'
import TextInput from '@/Components/TextInput'
import InputError from '@/Components/InputError'
import PrimaryButton from '@/Components/PrimaryButton'
import SecondaryButton from '@/Components/SecondaryButton'
import BulkPasteItems from "@/Pages/Item/bulkpasteitems.jsx";

const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
})

export default function Index({ items, filters }) {
    const { flash } = usePage().props

    const [search, setSearch] = useState(filters?.search ?? '')
    const [editing, setEditing] = useState(null)   // null = closed | false = creating | object = editing
    const [bulkOpen, setBulkOpen] = useState(false)
    const [confirmingId, setConfirmingId] = useState(null)
    const [deletingId, setDeletingId] = useState(null)
    const isFirstRender = useRef(true)

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        item_desc: '',
        item_unit: '',
        item_price: '',
    })

    const isOpen = editing !== null
    const isEditing = Boolean(editing)

    // Debounced server-side search.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        const timeout = setTimeout(() => {
            router.get(
                route('items.index'),
                search ? { search } : {},
                { preserveState: true, preserveScroll: true, replace: true },
            )
        }, 300)

        return () => clearTimeout(timeout)
    }, [search])

    function openCreate() {
        clearErrors()
        reset()
        setEditing(false)
    }

    function openEdit(item) {
        clearErrors()
        setData({
            item_desc: item.item_desc ?? '',
            item_unit: item.item_unit ?? '',
            item_price: item.item_price ?? '',
        })
        setEditing(item)
    }

    function closeModal() {
        setEditing(null)
        clearErrors()
        reset()
    }

    function submit(e) {
        e.preventDefault()

        const options = {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => closeModal(),
        }

        if (isEditing) {
            put(route('items.update', editing.id), options)
        } else {
            post(route('items.store'), options)
        }
    }

    function destroy(item) {
        setDeletingId(item.id)

        router.delete(route('items.destroy', item.id), {
            preserveScroll: true,
            onFinish: () => {
                setDeletingId(null)
                setConfirmingId(null)
            },
        })
    }

    return (
        <AuthenticatedLayout>
            <Head title="Items" />

            <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Items</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            {items.total} {items.total === 1 ? 'item' : 'items'} on file
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <SecondaryButton type="button" onClick={() => setBulkOpen(true)}>
                            Paste a list
                        </SecondaryButton>

                        <PrimaryButton type="button" onClick={openCreate}>
                            Add item
                        </PrimaryButton>
                    </div>
                </div>

                {flash?.status && (
                    <div
                        role="status"
                        className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                    >
                        {flash.status}
                    </div>
                )}

                {flash?.error && (
                    <div
                        role="alert"
                        className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                        {flash.error}
                    </div>
                )}

                <div className="mt-6">
                    <label htmlFor="search" className="sr-only">
                        Search items
                    </label>
                    <input
                        id="search"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by description or unit"
                        className="w-full max-w-sm rounded-md border-gray-300 text-sm shadow-sm focus:border-gray-900 focus:ring-gray-900"
                    />
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">
                                Description
                            </th>
                            <th scope="col" className="px-4 py-3 text-left font-medium text-gray-600">
                                Unit
                            </th>
                            <th scope="col" className="px-4 py-3 text-right font-medium text-gray-600">
                                Price
                            </th>
                            <th scope="col" className="px-4 py-3 text-right font-medium text-gray-600">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                        {items.data.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-4 py-12 text-center">
                                    {filters?.search ? (
                                        <>
                                            <p className="text-gray-900">
                                                No items match &ldquo;{filters.search}&rdquo;.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => setSearch('')}
                                                className="mt-2 text-sm font-medium text-gray-600 underline hover:text-gray-900"
                                            >
                                                Clear the search
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-gray-900">No items yet.</p>
                                            <p className="mt-2 text-sm text-gray-600">
                                                <button
                                                    type="button"
                                                    onClick={openCreate}
                                                    className="font-medium underline hover:text-gray-900"
                                                >
                                                    Add the first one
                                                </button>
                                                {' or '}
                                                <button
                                                    type="button"
                                                    onClick={() => setBulkOpen(true)}
                                                    className="font-medium underline hover:text-gray-900"
                                                >
                                                    paste a whole list
                                                </button>
                                                .
                                            </p>
                                        </>
                                    )}
                                </td>
                            </tr>
                        )}

                        {items.data.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                    <button
                                        type="button"
                                        onClick={() => openEdit(item)}
                                        className="text-left hover:underline"
                                    >
                                        {item.item_desc}
                                    </button>
                                </td>

                                <td className="px-4 py-3 text-gray-600">
                                    {item.item_unit || <span className="text-gray-400">&mdash;</span>}
                                </td>

                                <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                                    {peso.format(item.item_price)}
                                </td>

                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    {confirmingId === item.id ? (
                                        <span className="inline-flex items-center gap-3">
                                                <span className="text-gray-600">Delete this item?</span>
                                                <button
                                                    type="button"
                                                    onClick={() => destroy(item)}
                                                    disabled={deletingId === item.id}
                                                    className="font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                                                >
                                                    {deletingId === item.id ? 'Deleting…' : 'Yes, delete'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingId(null)}
                                                    className="text-gray-500 hover:text-gray-900"
                                                >
                                                    Cancel
                                                </button>
                                            </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(item)}
                                                    className="font-medium text-gray-600 hover:text-gray-900"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingId(item.id)}
                                                    className="font-medium text-red-600 hover:text-red-800"
                                                >
                                                    Delete
                                                </button>
                                            </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {items.last_page > 1 && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-gray-500">
                            Showing {items.from}&ndash;{items.to} of {items.total}
                        </p>

                        <nav aria-label="Pagination" className="flex flex-wrap gap-1">
                            {items.links.map((link, i) =>
                                link.url ? (
                                    <Link
                                        key={i}
                                        href={link.url}
                                        preserveScroll
                                        aria-current={link.active ? 'page' : undefined}
                                        className={`rounded px-3 py-1.5 text-sm ${
                                            link.active
                                                ? 'bg-gray-900 text-white'
                                                : 'text-gray-600 hover:bg-gray-100'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ) : (
                                    <span
                                        key={i}
                                        className="rounded px-3 py-1.5 text-sm text-gray-300"
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ),
                            )}
                        </nav>
                    </div>
                )}
            </div>

            {/* ---------- CREATE / EDIT MODAL ---------- */}
            <Modal show={isOpen} onClose={closeModal} maxWidth="lg">
                <form onSubmit={submit} className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {isEditing ? 'Edit item' : 'Add item'}
                    </h2>

                    <div className="mt-6 space-y-4">
                        <div>
                            <InputLabel htmlFor="item_desc" value="Description" />
                            <TextInput
                                id="item_desc"
                                value={data.item_desc}
                                onChange={(e) => setData('item_desc', e.target.value)}
                                className="mt-1 block w-full"
                                maxLength={64}
                                isFocused
                                required
                            />
                            <InputError message={errors.item_desc} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="item_unit" value="Unit" />
                            <TextInput
                                id="item_unit"
                                value={data.item_unit}
                                onChange={(e) => setData('item_unit', e.target.value)}
                                className="mt-1 block w-full"
                                placeholder="pc, box, ream…"
                            />
                            <InputError message={errors.item_unit} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="item_price" value="Price" />
                            <TextInput
                                id="item_price"
                                type="number"
                                step="0.01"
                                min="0"
                                inputMode="decimal"
                                value={data.item_price}
                                onChange={(e) => setData('item_price', e.target.value)}
                                className="mt-1 block w-full"
                                required
                            />
                            <InputError message={errors.item_price} className="mt-2" />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton type="button" onClick={closeModal} disabled={processing}>
                            Cancel
                        </SecondaryButton>

                        <PrimaryButton disabled={processing}>
                            {processing ? 'Saving…' : isEditing ? 'Save changes' : 'Add item'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* ---------- BULK PASTE MODAL ---------- */}
            <BulkPasteItems show={bulkOpen} onClose={() => setBulkOpen(false)} />
        </AuthenticatedLayout>
    )
}

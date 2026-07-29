import { Head, useForm, Link } from '@inertiajs/react';
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout.jsx";

// Notice 'departments' is now passed in as a prop from Laravel
export default function Create({ departments = [] }) {
    const { data, setData, post, processing, errors } = useForm({
        requester_name: '',
        requester_department: '',
        needed_by_date: '',
        remarks_or_notes: '',
        items: [
            { item_name: '', description: '', quantity: 1, unit: 'pcs', estimated_unit_price: 0 }
        ]
    });

    // Handle adding a new item row
    const addItemRow = () => {
        setData('items', [
            ...data.items,
            { item_name: '', description: '', quantity: 1, unit: 'pcs', estimated_unit_price: 0 }
        ]);
    };

    // Handle removing an item row
    const removeItemRow = (index) => {
        if (data.items.length > 1) {
            const updatedItems = data.items.filter((_, i) => i !== index);
            setData('items', updatedItems);
        }
    };

    // Handle updates to individual item fields
    const handleItemChange = (index, field, value) => {
        const updatedItems = [...data.items];
        updatedItems[index][field] = value;
        setData('items', updatedItems);
    };

    // Calculate dynamic running grand total
    const grandTotal = data.items.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        const price = parseFloat(item.estimated_unit_price) || 0;
        return sum + (qty * price);
    }, 0);

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('purchase-requests.store'));
    };

    return (
        <AuthenticatedLayout>
            <Head title="Create a new request "/>

            <div className="py-6 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight">
                            New Purchase Request
                        </h1>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Fill out the procurement details and add request line items.
                        </p>
                    </div>
                    <Link
                        href={route('purchase-requests.index')}
                        className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Back to List
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Primary Header Details Card */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Requester Name</label>
                            <input
                                type="text"
                                value={data.requester_name}
                                onChange={e => setData('requester_name', e.target.value)}
                                className="w-full text-xs rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
                                placeholder="Full Name"
                            />
                            {errors.requester_name && <p className="mt-1 text-xs text-red-500">{errors.requester_name}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Requester Department</label>
                            <select
                                value={data.requester_department}
                                onChange={e => setData('requester_department', e.target.value)}
                                className="w-full text-xs rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="">Select a department...</option>
                                {/* Now mapping over the 'departments' prop from Laravel */}
                                {departments.map((dept) => (
                                    <option key={dept.code} value={dept.code}>
                                        {dept.Department_Code} - {dept.Department_Name}
                                    </option>
                                ))}
                            </select>
                            {errors.requester_department && <p className="mt-1 text-xs text-red-500">{errors.requester_department}</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Needed By Date</label>
                            <input
                                type="date"
                                value={data.needed_by_date}
                                onChange={e => setData('needed_by_date', e.target.value)}
                                className="w-full text-xs rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
                            />
                            {errors.needed_by_date && <p className="mt-1 text-xs text-red-500">{errors.needed_by_date}</p>}
                        </div>

                        <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks or Notes</label>
                            <textarea
                                value={data.remarks_or_notes}
                                onChange={e => setData('remarks_or_notes', e.target.value)}
                                rows={3}
                                className="w-full text-xs rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
                                placeholder="State core details, purpose, or additional notes here..."
                            />
                            {errors.remarks_or_notes && <p className="mt-1 text-xs text-red-500">{errors.remarks_or_notes}</p>}
                        </div>
                    </div>

                    {/* Dynamic Items Section */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-3">
                            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Requested Line Items</h2>
                            <button
                                type="button"
                                onClick={addItemRow}
                                className="inline-flex items-center text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                            >
                                + Add Item
                            </button>
                        </div>

                        {data.items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700/40 relative">
                                <div className="md:col-span-4">
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Item Name</label>
                                    <input
                                        type="text"
                                        value={item.item_name}
                                        onChange={e => handleItemChange(index, 'item_name', e.target.value)}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        required
                                    />
                                    {errors[`items.${index}.item_name`] && <p className="mt-0.5 text-[11px] text-red-500">Required</p>}
                                </div>

                                <div className="md:col-span-3">
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Description/Specs</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={e => handleItemChange(index, 'description', e.target.value)}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                    />
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        required
                                    />
                                </div>

                                <div className="md:col-span-1">
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Unit</label>
                                    <input
                                        type="text"
                                        value={item.unit}
                                        onChange={e => handleItemChange(index, 'unit', e.target.value)}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        placeholder="pcs"
                                        required
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Est. Unit Price</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={item.estimated_unit_price}
                                        onChange={e => handleItemChange(index, 'estimated_unit_price', parseFloat(e.target.value) || 0)}
                                        className="w-full text-xs rounded-md border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        required
                                    />
                                </div>

                                <div className="md:col-span-1 flex items-center justify-end h-9">
                                    {data.items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItemRow(index)}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Grand Total Bar */}
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estimated Grand Total:</span>
                            <span className="text-base font-bold text-gray-900 dark:text-white">
                                ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Bottom Action Submits */}
                    <div className="flex justify-end gap-3">
                        <Link
                            href={route('purchase-requests.index')}
                            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-4 py-2 text-xs font-semibold tracking-wide text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                        >
                            {processing ? 'Submitting...' : 'Submit Purchase Request'}
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

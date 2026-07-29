export default function MetricCard({
                                       title, value, subValue, // Optional: inline secondary text (e.g., "Feels like 35°C")
                                       description, icon: Icon, trend, action, // Optional: React node/element (e.g., a button or link)
                                       loading = false, valueClassName = "", // Optional: override standard text styling
                                       className = ""
                                   }) {
    return (<div
            className={`overflow-hidden bg-white shadow-sm sm:rounded-lg dark:bg-gray-800 p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-md ${className}`}>
            <div>
                {/* Header Row */}
                <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                        {title}
                    </p>
                    {Icon && (<div className="text-gray-400 dark:text-gray-500">
                            <Icon className="w-6 h-6"/>
                        </div>)}
                </div>

                {/* Value Content Row */}
                <div className="mt-2 flex items-baseline flex-wrap gap-2">
                    {loading ? (<div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"/>) : (
                        <p className={`text-3xl font-bold text-gray-900 dark:text-gray-100 font-mono tracking-tight ${valueClassName}`}>
                            {value}
                        </p>)}

                    {/* Optional Secondary Value Field */}
                    {subValue && !loading && (
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 font-sans">
                            {subValue}
                        </span>)}

                    {/* Optional Status Badge Field */}
                    {trend && !loading && (<span
                            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${trend.type === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400' : trend.type === 'warning' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400' : 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400'}`}>
                            {trend.label}
                        </span>)}
                </div>
            </div>

            {/* Optional Footer Layout */}
            {(description || action) && (<div
                    className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-2 flex items-center justify-between text-sm">
                    <div className="text-gray-500 dark:text-gray-400">
                        {description}
                    </div>
                    {/* Optional Custom Action Element */}
                    {action && (<div
                            className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-medium text-xs">
                            {action}
                        </div>)}
                </div>)}
        </div>);
}

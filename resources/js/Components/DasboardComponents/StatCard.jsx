import MetricCard from '@/Components/MetricCard.jsx';

/**
 * `data` is an array so the backend picks which counters matter for the role:
 *   [{ label: 'Pending PR', value: 12 }, ...]
 * A canvasser and a verifier get different counters without any frontend change.
 */
export default function StatCards({ data = [] }) {
    if (!data.length) return null;

    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {data.map((stat) => (
                <MetricCard
                    key={stat.label}
                    title={stat.label}
                    value={stat.value ?? 0}
                    description={stat.description}
                />
            ))}
        </div>
    );
}

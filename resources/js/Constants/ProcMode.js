export const PROCUREMENT_MODES = [
    { value: 'small_value',      label: 'Small Value Procurement' },
    { value: 'philgeps_rfq',     label: 'PhilGEPS RFQ' },
    { value: 'public_bidding',   label: 'Public Bidding' },
    { value: 'agency_to_agency', label: 'Agency-to-Agency' },
];

export const PROCUREMENT_MODE_LABELS = Object.fromEntries(
    PROCUREMENT_MODES.map(m => [m.value, m.label])
);

export const procurementModeLabel = (value) =>
    PROCUREMENT_MODE_LABELS[value] ?? '—';

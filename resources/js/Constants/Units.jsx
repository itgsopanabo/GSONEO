/**
 * Units of issue used on purchase requests.
 *
 * Grouped by what is actually being counted, so an encoder looking for the
 * unit for bottled water scans one short list instead of forty entries.
 * The groups are a browsing aid, not a restriction — unit fields stay free
 * text so an odd unit off a scanned form still gets through instead of being
 * silently rewritten to something the encoder didn't mean.
 */

export const DEFAULT_UNIT = 'pcs';

export const UNIT_GROUPS = [
    {
        label: 'Count',
        hint: 'Things counted one by one',
        units: ['pcs', 'each', 'unit', 'set', 'pair', 'dozen', 'lot'],
    },
    {
        label: 'Packaging',
        hint: 'Sold by the container it comes in',
        units: ['box', 'pack', 'bag', 'sack', 'bottle', 'can', 'jar', 'tin', 'tube', 'drum', 'carton'],
    },
    {
        label: 'Paper & print',
        units: ['ream', 'pad', 'sheet', 'roll', 'bundle', 'cartridge'],
    },
    {
        label: 'Volume',
        hint: 'Water, fuel, paint, chemicals',
        units: ['ltr', 'ml', 'gal', 'cu.m'],
    },
    {
        label: 'Weight',
        units: ['kg', 'g', 'mg', 'ton'],
    },
    {
        label: 'Length',
        hint: 'Cable, pipe, cloth, lumber',
        units: ['m', 'cm', 'mm', 'ft', 'in'],
    },
    {
        label: 'Area',
        units: ['sq.m', 'sq.ft'],
    },
    {
        label: 'People & service',
        hint: 'Meals, training, hauling, rentals',
        units: ['pax', 'job', 'trip', 'day', 'hour', 'month'],
    },
];

/** Flat list, in group order. Used for the datalist in the paste grid. */
export const UNITS = UNIT_GROUPS.flatMap(group => group.units);

/** The group label a unit belongs to, or null when it came off a scan. */
export function unitGroupOf(unit) {
    const key = String(unit ?? '').trim().toLowerCase();
    const group = UNIT_GROUPS.find(g => g.units.includes(key));
    return group ? group.label : null;
}

/**
 * Variants that turn up in scans, spreadsheets and typing, mapped to the
 * spelling this system stores. Keys are compared lowercased with trailing
 * periods stripped.
 */
const ALIASES = {
    // count
    pc: 'pcs', pce: 'pcs', piece: 'pcs', pieces: 'pcs',
    ea: 'each', units: 'unit', sets: 'set',
    prs: 'pair', pairs: 'pair', doz: 'dozen', dzn: 'dozen', lots: 'lot',
    // packaging
    bx: 'box', bxs: 'box', boxes: 'box',
    pk: 'pack', pkt: 'pack', packet: 'pack', packs: 'pack',
    bags: 'bag', sacks: 'sack',
    btl: 'bottle', bottles: 'bottle', cans: 'can', jars: 'jar', tubes: 'tube',
    ctn: 'carton', cartons: 'carton',
    // paper and print
    rm: 'ream', rms: 'ream', reams: 'ream',
    pads: 'pad', sheets: 'sheet', rolls: 'roll', bundles: 'bundle',
    cart: 'cartridge', ctg: 'cartridge', cartridges: 'cartridge',
    // volume
    l: 'ltr', li: 'ltr', lit: 'ltr', liter: 'ltr', litre: 'ltr',
    liters: 'ltr', litres: 'ltr', lts: 'ltr',
    mls: 'ml', milliliter: 'ml', millilitre: 'ml',
    gallon: 'gal', gallons: 'gal', gals: 'gal',
    cum: 'cu.m', 'cu m': 'cu.m', cbm: 'cu.m',
    // weight
    kilo: 'kg', kilos: 'kg', kgs: 'kg', kilogram: 'kg', kilograms: 'kg',
    gram: 'g', grams: 'g', gm: 'g', gms: 'g',
    tons: 'ton', tonne: 'ton', mt: 'ton',
    // length
    meter: 'm', metre: 'm', meters: 'm', metres: 'm', mtr: 'm', mtrs: 'm',
    centimeter: 'cm', centimetre: 'cm', cms: 'cm',
    millimeter: 'mm', millimetre: 'mm',
    foot: 'ft', feet: 'ft', inch: 'in', inches: 'in',
    // area
    sqm: 'sq.m', 'sq m': 'sq.m', 'sq.mtr': 'sq.m',
    sqft: 'sq.ft', 'sq ft': 'sq.ft',
    // people and service
    person: 'pax', persons: 'pax', head: 'pax', heads: 'pax', paxs: 'pax',
    service: 'job', services: 'job', jobs: 'job', trips: 'trip',
    days: 'day', hr: 'hour', hrs: 'hour', hours: 'hour',
    mo: 'month', mos: 'month', months: 'month',
};

/**
 * Normalizes one unit string. Unknown units are returned trimmed but otherwise
 * untouched, so a real unit this list has never seen survives the round trip.
 * An empty value falls back to DEFAULT_UNIT.
 */
export function normalizeUnit(raw) {
    const trimmed = String(raw ?? '').trim();
    if (trimmed === '') return DEFAULT_UNIT;

    const key = trimmed.toLowerCase().replace(/\.+$/, '');
    if (ALIASES[key]) return ALIASES[key];
    return UNITS.includes(key) ? key : trimmed;
}

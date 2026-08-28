<?php

namespace App\Services;

/**
 * Parses the text of a printed purchase request table.
 *
 * The OCR service returns one of two shapes depending on whether table mode
 * took effect:
 *
 *   Row-major     "144 pax MEALS, 180.00"       — one line per item
 *   Column-major  "144 / 144 / 144 / pax / ..." — every column in turn
 *
 * Row-major is the safer input and is what isTable=true is supposed to give.
 * Column-major is handled as a fallback because the column lengths validate
 * each other: three quantities and three prices mean the particulars must
 * split into three blocks, and if they don't, we know not to trust the result.
 *
 * The one reliable structural fact on these forms is that every item begins
 * with a quantity. That number is the anchor in both modes.
 */
class PrTableParser
{
    private const HEADER_TOKENS = [
        'country of origin', 'country of', 'unit cost', 'particulars',
        'description', 'remarks', 'origin', 'total', 'amount', 'qty',
        'quantity', 'unit', 'cost', 'item', 'no.',
    ];

    private const UNIT_HINTS = [
        'pax', 'pcs', 'pc', 'unit', 'units', 'package', 'pack', 'set', 'sets',
        'lot', 'box', 'boxes', 'ream', 'reams', 'bottle', 'bottles', 'kg', 'pair',
        'roll', 'rolls', 'can', 'cans', 'day', 'days', 'each',
    ];

    private const CONDITION_HINTS = [
        'free venue', 'target date', 'free delivery', 'delivery', 'inclusive',
        'warranty', 'terms', 'schedule of the activity', 'payment',
    ];

    /**
     * @return array{items: array, conditions: array, mode: string, confident: bool}
     */
    public function parse(string $text): array
    {
        $lines = $this->normalize($text);

        return $this->looksColumnMajor($lines)
            ? $this->parseColumnMajor($lines)
            : $this->parseRowMajor($lines);
    }

    // ---------------------------------------------------------------- shared

    private function normalize(string $text): array
    {
        $out = [];

        foreach (preg_split('/\R/', $text) as $raw) {
            $line = trim(preg_replace('/\s+/', ' ', $raw));

            if ($line === '' || preg_match('/^\*{3,}/', $line)) {
                continue;
            }

            $stripped = $this->stripHeaderTokens($line);

            if ($stripped !== '') {
                $out[] = $stripped;
            }
        }

        return $out;
    }

    private function stripHeaderTokens(string $line): string
    {
        foreach (self::HEADER_TOKENS as $token) {
            $line = preg_replace('/\b' . preg_quote($token, '/') . '\b/i', ' ', $line);
        }

        $line = preg_replace('/[|]+/', ' ', $line);
        $line = preg_replace('/^[\s\-–—_]+$/', '', $line);

        return trim(preg_replace('/\s+/', ' ', $line));
    }

    private function isBareNumber(string $line): bool
    {
        return (bool) preg_match('/^\d{1,5}$/', trim($line));
    }

    private function isMoneyOnly(string $line): bool
    {
        return (bool) preg_match('/^[₱P]?\s?\d{1,3}(,\d{3})*(\.\d{2})?$|^[₱P]?\s?\d+\.\d{2}$/', trim($line));
    }

    private function isUnitWord(string $line): bool
    {
        return (bool) preg_match('/^[A-Za-z]{1,12}\.?$/', trim($line));
    }

    /** An item name: uppercase-dominant and not a dash-led spec line. */
    private function isItemHeading(string $line): bool
    {
        if (preg_match('/^\s*[-–—]/', $line)) {
            return false;
        }

        $letters = preg_replace('/[^A-Za-z]/', '', $line);

        return strlen($letters) >= 3 && $letters === strtoupper($letters);
    }

    private function toAmount(string $value): float
    {
        return (float) str_replace([',', '₱', 'P', ' '], '', $value);
    }

    // ------------------------------------------------------- mode detection

    /**
     * Column-major starts with a run of bare numbers followed by a run of unit
     * words. Row-major never has two bare numbers on consecutive lines.
     */
    private function looksColumnMajor(array $lines): bool
    {
        $numbers = 0;

        foreach ($lines as $line) {
            if ($this->isBareNumber($line)) {
                $numbers++;
                continue;
            }
            break;
        }

        if ($numbers < 2) {
            return false;
        }

        return isset($lines[$numbers]) && $this->isUnitWord($lines[$numbers]);
    }

    // ---------------------------------------------------------- column-major

    private function parseColumnMajor(array $lines): array
    {
        $cursor = 0;

        $quantities = [];
        while (isset($lines[$cursor]) && $this->isBareNumber($lines[$cursor])) {
            $quantities[] = (int) $lines[$cursor];
            $cursor++;
        }

        $units = [];
        while (isset($lines[$cursor]) && $this->isUnitWord($lines[$cursor]) && count($units) < count($quantities)) {
            $units[] = strtolower(rtrim($lines[$cursor], '.'));
            $cursor++;
        }

        // Prices sit at the tail. Walk backwards, dropping stray header debris
        // that landed in the cost column (a mangled "COST", a lone letter run).
        $tail = array_slice($lines, $cursor);
        $prices = [];

        for ($i = count($tail) - 1; $i >= 0; $i--) {
            $line = $tail[$i];

            if ($this->isMoneyOnly($line)) {
                array_unshift($prices, $this->toAmount($line));
                array_splice($tail, $i, 1);
                continue;
            }

            if ($prices !== []) {
                if (strlen($line) <= 6 && ! str_contains($line, ' ')) {
                    array_splice($tail, $i, 1);
                    continue;
                }
                break;
            }
        }

        // Whatever is left in the middle is the particulars column.
        $blocks = $this->splitParticulars($tail);
        $confident = $quantities !== [] && count($blocks) === count($quantities);

        $items = [];

        foreach ($blocks as $index => $block) {
            $items[] = [
                'item_name'            => array_shift($block) ?? '',
                'description'          => $block,
                'quantity'             => $quantities[$index] ?? 1,
                'unit'                 => $units[$index] ?? 'pcs',
                'estimated_unit_price' => $prices[$index] ?? 0.0,
            ];
        }

        [$items, $conditions] = $this->extractConditions($items);

        return [
            'items'      => array_map([$this, 'finalizeItem'], $items),
            'conditions' => $conditions,
            'mode'       => 'column',
            'confident'  => $confident,
        ];
    }

    /**
     * Cut the particulars column at each item heading. Anything before the
     * first heading is header debris.
     */
    private function splitParticulars(array $lines): array
    {
        $blocks = [];
        $current = null;

        foreach ($lines as $line) {
            if ($this->isItemHeading($line)) {
                if ($current !== null) {
                    $blocks[] = $current;
                }
                $current = [$line];
                continue;
            }

            if ($current !== null) {
                $current[] = $line;
            }
        }

        if ($current !== null) {
            $blocks[] = $current;
        }

        return $blocks;
    }

    // ------------------------------------------------------------- row-major

    private function parseRowMajor(array $lines): array
    {
        $items = [];
        $current = null;

        foreach ($lines as $line) {
            $anchor = $this->matchAnchor($line);

            if ($anchor !== null) {
                if ($current !== null) {
                    $items[] = $current;
                }

                $current = [
                    'item_name'            => $anchor['name'],
                    'description'          => [],
                    'quantity'             => $anchor['quantity'],
                    'unit'                 => $anchor['unit'],
                    'estimated_unit_price' => $anchor['price'],
                ];

                continue;
            }

            if ($current === null) {
                continue;
            }

            if ($current['estimated_unit_price'] === 0.0 && $this->isMoneyOnly($line)) {
                $current['estimated_unit_price'] = $this->toAmount($line);
                continue;
            }

            $current['description'][] = $line;
        }

        if ($current !== null) {
            $items[] = $current;
        }

        [$items, $conditions] = $this->extractConditions($items);

        return [
            'items'      => array_map([$this, 'finalizeItem'], $items),
            'conditions' => $conditions,
            'mode'       => 'row',
            'confident'  => $items !== [],
        ];
    }

    /**
     * The price is the first money-shaped token on the line, wherever it
     * landed — on these forms it is routinely typed into the wrong column.
     */
    private function matchAnchor(string $line): ?array
    {
        if (! preg_match('/^(\d{1,5})(?:\.00?)?\s+(.*)$/', $line, $m)) {
            return null;
        }

        $quantity = (int) $m[1];
        $rest = trim($m[2]);

        if ($quantity < 1 || $rest === '') {
            return null;
        }

        $unit = 'pcs';

        if (preg_match('/^([A-Za-z]{1,12}\.?)\s*(.*)$/', $rest, $u)) {
            $candidate = strtolower(rtrim($u[1], '.'));
            $remainder = trim($u[2]);

            if (in_array($candidate, self::UNIT_HINTS, true) || ($remainder !== '' && strlen($candidate) <= 8)) {
                $unit = $candidate;
                $rest = $remainder;
            }
        }

        $price = 0.0;

        if (preg_match('/\b(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})\b/', $rest, $p)) {
            $price = $this->toAmount($p[1]);
            $rest = trim(str_replace($p[1], '', $rest));
        }

        $name = trim($rest, " \t,-–—");

        return $name === '' ? null : [
            'quantity' => $quantity,
            'unit'     => $unit,
            'name'     => $name,
            'price'    => $price,
        ];
    }

    // ------------------------------------------------------------ conditions

    /**
     * Trailing lines that describe the whole request get pulled off the last
     * item. Wrapped continuation lines rejoin the condition above them, so a
     * date split across two lines stays one condition.
     */
    private function extractConditions(array $items): array
    {
        if ($items === []) {
            return [$items, []];
        }

        $lastIndex = array_key_last($items);
        $lines = $items[$lastIndex]['description'];
        $cut = null;

        foreach ($lines as $i => $line) {
            $plain = strtolower(ltrim($line, " -–—"));

            foreach (self::CONDITION_HINTS as $hint) {
                if (str_contains($plain, $hint)) {
                    $cut = $i;
                    break 2;
                }
            }
        }

        if ($cut === null) {
            return [$items, []];
        }

        $conditions = [];

        foreach (array_slice($lines, $cut) as $line) {
            $isNew = (bool) preg_match('/^\s*[-–—]/', $line);
            $clean = trim(ltrim($line, " -–—"));

            if ($clean === '') {
                continue;
            }

            if (! $isNew && $conditions !== []) {
                $conditions[array_key_last($conditions)] .= ' ' . $clean;
                continue;
            }

            $conditions[] = $clean;
        }

        $items[$lastIndex]['description'] = array_slice($lines, 0, $cut);

        return [$items, array_values($conditions)];
    }

    private function finalizeItem(array $item): array
    {
        return [
            'item_name'            => $item['item_name'],
            'description'          => implode("\n", $item['description']),
            'quantity'             => $item['quantity'],
            'unit'                 => $item['unit'],
            'estimated_unit_price' => $item['estimated_unit_price'],
        ];
    }
}

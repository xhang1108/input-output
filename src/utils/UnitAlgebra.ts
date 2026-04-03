/**
 * UnitAlgebra — Algebraic Unit Arithmetic Engine
 *
 * Parses unit strings into a structured map of {base → power},
 * performs algebraic operations (MUL, DIV, POW, ADD, SUB),
 * and formats results back to human-readable strings.
 *
 * Works identically for physical units (m, kg, s) and custom labels (apple, box).
 *
 * Examples:
 *   parse("m/s^2")  → Map { m → 1, s → -2 }
 *   parse("N*m")    → Map { N → 1, m → 1 }
 *   mul(km, km)     → "km^2"
 *   div(m, s)       → "m/s"
 *   div(km, km)     → undefined (dimensionless)
 */

/** Map of base unit string to its power (exponent) */
export type UnitMap = Map<string, number>;

// ─── Superscript Characters ───
const SUPERSCRIPT_DIGITS: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻', '+': '⁺',
};

export const UnitAlgebra = {
    // ─── PARSE ───
    /**
     * Parses a unit string into a UnitMap.
     *
     * Supported syntax:
     *   - `*` or ` ` (space) = multiplication separator
     *   - `/` = division separator (all subsequent terms get negated powers)
     *   - `^N` = power (integer, can be negative)
     *   - Compound: "m/s^2" → {m:1, s:-2}, "N*m" → {N:1, m:1}
     *
     * @returns Empty map for undefined/empty input
     */
    parse(unitStr: string | undefined): UnitMap {
        const map: UnitMap = new Map();
        if (!unitStr || unitStr.trim() === '') return map;

        const str = unitStr.trim();

        // Split on '/' to get numerator and denominator parts
        // "m/s^2" → ["m", "s^2"]
        // "kg*m/s^2" → ["kg*m", "s^2"]
        const slashParts = str.split('/');
        const numerator = slashParts[0] || '';
        const denominators = slashParts.slice(1);

        // Parse numerator terms (positive powers)
        this._parseTerms(numerator, 1, map);

        // Parse denominator terms (negative powers)
        for (const denom of denominators) {
            this._parseTerms(denom, -1, map);
        }

        // Clean up: remove zero-power entries
        for (const [key, val] of map) {
            if (val === 0) map.delete(key);
        }

        return map;
    },

    /**
     * Parses multiplication-separated terms and adds to map.
     * E.g. "kg*m" with sign=1  → adds kg:1, m:1
     *      "s^2"  with sign=-1 → adds s:-2
     */
    _parseTerms(segment: string, sign: number, map: UnitMap): void {
        if (!segment.trim()) return;

        // Split by * or space (multiplication)
        const terms = segment.split(/[*·\s]+/).filter(t => t.length > 0);

        for (const term of terms) {
            // Match: base^power or just base
            // Examples: "km^2", "s^-1", "m", "apple"
            const match = term.match(/^([a-zA-Z%°μ]+[a-zA-Z0-9%°μ]*)(?:\^([-+]?\d+))?$/);
            if (match) {
                const base = match[1];
                const power = match[2] ? parseInt(match[2], 10) : 1;
                const current = map.get(base) || 0;
                map.set(base, current + power * sign);
            }
            // If no match (e.g. pure number), silently skip
        }
    },

    // ─── OPERATIONS ───

    /** Multiply: add powers. km * km → km^2 */
    multiply(a: UnitMap, b: UnitMap): UnitMap {
        const result = new Map(a);
        for (const [base, power] of b) {
            result.set(base, (result.get(base) || 0) + power);
        }
        // Clean zeros
        for (const [key, val] of result) {
            if (val === 0) result.delete(key);
        }
        return result;
    },

    /** Divide: subtract powers. km / km → empty (dimensionless) */
    divide(a: UnitMap, b: UnitMap): UnitMap {
        const result = new Map(a);
        for (const [base, power] of b) {
            result.set(base, (result.get(base) || 0) - power);
        }
        // Clean zeros
        for (const [key, val] of result) {
            if (val === 0) result.delete(key);
        }
        return result;
    },

    /** Power: multiply all powers by n. m^2 ^ 3 → m^6 */
    power(a: UnitMap, n: number): UnitMap {
        const result: UnitMap = new Map();
        for (const [base, power] of a) {
            const newPower = power * n;
            if (newPower !== 0) result.set(base, newPower);
        }
        return result;
    },

    /** Check structural equality of two UnitMaps */
    equals(a: UnitMap, b: UnitMap): boolean {
        if (a.size !== b.size) return false;
        for (const [key, val] of a) {
            if (b.get(key) !== val) return false;
        }
        return true;
    },

    /** Check if a UnitMap is dimensionless (empty) */
    isDimensionless(map: UnitMap): boolean {
        return map.size === 0;
    },

    // ─── FORMAT ───

    /**
     * Formats a UnitMap back into a human-readable string.
     * Returns undefined for dimensionless (empty map).
     *
     * Conventions:
     *   - Positive powers in numerator, negative in denominator
     *   - Powers of 1 are implicit
     *   - Single denominator term: "m/s", multiple: "m/(s^2*kg)"
     *   - All positive: "km^2*N"
     */
    format(map: UnitMap): string | undefined {
        if (map.size === 0) return undefined;

        const numeratorParts: string[] = [];
        const denominatorParts: string[] = [];

        // Sort entries for deterministic output
        const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));

        for (const [base, power] of sorted) {
            if (power > 0) {
                numeratorParts.push(power === 1 ? base : `${base}^${power}`);
            } else if (power < 0) {
                const absPower = Math.abs(power);
                denominatorParts.push(absPower === 1 ? base : `${base}^${absPower}`);
            }
        }

        if (numeratorParts.length === 0 && denominatorParts.length === 0) return undefined;

        // Only denominator (e.g. 1/s^2)
        if (numeratorParts.length === 0) {
            return `1/${denominatorParts.length === 1 ? denominatorParts[0] : denominatorParts.join('*')}`;
        }

        const numStr = numeratorParts.join('*');

        if (denominatorParts.length === 0) return numStr;

        // Numerator / Denominator
        const denStr = denominatorParts.length === 1
            ? denominatorParts[0]
            : denominatorParts.join('*');

        return `${numStr}/${denStr}`;
    },

    // ─── MERGE (Top-Level API) ───

    /**
     * Computes the resulting unit from a binary math operation.
     * This is the primary entry point for the engine evaluators.
     *
     * @param unitA - Left operand unit string (or undefined)
     * @param unitB - Right operand unit string (or undefined)
     * @param op - Math operation: ADD, SUB, MUL, DIV, POW, SQRT, ABS, NEG, etc.
     * @returns The resulting unit string, or undefined for dimensionless
     */
    merge(
        unitA: string | undefined,
        unitB: string | undefined,
        op: string
    ): string | undefined {
        const upperOp = (op || '').toUpperCase();

        // No units at all → no unit
        if (!unitA && !unitB) return undefined;

        const mapA = this.parse(unitA);
        const mapB = this.parse(unitB);

        switch (upperOp) {
            case 'ADD':
            case 'SUB': {
                // Same units → preserve
                if (unitA && unitB && this.equals(mapA, mapB)) {
                    return this.format(mapA) || unitA;
                }
                // One is unitless → take the other
                if (!unitA || mapA.size === 0) return this.format(mapB) || unitB;
                if (!unitB || mapB.size === 0) return this.format(mapA) || unitA;
                // Different units → combined display
                return `${unitA} + ${unitB}`;
            }

            case 'MUL': {
                // If one side has no unit, inherit the other
                if (!unitA || mapA.size === 0) return this.format(mapB) || unitB;
                if (!unitB || mapB.size === 0) return this.format(mapA) || unitA;
                return this.format(this.multiply(mapA, mapB));
            }

            case 'DIV': {
                if (!unitA || mapA.size === 0) {
                    // 1/unit → invert
                    if (unitB && mapB.size > 0) {
                        return this.format(this.power(mapB, -1));
                    }
                    return undefined;
                }
                if (!unitB || mapB.size === 0) return this.format(mapA) || unitA;
                return this.format(this.divide(mapA, mapB));
            }

            case 'POW': {
                // B is the exponent (should be a number, so typically no unit)
                // We only handle integer exponents for unit algebra
                if (!unitA || mapA.size === 0) return undefined;
                // Try to parse B as a pure number from unitB (shouldn't have unit)
                // The exponent value comes from the numeric input, not from unitB
                // So for POW, we just return unitA (the engine should handle this separately)
                return this.format(mapA) || unitA;
            }

            case 'SQRT': {
                if (!unitA || mapA.size === 0) return undefined;
                return this.format(this.power(mapA, 0.5));
            }

            case 'CBRT': {
                if (!unitA || mapA.size === 0) return undefined;
                return this.format(this.power(mapA, 1 / 3));
            }

            case 'ABS':
            case 'NEG': {
                // Preserve unit
                return this.format(mapA) || unitA;
            }

            case 'FACT':
            case 'SIGN': {
                // Dimensionless output
                return undefined;
            }

            default:
                // Unknown op: try to preserve A's unit
                return unitA;
        }
    },

    // ─── PRETTIFY ───

    /**
     * Converts a unit string to Unicode-prettified display.
     *   ^2 → ², ^3 → ³, ^-1 → ⁻¹
     *   * → · (middle dot)
     *   Spaces removed
     */
    prettify(unitStr: string | undefined): string {
        if (!unitStr) return '';

        let result = unitStr;

        // Replace ^N with superscript Unicode
        result = result.replace(/\^([-+]?\d+)/g, (_match, num: string) => {
            return [...num].map(ch => SUPERSCRIPT_DIGITS[ch] || ch).join('');
        });

        // Replace * with middle dot
        result = result.replace(/\*/g, '·');

        // Remove spaces (but preserve ' + ' for mixed unit display)
        result = result.replace(/(?<!\+)\s+(?!\+)/g, '');

        return result;
    },
};

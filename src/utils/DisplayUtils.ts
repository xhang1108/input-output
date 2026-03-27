/**
 * 🎨 DisplayUtils
 * 
 * Centralized utility for formatting MathJS objects and engine payloads
 * into human-readable strings for the UI nodes.
 * Prevents logic duplication across different Result Nodes.
 */

export const DisplayUtils = {
    /**
     * Aggressively formats multi-units (e.g., "m m" or "m * m" -> "m^2")
     */
    formatUnit(unit: string | undefined): string {
        if (!unit) return '';
        const clean = unit.replace(/\s+\*\s+/g, ' '); // normalize "m * m" to "m m"
        const parts = clean.split(/\s+/);
        if (parts.length > 1 && parts.every(p => p === parts[0])) {
            return `${parts[0]}^${parts.length}`;
        }
        return unit;
    },

    /**
     * Converts raw payload values into clean strings, handling deeply
     * nested MathJS objects, BigNumbers, Units, Matrices, and Complexes.
     */
    /**
     * Centralized formatting for ANY value in the system.
     * Handles: Primtives, NodePayloads, MathJS (Live & Dehydrated), Matrices, Units.
     */
    formatValue(val: any, precision: number = -1): string {
        if (val === null || val === undefined) return '';

        // 1. Primitive Numbers
        if (typeof val === 'number') {
            if (isNaN(val)) return 'NaN';
            if (!isFinite(val)) return val > 0 ? '∞' : '-∞';
            
            if (precision >= 0) {
                const p = Math.max(0, Math.min(20, precision));
                return val.toLocaleString(undefined, {
                    minimumFractionDigits: p,
                    maximumFractionDigits: p
                });
            }
            
            // Clean rounding for floating point noise
            const str = String(Math.round(val * 1e10) / 1e10);
            return str;
        }

        // 2. Booleans
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';

        // 3. Strings & Numeric Strings (Fallback for precision)
        if (typeof val === 'string') {
            // If it's a numeric string and precision is set, try to format it
            if (precision >= 0 && !isNaN(Number(val)) && val.trim() !== '') {
                return this.formatValue(Number(val), precision);
            }
            // Truncate very long symbolic or numeric results for UI safety
            if (val.length > 1000) return val.substring(0, 100) + '... (truncated)';
            return val;
        }

        // 4. Objects (Payloads, MathJS, Dehydrated)
        if (typeof val === 'object') {
            
            // --- 🛡️ NodePayload Detection ---
            // If it's a wrapper, we unwrap and recurse with specific logic for each type
            if ('type' in val && ('value' in val || 'meta' in val)) {
                const type = String(val.type).toLowerCase();
                const value = val.value;

                // For scalars, just recurse
                if (type === 'scalar' || type === 'string' || type === 'boolean') {
                    return this.formatValue(value, precision);
                }

                // For arrays/matrices, unwrap and recurse
                if (type === 'array' || type === 'matrix') {
                    const data = value?._data || value;
                    return this.formatValue(data, precision);
                }

                // For symbolic expressions, use the symbol text
                if (type === 'symbolic') return String(val.symbol?.value || val.value || '');

                // For objects (multi-output), format keys and values
                if (type === 'object' && value && typeof value === 'object') {
                    const entries = Object.entries(value)
                        .map(([k, v]) => `${k}: ${this.formatValue(v, precision)}`);
                    return `{ ${entries.join(', ')} }`;
                }

                // Error fallback
                if (type === 'error') return String(value || val.meta?.error || 'Unknown Error');

                // Unit fallback
                if (type === 'unit') return this.formatValue(value, precision);

                // Fallback: use raw value if type unrecognized
                return this.formatValue(value, precision);
            }

            // --- 🧪 MathJS Dehydrated Types ---
            // Check this BEFORE generic object keys to catch serialized BigNumbers etc.
            if (val.mathjs) {
                switch (val.mathjs) {
                    case 'BigNumber': return this.formatValue(val.value, precision);
                    case 'Fraction': return `${val.n}/${val.d}`;
                    case 'Complex': 
                        const re = this.formatValue(val.re, precision);
                        const im = this.formatValue(val.im, precision);
                        return `${re}${val.im >= 0 ? '+' : ''}${im}i`;
                    case 'Unit': return `${val.value} ${this.formatUnit(val.unit)}`.trim();
                    case 'Matrix': return this.formatValue(val.data, precision);
                }
            }

            // --- 🧬 Live MathJS Objects ---
            if (val.isBigNumber === true) return this.formatValue(val.toString(), precision);
            if (val.isComplex === true) {
                return `${this.formatValue(val.re, precision)}${val.im >= 0 ? '+' : ''}${this.formatValue(val.im, precision)}i`;
            }
            if (val.isFraction === true) return `${val.n}/${val.d}`;
            if (val.isUnit === true) return val.toString();
            if (val.isMatrix === true) return this.formatValue(val.toArray ? val.toArray() : val._data, precision);

            // --- 📊 Standard Arrays ---
            if (Array.isArray(val)) {
                return `[${val.map(item => this.formatValue(item, precision)).join(', ')}]`;
            }

            // --- 🏛️ Plain Objects ---
            const keys = Object.keys(val).filter(k => k !== 'constructor' && !k.startsWith('_'));
            if (keys.length > 0) {
                const entries = keys.map(k => `${k}: ${this.formatValue(val[k], precision)}`);
                return `{ ${entries.join(', ')} }`;
            }

            return String(val);
        }

        return String(val);
    }
};

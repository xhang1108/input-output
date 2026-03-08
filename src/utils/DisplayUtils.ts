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
    formatValue(val: any, precision: number = -1): string {
        if (val === null || val === undefined) return '';

        if (typeof val === 'number') {
            if (precision >= 0) {
                const p = Math.max(0, Math.min(20, precision));
                return val.toLocaleString(undefined, {
                    minimumFractionDigits: p,
                    maximumFractionDigits: p
                });
            }
            const absVal = Math.abs(val);
            if (absVal !== 0 && (absVal < 0.0001 || absVal > 100000000)) {
                return val.toExponential(4);
            }
            // Standard formatting for general numbers
            const str = String(Math.round(val * 1000000000) / 1000000000);
            return str;
        }

        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';

        // 🧪 Handle Strings (including those dehydrated from BigNumber/Node)
        if (typeof val === 'string') {
            // If it looks like a very long number from BigNumber truncate it for display
            if (/^-?\d+\.\d+$/.test(val) && val.length > 30) {
                return val.substring(0, 20) + '...';
            }
            return val;
        }

        if (typeof val === 'object') {
            // 🛡️ Handle NodePayloads specifically
            if ('type' in val && ('value' in val || 'meta' in val)) {
                if (val.type === 'error') return `ERR: ${val.meta?.error || 'Unknown'}`;
                if (val.type === 'scalar') return this.formatValue(val.value, precision);
                if (val.type === 'array') return this.formatValue(val.value, precision);
                if (val.type === 'string') return String(val.value);
                if (val.type === 'symbolic') return val.symbol || String(val.value);
                // For complex objects in payloads, fall through to generic object formatter
            }

            // Live MathJS Objects (not dehydrated)
            if (val.isBigNumber && typeof val.toString === 'function') return this.formatValue(val.toString(), precision);
            if (val.isFraction) return `${val.n}/${val.d}`;
            if (val.isComplex) return `${this.formatValue(val.re, precision)}${val.im >= 0 ? '+' : ''}${this.formatValue(val.im, precision)}i`;
            if (val.isUnit) return `${val.value} ${this.formatUnit(val.formatUnits ? val.formatUnits() : val.unit || '')}`.trim();
            if (typeof val.toArray === 'function') return this.formatValue(val.toArray(), precision);

            // Handle MathJS specific dehydrated types
            if (val.mathjs === 'Complex' && val.re !== undefined && val.im !== undefined) {
                return `${this.formatValue(val.re, precision)}${val.im >= 0 ? '+' : ''}${this.formatValue(val.im, precision)}i`;
            }
            if (val.mathjs === 'BigNumber') return this.formatValue(val.value, precision);
            if (val.mathjs === 'Fraction') return `${val.n}/${val.d}`;
            if (val.mathjs === 'Unit') return `${val.value} ${this.formatUnit(val.unit)}`.trim();
            if (val.mathjs === 'Matrix') {
                if (Array.isArray(val.data)) {
                    return `[${val.data.map((item: any) => this.formatValue(item, precision)).join(', ')}]`;
                }
                return 'Matrix';
            }

            // 🛡️ Note: Stringified nodes are handled by the 'string' case above.
            if (val.mathjs && val.mathjs.endsWith('Node')) return '[Symbolic]';

            // Handle Arrays (Vector-like)
            if (Array.isArray(val)) {
                return `[${val.map(item => this.formatValue(item, precision)).join(', ')}]`;
            }

            // Handle Plain Objects (Recursive)
            const keys = Object.keys(val).filter(k => k !== 'constructor' && !k.startsWith('_'));
            if (keys.length > 0) {
                const entries = keys.map(k => `${k}: ${this.formatValue(val[k], precision)}`);
                return `{ ${entries.join(', ')} }`;
            }

            if (keys.length === 0 && Object.keys(val).length > 0) return '[Object]';
            return '{}';
        }

        return String(val);
    }
};

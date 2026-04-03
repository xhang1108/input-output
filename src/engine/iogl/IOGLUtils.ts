import { DataType, NodePayload } from '@/types/payload';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { ColorUtils } from '@/utils/ColorUtils';
import { IOGLSchema } from './manifest';

/**
 * ️ IOGL 1.0 Central Utilities
 * Centralizes shared logic for Lexer-level literal parsing, 
 * Parser-level Fidelity Guards, and Encoder-level value unwrapping.
 */
export class IOGLUtils {
    /**
     * Shared logic for detecting booleans and numbers from raw strings.
     * Also handles unescaping for quoted strings.
     */
    public static parseLiteral(val: string): any {
        if (!val) return val;
        
        // 1. Quoted String handling (Robust Unescaping)
        if (val.startsWith('"') && val.endsWith('"')) {
            return this.unescapeString(val);
        }

        const trimmed = val.trim();
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        if (trimmed === 'null') return null;

        const n = parseFloat(trimmed);
        // Flexible numeric check: Valid number and matches standard numeric pattern
        if (!isNaN(n) && isFinite(n) && /^[ \t]*[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?[ \t]*$/.test(trimmed)) {
            return n;
        }
        return val;
    }

    /**
     * Robustly unescapes an IOGL string using JSON standards.
     * Handles multiline strings by temporarily escaping real newlines.
     */
    public static unescapeString(raw: string): string {
        if (!raw) return '';
        
        // Ensure it has quotes for JSON.parse
        let jsonStr = raw;
        if (!jsonStr.startsWith('"')) jsonStr = `"${jsonStr}"`;
        if (!jsonStr.endsWith('"')) jsonStr = `${jsonStr}"`;

        // JSON doesn't allow literal newlines, so we temporarily escape them
        // to let JSON.parse handle the REST of the standard escapes (\n, \t, etc.)
        const sanitizedForJson = jsonStr
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r');
            
        return JSON.parse(sanitizedForJson);
    }

    /**
     * Unified Handle Mapping Logic.
     * Supports positional syntax (e.g. .a) and internal prefixed syntax (e.g. in_a, out_a).
     */
    public static resolveHandle(handle: string | undefined, isSource: boolean): string {
        let h = (handle || '').toLowerCase();
        if (h.startsWith('.')) h = h.substring(1);

        // Match a, b, c, d or shorthands
        const match = h.match(/^([a-z]|out|in|val|res)$/);
        if (match) {
            let char = match[1];
            // Normalize shorthand aliases to 'a'
            if (['out', 'val', 'res', 'in'].includes(char)) char = 'a';
            return (isSource ? 'out_' : 'in_') + char;
        }

        if (h.startsWith('in_') || h.startsWith('out_')) return h;

        return handle || (isSource ? 'out_a' : 'in_a');
    }

    /**
     * Reverse Handle Formatting for Encoder.
     */
    public static formatHandle(handle: string): string {
        const h = handle.toLowerCase();
        // Match in_a, out_b, in, out etc. 
        // We capture the char (a, b, c...)
        const match = h.match(/^(in|out)(_?([a-z]))?$/);

        if (match) {
            const char = match[3] || 'a';
            return `.${char}`;
        }
        return `:${handle}`; // Fallback for custom handles
    }

    /**
     * Fidelity Guard: Wraps raw data into a NodePayload based on manifest schema.
     */
    public static wrapPayload(data: any, propName: string, manifest: IOGLSchema): NodePayload | any {
        const val = data[propName];
        if (val === undefined) return val;

        // Skip if already a payload
        const isPayload = val && typeof val === 'object' && !Array.isArray(val) && ('type' in val) && ('value' in val);
        if (isPayload) return val;

        const pt = manifest.payloadType || 'scalar';

        switch (pt) {
            case 'boolean':
                return PayloadUtils.wrap(val === true || val === 'true' || val === 1 || val === '1');
            case 'scalar':
                return PayloadUtils.createScalar(this.parseLiteral(String(val)));
            case 'array': {
                let parsedVal = val;
                if (typeof val === 'string') {
                    try { parsedVal = JSON.parse(val); } catch (e) { parsedVal = val; }
                }

                if (!this.checkNumeric(parsedVal)) {
                    // This warning logic might be better placed in a higher-level validator, 
                    // but we preserve the behavior of the current Parser.
                    return null; // Signals failure to the caller
                }
                return PayloadUtils.createArray(parsedVal);
            }
            case 'color':
                return ColorUtils.standardize(String(val));
            case 'string':
                return PayloadUtils.createString(String(val));
            default:
                return val;
        }
    }

    /**
     * Encoder Utility: Unwraps Payload values and handles color object special cases.
     */
    public static unwrapValue(val: any): any {
        let unwrapped = val;
        // 1. Unwrap Payload if it's a NodePayload
        if (val && typeof val === 'object' && !Array.isArray(val) && 'type' in val && 'value' in val) {
            unwrapped = val.value;
        }
        // 2. If it's a color object, return its hex string representation for encoding
        if (unwrapped && typeof unwrapped === 'object' && 'hex' in unwrapped) {
            return (unwrapped as any).hex;
        }
        return unwrapped;
    }

    /** Helper for array validation */
    private static checkNumeric(arr: any): boolean {
        if (!Array.isArray(arr)) {
            const n = typeof arr === 'string' ? parseFloat(arr.trim()) : arr;
            return typeof n === 'number' && !isNaN(n);
        }
        return arr.every(item => this.checkNumeric(item));
    }
}


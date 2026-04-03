import { DataType, NodePayload, PayloadValue, ASTNode, Matrix, PayloadMetadata } from "../types/payload";
import { MATH_ALIASES } from "../engine/mathAliases";
import { DisplayUtils } from "./DisplayUtils";
import { UnitAlgebra } from "./UnitAlgebra";

/**
 * ️ Utility functions for creating and manipulating NodePayloads.
 * Acts as the Adapter Layer between legacy number logic and the new object system.
 */
export const PayloadUtils = {
    /**
     * Converts a raw value into a proper NodePayload.
     * Auto-detects type (Scalar, String, Boolean, Array/Tensor).
     */
    wrap(value: unknown): NodePayload {
        if (value && typeof value === 'object' && 'type' in (value as any) && 'value' in (value as any)) {
            return value as NodePayload;
        }

        let type = DataType.Scalar;
        const meta: PayloadMetadata = {};

        if (typeof value === 'string') {
            const isNumeric = !isNaN(Number(value)) && value.trim() !== '';
            type = isNumeric ? DataType.Scalar : DataType.String;
        }
        else if (typeof value === 'boolean') {
            type = DataType.Boolean;
        }
        else if (Array.isArray(value) || (value && (value as any).isMatrix)) {
            type = DataType.Array;
            const dims = this.calculateDimensions(value);
            meta.dimensions = dims;
            meta.rank = dims.length;
        }
        else if (typeof value === 'object' && value !== null) {
            const val = value as any;
            const isHydratedScalar = val.isBigNumber || val.isFraction || val.isComplex;
            const isDehydratedScalar = val.mathjs === 'BigNumber' || val.mathjs === 'Fraction' || val.mathjs === 'Complex';

            if (isHydratedScalar || isDehydratedScalar) {
                type = DataType.Scalar;
            } else {
                type = DataType.Array;
                const dims = this.calculateDimensions(value);
                meta.dimensions = dims;
                meta.rank = dims.length;
            }
        }

        // Pulse Consistency: All Scalars MUST have rank 0 and empty dimensions
        // to pass deepEqual checks during stepwise propagation.
        if (type === DataType.Scalar) {
            meta.rank = 0;
            meta.dimensions = [];
        }

        return {
            type,
            value: this.dehydrate(value),
            symbol: null,
            meta
        };
    },

    /**
     * Helper to calculate Recursive Dimensions (Shape)
     */
    calculateDimensions(value: unknown): number[] {
        if (!value) return [];
        const h = value as any;

        // Match MathJS matrix structure
        if (h.isMatrix || (h._data && h._size)) {
            if (typeof h.size === 'function') return h.size();
            if (Array.isArray(h._size)) return h._size;
        }

        if (!Array.isArray(value)) return [];

        const dims: number[] = [value.length];
        let curr = value[0];
        while (Array.isArray(curr)) {
            dims.push(curr.length);
            curr = curr[0];
        }
        return dims;
    },

    /**
     * Extracts the raw value from a payload.
     */
    unwrap(payload: NodePayload | number | unknown): unknown {
        if (typeof payload === 'object' && payload !== null) {
            const p = payload as any;
            // 1. Standard Payload unwrap
            if ('value' in p && p.type) {
                const inner = p.value;
                // Recursive unwrap for dehydrated MathJS objects (BigNumber/Fraction)
                if (inner && typeof inner === 'object' && 'mathjs' in inner && 'value' in inner) {
                    return (inner as any).value;
                }
                return inner;
            }

            // 2. Direct dehydrated MathJS object unwrap
            if (p.mathjs && 'value' in p) return p.value;

            // 3. MathJS Internal unwrap (if raw object leaked)
            if (p._data && p._size) return p._data;
        }
        return payload;
    },

    /**
     * Creates an error payload.
     */
    createError(message: string): NodePayload {
        return {
            type: DataType.Error,
            value: null,
            symbol: null,
            meta: { error: message }
        };
    },

    /**
     * Safe Symbolic Creator (For algebraic expressions like 'x = 2' or 'y + 3')
     */
    createSymbolic(value: string): NodePayload {
        return {
            type: DataType.Symbolic,
            value,
            symbol: null,
            meta: {}
        };
    },

    /**
     * Safe Scalar Creator
     */
    createScalar(value: PayloadValue | unknown, unit?: string): NodePayload {
        if (value && typeof value === 'object' && 'type' in (value as any) && (value as any).type === DataType.Scalar) {
            const p = value as NodePayload;
            if (unit && p.meta) p.meta.unit = unit;
            return p;
        }

        const p = this.wrap(value);
        // Ensure Scalar type even if wrap fallback to something else (e.g. for raw number constants)
        p.type = DataType.Scalar;
        if (unit) {
            p.meta = { ...p.meta, unit };
        }
        return p;
    },

    /**
     * Safe String Creator
     */
    createString(value: string): NodePayload {
        return {
            type: DataType.String,
            value,
            symbol: null,
            meta: {}
        };
    },

    /**
     * Unified Array/Vector/Matrix Creator
     */
    createArray(value: unknown, unit?: string): NodePayload {
        if (value && typeof value === 'object' && 'type' in (value as any) && (value as any).type === DataType.Array) {
            return value as NodePayload;
        }
        const dims = this.calculateDimensions(value);
        return {
            type: DataType.Array,
            value: this.dehydrate(value),
            symbol: null,
            meta: { unit, dimensions: dims, rank: dims.length }
        };
    },


    /**
     * Safe Boolean Creator
     */
    createBoolean(value: boolean): NodePayload {
        return {
            type: DataType.Boolean,
            value,
            symbol: null,
            meta: {}
        };
    },

    /**
     * Checks if payload is of a specific type
     */
    isType(payload: NodePayload, type: DataType): boolean {
        return payload.type === type;
    },

    /**
     * Creates a symbolic AST Node.
     */
    createSymbol(type: ASTNode['type'], data: Partial<ASTNode>): ASTNode {
        return { type, ...data };
    },

    /**
     * Merges two units based on an operation.
     * Naive implementation for Phase 2.0.4.
     * Future: Integrate mathjs.Unit
     */
    mergeUnits(unitA: string | undefined, unitB: string | undefined, op: 'ADD' | 'SUB' | 'MUL' | 'DIV'): string | undefined {
        return UnitAlgebra.merge(unitA, unitB, op);
    },

    /**
     * Parses a string input into a NodePayload.
     * format: "value [unit]"
     * e.g. "5 kg", "10 m/s", "3.14"
     */
    parseString(input: string): NodePayload {
        const clean = input.trim();

        // Regex to capture Number and optional Unit
        // Groups: 1=Value, 2=Unit (optional)
        const regex = /^([-+]?[0-9]*\.?[0-9]+)\s*([a-zA-Z^/*0-9]*)$/;
        const match = clean.match(regex);

        if (match) {
            const val = parseFloat(match[1]);
            const unit = match[2] || undefined;
            return this.createScalar(val, unit);
        }

        // Fallback: If not a number, treat as String
        return {
            type: DataType.String,
            value: input,
            symbol: null,
            meta: {}
        };
    },

    /**
     * Dehydrate: MathJS Object -> JSON
     * Prepares value for storage or transport (Web Worker).
     */
    dehydrate(value: unknown): PayloadValue {
        if (!value) return value as PayloadValue;

        const h = value as {
            isBigNumber?: boolean;
            isFraction?: boolean;
            n?: unknown;
            d?: unknown;
            isComplex?: boolean;
            re?: unknown;
            im?: unknown;
            isUnit?: boolean;
            toNumber?: (u?: string) => number;
            formatUnits?: () => string;
            value?: unknown;
            isMatrix?: boolean;
            toArray?: () => unknown[];
            type?: string;
            toString?: () => string;
        };

        // BigNumber -> String
        if (h.isBigNumber) {
            return { mathjs: 'BigNumber', value: h.toString ? h.toString() : String(value) };
        }

        // Fraction -> String
        if (h.isFraction) {
            return { mathjs: 'Fraction', n: h.n, d: h.d };
        }

        // Complex -> {re, im}
        if (h.isComplex) {
            return { mathjs: 'Complex', re: h.re, im: h.im };
        }

        // Unit -> String (simplest for now) or Object
        if (h.isUnit) {
            return {
                mathjs: 'Unit',
                value: h.toNumber ? h.toNumber(h.formatUnits ? h.formatUnits() : undefined) : h.value,
                unit: h.formatUnits ? h.formatUnits() : undefined
            };
        }

        // Array -> Array (Recursive)
        if (Array.isArray(value)) {
            return value.map(item => this.dehydrate(item)) as unknown as PayloadValue;
        }

        // Matrix -> Array (Recursive) or JSON
        const m = h as any;
        if ((m.isMatrix || m._data) && (m.toArray || Array.isArray(m._data))) {
            const rawData = m.toArray ? m.toArray() : m._data;
            return {
                mathjs: 'Matrix',
                data: rawData.map((item: unknown) =>
                    Array.isArray(item)
                        ? item.map((sub: unknown) => this.dehydrate(sub))
                        : this.dehydrate(item)
                ),
                type: m.type || 'DenseMatrix'
            };
        }

        // MathJS Node (OperatorNode, SymbolNode, etc) -> String
        if (typeof value === 'object' && value !== null && 'isNode' in (value as any)) {
            return (value as any).toString();
        }

        // Plain Object -> Recursive Dehydrate
        // This ensures nested results in objects (like { a: det(...) }) are properly handled.
        // We only recursion if it's a "POJO" (Plain Old JavaScript Object)
        const isPOJO = typeof value === 'object' && value !== null &&
            (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

        if (isPOJO) {
            const result: Record<string, unknown> = {};
            for (const key in value as Record<string, unknown>) {
                if (Object.prototype.hasOwnProperty.call(value, key)) {
                    result[key] = this.dehydrate((value as any)[key]);
                }
            }
            return result as unknown as PayloadValue;
        }

        // ️ Final Fallback: If it's a complex object we don't recognize but has a toString, 
        // and it's not a POJO/Array, it might be an internal Decimal/Complex/Unit.
        if (typeof value === 'object' && value !== null && h.toString) {
            return h.toString();
        }

        return value as PayloadValue;
    },

    /**
     * Hydrate: JSON -> MathJS Object
     * Restores objects for calculation.
     * Note: Requires math instance to create objects.
     */
    hydrate(value: PayloadValue, math: unknown): unknown {
        if (!value || typeof value !== 'object') return value;

        // Use a record with index signature to safely check for 'mathjs'
        const obj = value as Record<string, unknown>;

        if ('mathjs' in obj) {
            const type = obj.mathjs;
            // Define an interface for the math object functions we expect
            const m = math as {
                bignumber: (v: unknown) => unknown;
                fraction: (n: unknown, d: unknown) => unknown;
                complex: (re: unknown, im: unknown) => unknown;
                unit: (v: unknown, u: unknown) => unknown;
                matrix: (d: unknown) => unknown;
            };

            switch (type) {
                case 'BigNumber':
                    return m.bignumber(obj.value);
                case 'Fraction':
                    return m.fraction(obj.n, obj.d);
                case 'Complex':
                    return m.complex(obj.re, obj.im);
                case 'Unit':
                    return m.unit(obj.value, obj.unit);
                case 'Matrix':
                    return m.matrix(obj.data);
            }
        }

        return value;
    },

    /**
     * Truthiness Logic
     * Determines if a payload or raw value is "true" in the Input-Output world.
     * Handles: Booleans, Numbers (0=false), Strings (""=false), and MathJS Types (BigNumber, Unit).
     */
    toBoolean(value: unknown, math?: unknown): boolean {
        // 1. Unwrap Payload if needed
        const raw = this.unwrap(value);

        // 2. Hydrate if we have a math instance (important for Units/BigNumbers)
        const hydrated = math ? this.hydrate(raw as PayloadValue, math) : raw;

        // 3. Handle MathJS Types
        if (hydrated && typeof hydrated === 'object') {
            const h = hydrated as {
                isBigNumber?: boolean;
                isZero?: () => boolean;
                isUnit?: boolean;
                value?: number;
                isComplex?: boolean;
                re?: number;
                im?: number;
                isFraction?: boolean;
                n?: number;
            };
            if (h.isBigNumber && h.isZero) return !h.isZero();
            if (h.isUnit) return h.value !== 0;
            if (h.isComplex) return h.re !== 0 || h.im !== 0;
            if (h.isFraction) return h.n !== 0;
        }

        // 4. Standard JS Truthiness
        return !!hydrated;
    },

    /**
     * ️ Strict Typing: Validate & Coerce
     * Ensures payload matches expected type, or throws.
     */
    validateType(payload: NodePayload, expected: DataType): NodePayload {
        if (payload.type === DataType.Error) return payload; // Pass errors through

        // Exact match
        if (payload.type === expected) return payload;

        // Coercion Rules

        // 1. Array -> Scalar (if 1x1)
        if (payload.type === DataType.Array && expected === DataType.Scalar) {
            // For now, let's just return Error if mismatch.
            return this.createError(`Type Mismatch: Expected ${expected}, got ${payload.type}`);
        }

        // 2. Scalar -> String
        // 2. Scalar -> String
        if (payload.type === DataType.Scalar && expected === DataType.String) {
            return {
                ...payload,
                type: DataType.String,
                value: String(payload.value)
            };
        }

        // 3. Symbolic -> String
        if (payload.type === DataType.Symbolic && expected === DataType.String) {
            return {
                ...payload,
                type: DataType.String,
                value: String(payload.value)
            };
        }

        // Fail
        return this.createError(`Type Mismatch: Expected ${expected}, got ${payload.type}`);
    },

    /**
     * Stringify Symbol: AST -> Formula String
     * Recursively converts an AST node into a human-readable formula.
     */
    stringifySymbol(node: ASTNode | null, options: { expandSymbols?: boolean } = {}): string {
        if (!node) return '';

        switch (node.type) {
            case 'Literal':
                return String(node.value);
            case 'Identifier':
                // Smart Expansion: Expand if requested OR if it's an input node (IN-XX)
                const isInputNode = node.sourceId?.startsWith('IN-');
                if ((options.expandSymbols || isInputNode) && node.value !== undefined && node.value !== null) {
                    // Use DisplayUtils to handle dehydrated MathJS objects recursively
                    return DisplayUtils.formatValue(node.value);
                }
                return node.name || String(node.value);
            case 'UnaryExpression': {
                const opMap: Record<string, string> = {
                    NEG: '-', ABS: 'abs', SQRT: 'sqrt', FACT: '!', SIGN: 'sign', CBRT: 'cbrt'
                };
                const op = opMap[node.operator!] || (node.operator || '');
                const isFunc = ['abs', 'sqrt', 'sign', 'cbrt'].includes(op);
                const arg = this.stringifySymbol(node.argument!, options);

                if (op === '!') return `factorial(${arg})`; // Use function call for Factorial
                return isFunc ? `${op}(${arg})` : `${op}${arg}`;
            }
            case 'BinaryExpression': {
                const left = this.stringifySymbol(node.left!, options);
                const right = this.stringifySymbol(node.right!, options);

                const opMap: Record<string, string> = {
                    ADD: '+', SUB: '-', MUL: '*', DIV: '/',
                    POW: '^', MOD: '%',
                    AND: '&&', OR: '||',
                    EQ: '==', GT: '>', LT: '<', GTE: '>=', LTE: '<=', NEQ: '!='
                };
                let op = opMap[node.operator!] || node.operator;

                // Fallback for mis-categorized unary ops in binary tree (e.g. NEG with right=0)
                if (node.operator === 'NEG') return `(-${left})`;
                if (node.operator === 'ABS') return `abs(${left})`;
                if (node.operator === 'SQRT') return `sqrt(${left})`;
                if (node.operator === 'MOD') return `mod(${left}, ${right})`; // Use function for better compatibility

                return `(${left} ${op} ${right})`;
            }
            case 'ConditionalExpression': {
                const test = this.stringifySymbol(node.test!, options);
                const cons = this.stringifySymbol(node.consequent!, options);
                const alt = this.stringifySymbol(node.alternate!, options);
                return `(${test} ? ${cons} : ${alt})`;
            }
            case 'FunctionCall':
                return `${node.name}(${node.args?.map(a => this.stringifySymbol(a, options)).join(', ')})`;
            default:
                return '';
        }
    },

    /**
     * Clone Payload
     * Creates a shallow copy of the payload to prevent mutation side-effects.
     */
    clone(payload: NodePayload): NodePayload {
        return {
            type: payload.type,
            value: payload.value, // Reference copy for complex objects (Matrix), primitive for others
            symbol: payload.symbol,
            meta: { ...payload.meta }
        };
    },

    /**
     * Centralized Expression Extraction
     * Converts a payload to a string suitable for Nerdamer/MathJS.
     */
    extractExprStr(payload: NodePayload | undefined): string | null {
        if (!payload) return null;

        // 1. For Symbolic types, the 'value' IS the expression string.
        if (payload.type === DataType.Symbolic) {
            const val = this.unwrap(payload);
            if (typeof val === 'string') return val;
        }

        // 2. For other types (like Scalar), prioritize the symbolic derivation tree if present.
        if (payload.symbol) {
            const sym = this.stringifySymbol(payload.symbol);
            if (sym && sym !== 'null') return sym;
        }

        // 3. Fallback to raw values
        const raw = this.unwrap(payload);
        if (typeof raw === 'string') return raw;
        if (typeof raw === 'number') return String(raw);
        if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
            return String((raw as Record<string, unknown>).value);
        }
        return raw !== null && raw !== undefined ? String(raw) : null;
    },

    /**
     * Deduplicates numerical results with a small epsilon window.
     * Prevents [2.0000000001, 2.0] from appearing in solver results.
     */
    deduplicateResults(results: any[], epsilon: number = 1e-10): any[] {
        if (!Array.isArray(results)) return [];
        const unique: any[] = [];
        for (const val of results) {
            const isDuplicate = unique.some(u => {
                if (typeof val === 'number' && typeof u === 'number') {
                    return Math.abs(val - u) < epsilon;
                }
                return val === u;
            });
            if (!isDuplicate) unique.push(val);
        }
        return unique;
    },

    /**
     * ️ Extracts a view-friendly value for UI presentation.
     * Handles specialized node types like Color and raw Input.
     * Centralizing this prevents duplication in Wiki and Canvas components.
     */
    normalizeForDisplay(nodeType: string, payload: any): any {
        const unwrapped = this.unwrap(payload);

        // Color Normalization (HEX extraction)
        if (nodeType === 'IN-03' || nodeType === 'IN-COLOR') {
            const colorObj = (typeof unwrapped === 'object' && unwrapped !== null && !Array.isArray(unwrapped)) ? unwrapped as any : null;
            let displayColor = (colorObj && typeof colorObj.out_a === 'string')
                ? colorObj.out_a
                : (typeof unwrapped === 'string' ? unwrapped : '');

            // If it's an array, we should ideally convert to hex, but for normalization let's just use first element or fallback
            if (Array.isArray(unwrapped)) {
                return '#3b82f6'; // Safe fallback for normalization
            }

            // Fallback for non-hex results
            if (typeof displayColor !== 'string' || !displayColor.startsWith('#')) {
                if (typeof displayColor === 'string' && displayColor.length === 6) return `#${displayColor}`;
                return '#3b82f6';
            }
            return displayColor;
        }

        // Generic Input Normalization (Unwrap raw values)
        if (nodeType.startsWith('IN-') || nodeType === 'input') {
            return unwrapped;
        }

        return payload; // Default: Return the full payload (e.g. for ResultNode views)
    },

    /**
     * Normalizes mathematical expressions by lowercasing known function names.
     * Prevents case-sensitivity issues while preserving user variables.
     */
    _normRegexMap: new Map<any, RegExp>(),
    normalizeMathExpression(expr: string, math: any): string {
        if (!expr || typeof expr !== 'string' || !math) return expr;

        // Canonicalization: Map aliases to primary names (e.g. sgn -> sign)
        // This ensures downstream engines like nerdamer see standard names.
        let processed = expr;
        for (const [alias, primary] of Object.entries(MATH_ALIASES)) {
            processed = processed.replace(new RegExp(`\\b${alias}\\b`, 'gi'), primary);
        }

        let regex = this._normRegexMap.get(math);
        if (!regex) {
            const knownFunctions = Object.keys(math).filter(k => {
                try {
                    return typeof (math as any)[k] === 'function';
                } catch {
                    return false;
                }
            });
            // Filter for standard math identifiers (starts with lowercase, alphanumeric)
            const functionNames = knownFunctions.filter(name => /^[a-z][a-zA-Z0-9]*$/.test(name));
            regex = new RegExp(`\\b(${functionNames.join('|')})\\b`, 'gi');
            this._normRegexMap.set(math, regex);
        }

        // Super Normalizer Logic

        // 1. Case Normalization (Standard Functions)
        const normalized = processed.replace(regex, (match) => {
            const lower = match.toLowerCase();
            if (typeof (math as any)[lower] === 'function') {
                return lower;
            }
            return match;
        });

        // Get function names for subsequent patterns
        const knownFunctions = Object.keys(math);
        const fnList = knownFunctions.filter(name => /^[a-z][a-zA-Z0-9]*$/.test(name)).join('|') + '|atan|sign';

        // 3. Parentheses Injection: "sin x" -> "sin(x)"
        // Only if followed by simple identifier or number (avoid double wrapping)
        let finalExpr = normalized.replace(new RegExp(`\\b(${fnList})\\s+([a-zA-Z0-9x.]+)(\\b|$)`, 'gi'), '$1($2)');

        // 4. Implicit Multiplication (Surgery)
        // ) ( -> ) * ( , ) fn -> ) * fn
        finalExpr = finalExpr.replace(/(\))(\s*)(\()/g, '$1 * $3');
        finalExpr = finalExpr.replace(new RegExp(`(\\))(\s*)(${fnList}|[a-zA-Z0-9])\\b`, 'gi'), '$1 * $3');

        // 5. Smart Expression: Auto-append (x) to univariate naked functions (e.g. sin -> sin(x))
        const clean = finalExpr.trim();
        if (/^[a-z][a-zA-Z0-9]*$/.test(clean) && typeof (math as any)[clean] === 'function') {
            try {
                math.evaluate(`${clean}(1)`);
                return `${clean}(x)`;
            } catch {
                return finalExpr;
            }
        }

        return finalExpr;
    }
};



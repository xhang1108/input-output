import { DataType, NodePayload, PayloadValue, ASTNode, Matrix, PayloadMetadata } from "../types/payload";

/**
 * 🛠️ Utility functions for creating and manipulating NodePayloads.
 * Acts as the Adapter Layer between legacy number logic and the new object system.
 */
export const PayloadUtils = {
    /**
     * Converts a raw value into a proper NodePayload.
     * Auto-detects type (Scalar, String, Boolean, Array/Tensor).
     */
    wrap(value: unknown): NodePayload {
        if (typeof value === 'object' && value !== null && 'type' in (value as any) && 'value' in (value as any)) {
            return value as NodePayload;
        }

        let type = DataType.Scalar;
        const meta: PayloadMetadata = {};

        if (typeof value === 'string') type = DataType.String;
        else if (typeof value === 'boolean') type = DataType.Boolean;
        else if (Array.isArray(value) || (value && (value as any).isMatrix)) {
            type = DataType.Array;
            const dims = this.calculateDimensions(value);
            meta.dimensions = dims;
            meta.rank = dims.length;
        }
        else if (typeof value === 'object' && value !== null) {
            type = DataType.Array; // Unified Struct/Tensor
            const dims = this.calculateDimensions(value);
            meta.dimensions = dims;
            meta.rank = dims.length;
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
        if (!Array.isArray(value)) {
            if (value && (value as any).isMatrix && (value as any).size) {
                return (value as any).size();
            }
            return [];
        }
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
        if (typeof payload === 'object' && payload !== null && 'value' in (payload as Record<string, unknown>)) {
            return (payload as { value: unknown }).value;
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
    createScalar(value: PayloadValue, unit?: string): NodePayload {
        return {
            type: DataType.Scalar,
            value: this.dehydrate(value),
            symbol: null,
            meta: { unit, rank: 0, dimensions: [] }
        };
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
        if (!unitA && !unitB) return undefined;
        if (!unitA) return unitB; // Treat missing unit as scalar (1)
        if (!unitB) return unitA;

        switch (op) {
            case 'ADD':
            case 'SUB':
                if (unitA === unitB) return unitA;
                return `${unitA}|${unitB}`; // Temporary Mismatch Indicator

            case 'MUL':
                return `${unitA}*${unitB}`;

            case 'DIV':
                if (unitA === unitB) return undefined; // m/m = scalar
                return `${unitA}/${unitB}`;

            default:
                return undefined;
        }
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
     * 🧊 Dehydrate: MathJS Object -> JSON
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
        if (h.isMatrix && h.toArray) {
            return {
                mathjs: 'Matrix',
                data: h.toArray().map((item: unknown) =>
                    Array.isArray(item)
                        ? item.map((sub: unknown) => this.dehydrate(sub))
                        : this.dehydrate(item)
                ),
                type: h.type // 'DenseMatrix' or 'SparseMatrix'
            };
        }

        // 📝 MathJS Node (OperatorNode, SymbolNode, etc) -> String
        if (typeof value === 'object' && value !== null && 'isNode' in (value as any)) {
            return (value as any).toString();
        }

        // 📦 Plain Object -> Recursive Dehydrate
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

        // 🛡️ Final Fallback: If it's a complex object we don't recognize but has a toString, 
        // and it's not a POJO/Array, it might be an internal Decimal/Complex/Unit.
        if (typeof value === 'object' && value !== null && h.toString) {
            return h.toString();
        }

        return value as PayloadValue;
    },

    /**
     * 💧 Hydrate: JSON -> MathJS Object
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
     * 🧠 Truthiness Logic
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
     * 🛡️ Strict Typing: Validate & Coerce
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
     * 🔠 Stringify Symbol: AST -> Formula String
     * Recursively converts an AST node into a human-readable formula.
     */
    stringifySymbol(node: ASTNode | null): string {
        if (!node) return '';

        switch (node.type) {
            case 'Literal':
                return String(node.value);
            case 'Identifier':
                return node.name || String(node.value);
            case 'UnaryExpression':
                return `${node.operator}${this.stringifySymbol(node.argument!)}`;
            case 'BinaryExpression': {
                const left = this.stringifySymbol(node.left!);
                const right = this.stringifySymbol(node.right!);

                const opMap: Record<string, string> = {
                    ADD: '+', SUB: '-', MUL: '*', DIV: '/',
                    AND: '&&', OR: '||',
                    EQ: '==', GT: '>', LT: '<', GTE: '>=', LTE: '<=', NEQ: '!='
                };
                const op = opMap[node.operator!] || node.operator;

                return `(${left} ${op} ${right})`;
            }
            case 'ConditionalExpression': {
                const test = this.stringifySymbol(node.test!);
                const cons = this.stringifySymbol(node.consequent!);
                const alt = this.stringifySymbol(node.alternate!);
                return `(${test} ? ${cons} : ${alt})`;
            }
            case 'FunctionCall':
                return `${node.name}(${node.args?.map(a => this.stringifySymbol(a)).join(', ')})`;
            default:
                return '';
        }
    },

    /**
     * 👯 Clone Payload
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
};


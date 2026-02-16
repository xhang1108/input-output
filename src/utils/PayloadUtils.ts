import { DataType, NodePayload, PayloadValue, ASTNode, Matrix } from "../types/payload";

/**
 * 🛠️ Utility functions for creating and manipulating NodePayloads.
 * Acts as the Adapter Layer between legacy number logic and the new object system.
 */
export const PayloadUtils = {
    /**
     * Converts a raw value into a proper NodePayload.
     * Auto-detects type (Scalar, String, Boolean, Object).
     */
    wrap(value: any): NodePayload {
        if (typeof value === 'object' && value !== null && 'type' in value && 'value' in value) {
            // Already a payload, return as is (idempotent)
            return value as NodePayload;
        }

        let type = DataType.Scalar;
        if (typeof value === 'string') type = DataType.String;
        else if (typeof value === 'boolean') type = DataType.Boolean;
        else if (Array.isArray(value)) type = DataType.Matrix; // Preliminary array check
        else if (typeof value === 'object') type = DataType.Object;

        return {
            type,
            value,
            symbol: null,
            meta: {}
        };
    },

    /**
     * Extracts the raw value from a payload.
     * Essential for UI components during the migration phase.
     */
    unwrap(payload: NodePayload | number | any): any {
        if (typeof payload === 'object' && payload !== null && 'value' in payload) {
            return payload.value;
        }
        return payload; // Return raw number if not wrapped
    },

    /**
     * Creates an error payload.
     * Used for "Railroad Oriented Programming" error propagation.
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
     * Safe Scalar Creator
     */
    createScalar(value: number, unit?: string): NodePayload {
        return {
            type: DataType.Scalar,
            value,
            symbol: null, // To be implemented in Phase 3
            meta: { unit }
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
     * Safe Matrix/Vector Creator
     */
    createVector(value: number[]): NodePayload {
        return {
            type: DataType.Matrix,
            value,
            symbol: null,
            meta: {}
        };
    },

    /**
     * Safe Matrix Creator
     */
    createMatrix(value: Matrix): NodePayload {
        return {
            type: DataType.Matrix,
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
                // TODO: Error propagation for mismatch (e.g. 'm' + 'kg')
                // For now, return a warning string or just one of them?
                // Let's return undefined to indicate "Dimensionless/Invalid" or maybe strict check?
                // Returning a string like "UnitMismatch" might be handled by caller.
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
    dehydrate(value: any): PayloadValue {
        if (!value) return value;

        // BigNumber -> String
        if (value.isBigNumber) {
            return { mathjs: 'BigNumber', value: value.toString() };
        }

        // Fraction -> String
        if (value.isFraction) {
            return { mathjs: 'Fraction', n: value.n, d: value.d }; // or toString
        }

        // Complex -> {re, im}
        if (value.isComplex) {
            return { mathjs: 'Complex', re: value.re, im: value.im };
        }

        // Unit -> String (simplest for now) or Object
        if (value.isUnit) {
            return {
                mathjs: 'Unit',
                value: value.toNumber ? value.toNumber(value.formatUnits()) : value.value,
                unit: value.formatUnits()
            };
        }

        // Array -> Array (Recursive)
        if (Array.isArray(value)) {
            return value.map(item => this.dehydrate(item));
        }

        // Matrix -> Array (Recursive) or JSON
        if (value.isMatrix) {
            return {
                mathjs: 'Matrix',
                data: value.toArray().map((item: any) =>
                    Array.isArray(item)
                        ? item.map((sub: any) => this.dehydrate(sub))
                        : this.dehydrate(item)
                ),
                type: value.type // 'DenseMatrix' or 'SparseMatrix'
            };
        }

        return value;
    },

    /**
     * 💧 Hydrate: JSON -> MathJS Object
     * Restores objects for calculation.
     * Note: Requires math instance to create objects.
     */
    hydrate(value: PayloadValue, math: any): any {
        if (!value || typeof value !== 'object') return value;

        if ('mathjs' in value) {
            const type = (value as any).mathjs;
            switch (type) {
                case 'BigNumber':
                    return math.bignumber((value as any).value);
                case 'Fraction':
                    return math.fraction((value as any).n, (value as any).d);
                case 'Complex':
                    return math.complex((value as any).re, (value as any).im);
                case 'Unit':
                    // value.value might be number, value.unit is string
                    return math.unit((value as any).value, (value as any).unit);
                case 'Matrix':
                    return math.matrix((value as any).data);
            }
        }

        return value;
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

        // 1. Matrix -> Scalar (if 1x1)
        if (payload.type === DataType.Matrix && expected === DataType.Scalar) {
            const val = payload.value;
            if (Array.isArray(val) && val.length === 1) {
                // Very naive check for now. dehydration makes matrix arrays.
            }
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
                // Use parenthesis for lower precedence operators if needed?
                // Simple version for now: always wrap Binary unless Top Level?
                // Actually, let's just use operator mappings.
                const op = node.operator === 'ADD' ? '+' :
                    node.operator === 'SUB' ? '-' :
                        node.operator === 'MUL' ? '*' :
                            node.operator === 'DIV' ? '/' : node.operator;

                return `(${left} ${op} ${right})`;
            }
            case 'FunctionCall':
                return `${node.name}(${node.args?.map(a => this.stringifySymbol(a)).join(', ')})`;
            default:
                return '';
        }
    },
};

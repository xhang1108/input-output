import { DataType, NodePayload, PayloadValue, ASTNode } from "../types/payload";

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
    }
};

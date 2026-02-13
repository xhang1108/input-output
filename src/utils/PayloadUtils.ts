import { DataType, NodePayload, PayloadValue } from "../types/payload";

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
    }
};

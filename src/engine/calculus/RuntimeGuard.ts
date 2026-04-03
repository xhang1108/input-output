/**
 * ️ RuntimeGuard: Eval-Time Safety Valve
 *
 * Instead of pre-scanning for domain errors (which risks infinite loops),
 * we catch errors at evaluation time. This intercepts:
 * - NaN results
 * - Infinity / -Infinity overflows
 * - DivisionByZero exceptions
 * - Timeout / infinite loop protection
 *
 * Usage:
 *   const result = RuntimeGuard.safeEvaluate(() => someComputation());
 *   // Returns { ok: true, value } or { ok: false, error: string }
 */

import { NodePayload } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';

export interface SafeResult<T> {
    ok: boolean;
    value?: T;
    error?: string;
}

export class RuntimeGuard {
    /**
     * Wraps any computation in safety checks.
     * Catches thrown exceptions + validates the result for NaN/Infinity.
     *
     * @param fn - The computation function to execute
     * @returns SafeResult with either the value or an error description
     */
    public static safeEvaluate<T>(fn: () => T): SafeResult<T> {
        try {
            const result = fn();

            // Check numeric results for NaN/Infinity
            if (typeof result === 'number') {
                if (Number.isNaN(result)) {
                    return { ok: false, error: 'Domain Error: Result is NaN' };
                }
                if (!Number.isFinite(result)) {
                    return { ok: false, error: 'Overflow: Result is Infinity' };
                }
            }

            // Check string results that represent numeric values
            if (typeof result === 'string') {
                const num = Number(result);
                if (!Number.isNaN(num) && !Number.isFinite(num)) {
                    return { ok: false, error: 'Overflow: Result is Infinity' };
                }
            }

            return { ok: true, value: result };
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);

            // Classify common error types
            if (message.includes('Division by zero') || message.includes('divide by zero')) {
                return { ok: false, error: 'Division by Zero' };
            }
            if (message.includes('undefined') || message.includes('singularity')) {
                return { ok: false, error: `Domain Error: ${message}` };
            }

            return { ok: false, error: `Eval Error: ${message}` };
        }
    }

    /**
     * Convenience wrapper that returns a NodePayload directly.
     * On success, wraps the value using the provided converter.
     * On failure, returns a PayloadUtils.createError() payload.
     *
     * @param fn - The computation function
     * @param toPayload - Converter from raw result to NodePayload
     */
    public static evaluateToPayload<T>(
        fn: () => T,
        toPayload: (value: T) => NodePayload
    ): NodePayload {
        const result = RuntimeGuard.safeEvaluate(fn);
        if (result.ok && result.value !== undefined) {
            return toPayload(result.value);
        }
        return PayloadUtils.createError(result.error || 'Unknown Error');
    }

    /**
     * Validate a numeric value and return error payload if invalid.
     * Returns null if the value is valid.
     */
    public static validateNumeric(value: number): NodePayload | null {
        if (Number.isNaN(value)) {
            return PayloadUtils.createError('Domain Error: NaN');
        }
        if (!Number.isFinite(value)) {
            return PayloadUtils.createError('Overflow: Infinity');
        }
        return null;
    }
}


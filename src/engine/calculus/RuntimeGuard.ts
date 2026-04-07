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
     * Security Limits
     * Constants to prevent DoS via massive expressions or infinite loops.
     */
    public static readonly MAX_EXECUTION_TIME = 2000; // 2 seconds
    public static readonly MAX_EXPRESSION_LENGTH = 1000; // 1k characters

    private static _startTime: number = 0;

    /**
     * Start the execution timer.
     * Should be called at the beginning of a Worker tick or solve operation.
     */
    public static startTimer() {
        this._startTime = performance.now();
    }

    /**
     * Checks if the current execution has exceeded the time limit.
     * Throws an error to abort execution if exceeded.
     */
    public static checkTimeLimit() {
        if (this._startTime === 0) return;
        if (performance.now() - this._startTime > this.MAX_EXECUTION_TIME) {
            throw new Error(`Execution Timeout: Operation exceeded ${this.MAX_EXECUTION_TIME}ms`);
        }
    }

    /**
     * Validate expression string length.
     */
    public static validateExpression(expr: string): string | null {
        if (expr.length > this.MAX_EXPRESSION_LENGTH) {
            return `Expression too long (Max ${this.MAX_EXPRESSION_LENGTH} chars)`;
        }
        return null;
    }

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


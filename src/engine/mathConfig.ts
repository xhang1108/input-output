/**
 * 🔧 Shared MathJS Configuration
 * 
 * Single source of truth for MathJS initialization parameters.
 * Used by both MathEngine (main thread) and brain.worker.ts (Worker thread)
 * to guarantee calculation parity across execution contexts.
 * 
 * Phase 4.1: Web Worker Migration
 */
export const MATH_CONFIG = {
    number: 'BigNumber',
    precision: 64,
} as const;

export type MathConfig = typeof MATH_CONFIG;

/**
 * Shared MathJS Configuration
 * 
 * Single source of truth for MathJS initialization parameters.
 * Used by both InputOutputEngine (main thread) and brain.worker.ts (Worker thread)
 * to guarantee calculation parity across execution contexts.
 */
export const SUPPORTED_PRECISIONS = [16, 32, 64] as const;
export type MathPrecision = (typeof SUPPORTED_PRECISIONS)[number];

export const getMathConfig = (precision: MathPrecision = 64) => ({
    number: 'BigNumber' as const,
    precision: precision,
});

export type MathConfig = ReturnType<typeof getMathConfig>;

// Legacy export for initial sync before settings are fully loaded
export const MATH_CONFIG = getMathConfig(64);

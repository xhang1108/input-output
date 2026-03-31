import { DataType, NodePayload } from '../types/payload';
import { PayloadUtils } from './PayloadUtils';

/**
 * Color Utility for the Input-Output Engine.
 * Handles conversions between HEX, RGB, and Vec3 across different bit depths.
 */
export const ColorUtils = {
    /**
     * Standardizes any color input (HEX string or RGB/Vec3 array) into a Color Object.
     * @param input Raw input value or payload
     * @param depth Bit depth for scaling (8bit, 10bit, 12bit)
     * @param unit Explicit unit hint (e.g., 'vec3', 'rgb')
     */
    standardize(input: any, depth: string = '8bit', unit?: string): NodePayload {
        const val = PayloadUtils.unwrap(input);

        // 1. Validating existing structure?
        // We do NOT early return here anymore to ensure all aliases (hex, vec3) and '#' are injected.
        if (val && typeof val === 'object' && !Array.isArray(val) && (val as any).out_a) {
            // Proceed to re-standardize to ensure hex/vec3 aliases are present
        }

        let hex = '#000000';
        let rNorm = 0, gNorm = 0, bNorm = 0;

        // 2. Handle HEX String (direct or from object)
        const sourceHex = typeof val === 'string' ? val : (val && typeof val === 'object' && !Array.isArray(val) ? (val as any).out_a || (val as any).hex : null);

        if (typeof sourceHex === 'string' && (sourceHex.startsWith('#') || /^[0-9A-Fa-f]{6}$/.test(sourceHex))) {
            hex = sourceHex.startsWith('#') ? sourceHex : '#' + sourceHex;
            rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
            gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
            bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
        }
        // 3. Handle Array (RGB or Vec3)
        else if (Array.isArray(val) && val.length >= 3) {
            const scaler = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

            // Determine if it's already normalized (0-1) or needs scaling
            if (unit === 'vec3' || (val[0] <= 1 && val[1] <= 1 && val[2] <= 1 && !unit)) {
                rNorm = Math.max(0, Math.min(1, Number(val[0])));
                gNorm = Math.max(0, Math.min(1, Number(val[1])));
                bNorm = Math.max(0, Math.min(1, Number(val[2])));
            } else {
                rNorm = Math.max(0, Math.min(1, Number(val[0]) / scaler));
                gNorm = Math.max(0, Math.min(1, Number(val[1]) / scaler));
                bNorm = Math.max(0, Math.min(1, Number(val[2]) / scaler));
            }

            const toHexPair = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
            hex = `#${toHexPair(rNorm)}${toHexPair(gNorm)}${toHexPair(bNorm)}`;
        }

        // Return standardized object
        return {
            type: DataType.Color,
            value: {
                // Positional mapping for IOGL 1.0 handles
                out_a: hex,
                out_b: [Math.round(rNorm * 255), Math.round(gNorm * 255), Math.round(bNorm * 255)],
                out_c: [Number(rNorm.toFixed(3)), Number(gNorm.toFixed(3)), Number(bNorm.toFixed(3))],
                // Backward compatibility for UI components (ColorNode.tsx, RedultNode.tsx)
                hex: hex,
                vec3: [Number(rNorm.toFixed(3)), Number(gNorm.toFixed(3)), Number(bNorm.toFixed(3))],
                vec4: [Number(rNorm.toFixed(3)), Number(gNorm.toFixed(3)), Number(bNorm.toFixed(3)), 1]
            },
            symbol: null,
            meta: { role: 'color' }
        };
    }
};

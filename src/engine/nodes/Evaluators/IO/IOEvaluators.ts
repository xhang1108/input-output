import { DataType } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { InputOutputEngine } from '../../../InputOutputEngine';
import { NodeEvaluator } from '../../../NodeRegistry';

export const IOEvaluators: Record<string, NodeEvaluator> = {
    'IN-01': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const math = InputOutputEngine.getInstance().getMathInstance();
        const original = node.value || PayloadUtils.createScalar(0);
        // 💡 Fix: Support both 'value' and 'val' keys from different UI components
        const rawVal = data.value ?? data.val;
        let val = rawVal !== undefined ? (rawVal as number) : PayloadUtils.unwrap(original);
        
        // Support precision rounding for Constant node (IN-01 variant)
        const rawPrecision = data.precision ?? data.accuracy;
        const precision = rawPrecision !== undefined ? Number(rawPrecision) : -1;
        
        if (precision >= 0) {
            try { val = math.round(val, precision); } catch (e) {}
        }
        
        const unit = (data.unit as string) || (original.meta?.unit);
        
        return {
            ...PayloadUtils.createScalar(val, unit),
            meta: { ...original.meta, unit } // 💡 Fix: Prioritize data.unit then original.meta
        };
    },
    'IN-02': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const math = InputOutputEngine.getInstance().getMathInstance();
        const original = node.value || PayloadUtils.createScalar(0);
        // 💡 Fix: Support both 'value' and 'val'
        const rawVal = data.value ?? data.val;
        let val = rawVal !== undefined ? (rawVal as number) : PayloadUtils.unwrap(original);
        
        // Support precision rounding for Slider node
        const rawPrecision = data.precision ?? data.accuracy;
        const precision = rawPrecision !== undefined ? Number(rawPrecision) : -1;

        if (precision >= 0) {
            try { val = math.round(val, precision); } catch (e) {}
        }
        
        const unit = (data.unit as string) || (original.meta?.unit);
        
        return {
            ...PayloadUtils.createScalar(val, unit),
            meta: { ...original.meta, unit }
        };
    },
    'IN-04': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const original = node.value || PayloadUtils.createString('');
        const rawVal = PayloadUtils.unwrap(data.value ?? data.val);
        let val = rawVal !== undefined ? rawVal : PayloadUtils.unwrap(original);
        const unit = (data.unit as string) || (original.meta?.unit);
        return {
            ...PayloadUtils.createString(String(val ?? '')),
            meta: { ...original.meta, unit }
        };
    },
    'OT-01': (node, inputs) => {
        const payload = inputs['in_a'] || inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createScalar(0);
        const data = (node.data || {}) as Record<string, unknown>;
        const precision = data.precision as number | undefined;

        if (precision !== undefined && (payload.type === DataType.Scalar || payload.type === DataType.Array)) {
            const math = InputOutputEngine.getInstance().getMathInstance();
            const val = PayloadUtils.unwrap(payload);
            try {
                const hydrated = PayloadUtils.hydrate(val, math);
                // 💡 Fix: Handle plain Arrays as well as mathjs objects
                const rounded = (typeof hydrated === 'number' || Array.isArray(hydrated) || (hydrated && typeof hydrated === 'object' && ((hydrated as any).isBigNumber || (hydrated as any).isFraction || (hydrated as any).isComplex || (hydrated as any).isMatrix)))
                    ? math.round(hydrated, precision)
                    : hydrated;
                
                const wrapped = PayloadUtils.wrap(rounded);
                return {
                    ...wrapped,
                    meta: { ...payload.meta, ...wrapped.meta }
                };
            } catch (e: any) {
                console.error(`[IO-11] Precision Failed: ${e.message}`, { val, precision });
                return payload;
            }
        }

        return payload;
    },
    'IN-07': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const dataVal = data.value;
        if (dataVal !== undefined) {
            if (typeof dataVal === 'object' && dataVal !== null) {
                if ('type' in (dataVal as any) && 'value' in (dataVal as any)) return dataVal as any;
                if ('mathjs' in (dataVal as any)) {
                    return { type: DataType.Array, value: dataVal, symbol: null, meta: {} };
                }
                return PayloadUtils.createArray(dataVal);
            }
        }
        const raw = data.rawExpression as string;
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                return PayloadUtils.createArray(parsed);
            } catch (e) {
                return PayloadUtils.createArray([]);
            }
        }
        if (node.value && typeof node.value === 'object' && ('type' in node.value)) {
            return node.value as any;
        }
        return PayloadUtils.createArray([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    },
    'IN-03': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const rawVal = PayloadUtils.unwrap(data.value ?? data.val);
        const cachedVal = PayloadUtils.unwrap(node.value);

        let hex = '#3b82f6';
        let rNorm = 0.231, gNorm = 0.510, bNorm = 0.965; // Default blue

        const extract = (val: any) => {
            if (val && typeof val === 'object') {
                if (val.hex) hex = val.hex;
                if (Array.isArray(val.vec3)) [rNorm, gNorm, bNorm] = val.vec3;
            } else if (typeof val === 'string' && (val.startsWith('#') || val.length === 6)) {
                hex = val.startsWith('#') ? val : '#' + val;
                rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
                gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
                bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
            }
        };

        if (rawVal) extract(rawVal);
        else if (cachedVal) extract(cachedVal);

        const depth = data.depth as string || '8bit';
        const scaler = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

        const rOut = Math.round(rNorm * scaler);
        const gOut = Math.round(gNorm * scaler);
        const bOut = Math.round(bNorm * scaler);

        return {
            type: DataType.Color,
            value: {
                hex: hex.replace('#', ''),
                rgb: [rOut, gOut, bOut],
                vec3: [rNorm, gNorm, bNorm]
            },
            symbol: null,
            meta: {
                role: 'color',
                handleMeta: {
                hex: { role: 'color', unit: 'hex' },
                    rgb: { role: 'color', unit: 'rgb' },
                    vec3: { role: 'color', unit: 'vec3' }
                }
            }
        };
    },
    'IO-19': (node, inputs) => {
        const payload = inputs['in'] || Object.values(inputs)[0];
        if (!payload) return PayloadUtils.createError('No input');

        const val = PayloadUtils.unwrap(payload);

        if (val && typeof val === 'object' && !Array.isArray(val) && 'hex' in val) {
            return payload;
        }

        let hex = '#000000';
        let r = 0, g = 0, b = 0;

        if (typeof val === 'string' && (val.startsWith('#') || val.length === 6)) {
            hex = val.startsWith('#') ? val : '#' + val;
            r = parseInt(hex.slice(1, 3), 16) || 0;
            g = parseInt(hex.slice(3, 5), 16) || 0;
            b = parseInt(hex.slice(5, 7), 16) || 0;
        } else if (Array.isArray(val) && val.length >= 3) {
            let vr = 0, vg = 0, vb = 0;
            let fr = 0, fg = 0, fb = 0;

            const depth = node.data?.depth || '8bit';
            const unit = payload.meta?.unit;

            const applyScale = (div: number) => {
                vr = (val as number[])[0] / div;
                vg = (val as number[])[1] / div;
                vb = (val as number[])[2] / div;
                fr = Math.round(vr * 255);
                fg = Math.round(vg * 255);
                fb = Math.round(vb * 255);
            };

            if (unit === 'vec3') applyScale(1);
            else if (depth === '10bit') applyScale(1023);
            else if (depth === '12bit') applyScale(4095);
            else applyScale(255);

            const toHex = (c: number) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0');
            hex = `#${toHex(fr)}${toHex(fg)}${toHex(fb)}`;

            return {
                type: DataType.Array,
                value: {
                    hex,
                    rgb: [fr, fg, fb],
                    vec3: [vr, vg, vb]
                },
                symbol: null,
                meta: {}
            };
        }

        return {
            type: DataType.Object,
            value: {
                hex,
                rgb: [r, g, b],
                vec3: [Number((r / 255).toFixed(3)), Number((g / 255).toFixed(3)), Number((b / 255).toFixed(3))]
            },
            symbol: null,
            meta: {}
        };
    },
    'IO-16': (node, inputs) => {
        return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createArray([]);
    },
    'TR-01': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as Record<string, unknown>;
        const isCustom = data.unit === 'CUSTOM';
        const targetUnit = isCustom ? (data.customUnit as string) : (data.unit as string || 'm');
        const valPayload = inputs['in_a'] || inputs['in'] || PayloadUtils.createScalar(0);
        
        try {
            const raw = PayloadUtils.unwrap(valPayload);
            const sourceUnit = valPayload.meta?.unit;
            
            // Standard Conversion logic
            if (sourceUnit && sourceUnit !== targetUnit && !isCustom) {
                try {
                    const result = math.unit(raw, sourceUnit).to(targetUnit);
                    return {
                        ...PayloadUtils.createScalar(PayloadUtils.dehydrate(result.toNumber(targetUnit)), targetUnit),
                        meta: { unit: targetUnit }
                    };
                } catch (e: any) {
                    // If both are potentially standard units, this is an incompatibility error
                    if (e.message?.includes('Units do not match') || e.message?.includes('Unexpected unit')) {
                        return PayloadUtils.createError(`Unit operation failed for ${targetUnit}: ${e.message}`);
                    }
                }
            }
            
            // Otherwise just assign the label (Custom or Standard label)
            return {
                ...PayloadUtils.createScalar(raw, targetUnit),
                meta: { unit: targetUnit }
            };
        } catch (e: any) { 
            return PayloadUtils.createError(`Unit operation failed for ${targetUnit}`);
        }
    },
    'IN-08': (node) => {
        let total = 0;
        const digits = (node.data?.digits as number[]) || [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < digits.length; i++) {
            total = total * 10 + digits[i];
        }
        return PayloadUtils.createScalar(total);
    },
    'OT-03': (node, inputs) => {
        // OT-03: Graph Plot — Pure engine sampling.
        // Receives capsule inputs, runs sampling, returns computed plotPoints in meta.
        import('../../../../utils/PlottingUtils').then(() => { }); // Ensure bundled
        const { PlottingUtils } = require('../../../../utils/PlottingUtils');
        const data = (node.data || {}) as Record<string, unknown>;
        const minX = typeof data.minX === 'number' ? data.minX : -10;
        const maxX = typeof data.maxX === 'number' ? data.maxX : 10;
        const pointsCount = typeof data.points === 'number' ? data.points : 100;

        const rawInput = inputs['in_a'] || inputs['in'] || Object.values(inputs)[0];

        // Normalize to array of payloads (capsule may give array or single)
        let payloadList: any[] = [];
        if (Array.isArray(rawInput)) {
            payloadList = rawInput;
        } else if (rawInput) {
            // Check if it's an object with handle-keyed values (multi-input map)
            const rv = rawInput as any;
            if (rv.type === 'object' && rv.value && typeof rv.value === 'object' && !Array.isArray(rv.value) && !('type' in rv.value)) {
                payloadList = Object.values(rv.value).flat() as any[];
            } else {
                payloadList = [rawInput];
            }
        }

        const allPoints: any[] = [];
        const errors: string[] = [];

        payloadList.forEach((p: any, idx: number) => {
            if (!p) return;
            if (p.type === 'error') {
                errors.push(`Input ${idx + 1}: ${p.meta?.error || 'Unknown error'}`);
                return;
            }

            const parsed = PayloadUtils.unwrap(p);
            if (parsed === null || parsed === undefined) return;

            const seriesName = p.meta?.label || `Series ${idx + 1}`;
            let pts: any[] = [];

            try {
                if (p.type === DataType.Symbolic && typeof parsed === 'string') {
                    pts = PlottingUtils.generateSymbolicPoints(parsed, minX, maxX, pointsCount);
                    const validY = pts.filter((pt: any) => pt.y !== null);
                    if (pts.length > 0 && validY.length === 0) {
                        errors.push(`${seriesName}: All values are undefined/infinite.`);
                    }
                } else if (p.type === DataType.String) {
                    errors.push(`${seriesName}: Literal strings cannot be evaluated as functions.`);
                } else {
                    if (Array.isArray(parsed) && Array.isArray(parsed[0]) && parsed[0].length > 5) {
                        errors.push(`${seriesName}: Dimension mismatch (${parsed[0].length} cols > 4).`);
                    }
                    pts = PlottingUtils.mapDataPayload(parsed);
                }
            } catch (err: any) {
                errors.push(`${seriesName}: ${err.message || 'Evaluation Error'}`);
            }

            const validPts = pts
                .filter((pt: any) => pt.x !== null && pt.y !== null && Number.isFinite(pt.x) && Number.isFinite(pt.y))
                .map((pt: any) => ({ ...pt, series: seriesName }));

            if (validPts.length > 0) {
                allPoints.push(...validPts);
            } else if (!errors.some(e => e.startsWith(seriesName)) && parsed && (Array.isArray(parsed) || typeof parsed === 'object')) {
                errors.push(`${seriesName}: Input data is empty.`);
            }
        });

        return {
            type: DataType.Object,
            value: allPoints,
            symbol: null,
            meta: {
                plotPoints: allPoints,
                plotErrors: errors,
            }
        };
    },
    'OT-02': (node, inputs) => {
        const input = inputs['in_a'] || inputs['in'] || Object.values(inputs)[0];
        const val = PayloadUtils.unwrap(input);

        // Strict logic: true/1 = ok, false/0 = fail, others = void
        let state: 'ok' | 'fail' | 'void' = 'void';
        if (val === true || val === 1) {
            state = 'ok';
        } else if (val === false || val === 0) {
            state = 'fail';
        }

        return {
            type: DataType.Object,
            value: { state, raw: val },
            symbol: null,
            meta: {}
        };
    }
};

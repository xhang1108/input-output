import { DataType } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { InputOutputEngine } from '../../../InputOutputEngine';
import { NodeEvaluator } from '../../../NodeRegistry';

export const IOEvaluators: Record<string, NodeEvaluator> = {
    'IO-01': (node) => node.value || PayloadUtils.createScalar(0),
    'IO-02': (node) => node.value || PayloadUtils.createScalar(0),
    'IO-04': (node) => {
        if (node.value && typeof node.value === 'object' && ('type' in node.value)) {
            return node.value as any;
        }

        const data = (node.data || {}) as Record<string, unknown>;
        return PayloadUtils.createString(String(data.value ?? ''));
    },
    'IO-11': (node, inputs) => {
        return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createScalar(0);
    },
    'IO-08': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const dataVal = data.value;
        if (dataVal !== undefined) {
            if (typeof dataVal === 'object' && dataVal !== null) {
                if ('type' in (dataVal as any) && 'value' in (dataVal as any)) return dataVal as any;
                if ('mathjs' in (dataVal as any)) {
                    return { type: DataType.Matrix, value: dataVal, symbol: null, meta: {} };
                }
                return PayloadUtils.createMatrix(dataVal);
            }
        }
        const raw = data.rawExpression as string;
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                return PayloadUtils.createMatrix(parsed);
            } catch (e) {
                return PayloadUtils.createMatrix([]);
            }
        }
        if (node.value && typeof node.value === 'object' && ('type' in node.value)) {
            return node.value as any;
        }
        return PayloadUtils.createMatrix([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    },
    'IO-18': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const dataVal = data.value;
        const cachedVal = PayloadUtils.unwrap(node.value);

        let hex = '#3b82f6';
        let rNorm = 0, gNorm = 0, bNorm = 0;

        if (dataVal && typeof dataVal === 'object' && !Array.isArray(dataVal) && 'vec3' in dataVal) {
            const colorData = dataVal as { hex?: string; vec3?: number[] };
            hex = colorData.hex || '#000000';
            if (Array.isArray(colorData.vec3)) {
                [rNorm, gNorm, bNorm] = colorData.vec3;
            }
        } else if (typeof dataVal === 'string' && (dataVal.startsWith('#') || dataVal.length === 6)) {
            hex = dataVal.startsWith('#') ? dataVal : '#' + dataVal;
            rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
            gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
            bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
        } else if (cachedVal && typeof cachedVal === 'object' && !Array.isArray(cachedVal) && 'vec3' in cachedVal) {
            const cVal = cachedVal as { hex?: string; vec3?: number[] };
            hex = cVal.hex || '#000000';
            if (Array.isArray(cVal.vec3)) {
                [rNorm, gNorm, bNorm] = cVal.vec3;
            }
        } else if (typeof cachedVal === 'string' && cachedVal.startsWith('#')) {
            hex = cachedVal;
            rNorm = (parseInt(hex.slice(1, 3), 16) || 0) / 255;
            gNorm = (parseInt(hex.slice(3, 5), 16) || 0) / 255;
            bNorm = (parseInt(hex.slice(5, 7), 16) || 0) / 255;
        }

        const depth = data.depth as string || '8bit';
        const scaler = depth === '10bit' ? 1023 : depth === '12bit' ? 4095 : 255;

        const rOut = Math.round(rNorm * scaler);
        const gOut = Math.round(gNorm * scaler);
        const bOut = Math.round(bNorm * scaler);

        return {
            type: DataType.Object,
            value: {
                hex: hex,
                rgb: [rOut, gOut, bOut],
                vec3: [rNorm, gNorm, bNorm]
            },
            symbol: null,
            meta: {
                role: 'color',
                handleMeta: {
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
                type: DataType.Object,
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
        return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createMatrix([]);
    },
    'IO-05': (node, inputs) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const inputPayload = inputs['in'] || PayloadUtils.createScalar(0);
        const val = PayloadUtils.unwrap(inputPayload);
        const unit = data.unit as string || 'm';
        const inputUnit = inputPayload.meta?.unit;

        const math = InputOutputEngine.getInstance().getMathInstance();
        const hydratedInput = PayloadUtils.hydrate(val, math);

        let finalVal: number;
        const h = hydratedInput as { isBigNumber?: boolean; isUnit?: boolean; toNumber: () => number };
        if (typeof hydratedInput === 'number') {
            finalVal = hydratedInput;
        } else if (h && h.isBigNumber) {
            finalVal = h.toNumber();
        } else if (h && h.isUnit) {
            finalVal = h.toNumber();
        } else {
            finalVal = Number(hydratedInput);
        }

        if (inputUnit && inputUnit !== unit) {
            try {
                finalVal = InputOutputEngine.getInstance().convertUnit(finalVal, inputUnit, unit);
            } catch (e) {
                return PayloadUtils.createError(`Cannot convert ${inputUnit} to ${unit}`);
            }
        }

        return PayloadUtils.createScalar(finalVal, unit);
    },
    'IO-21': (node) => {
        let total = 0;
        const digits = (node.data?.digits as number[]) || [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < digits.length; i++) {
            total = total * 10 + digits[i];
        }
        return {
            type: DataType.Scalar,
            value: PayloadUtils.dehydrate(total),
            symbol: null,
            meta: {}
        };
    },
    'IO-14': (node, inputs) => {
        // OT-03: Graph Plot — Pure engine sampling.
        // Receives capsule inputs, runs sampling, returns computed plotPoints in meta.
        import('../../../../utils/PlottingUtils').then(() => { }); // Ensure bundled
        const { PlottingUtils } = require('../../../../utils/PlottingUtils');
        const data = (node.data || {}) as Record<string, unknown>;
        const minX = typeof data.minX === 'number' ? data.minX : -10;
        const maxX = typeof data.maxX === 'number' ? data.maxX : 10;
        const pointsCount = typeof data.points === 'number' ? data.points : 100;

        const rawInput = inputs['in'] || Object.values(inputs)[0];

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
                if (typeof parsed === 'string') {
                    pts = PlottingUtils.generateSymbolicPoints(parsed, minX, maxX, pointsCount);
                    const validY = pts.filter((pt: any) => pt.y !== null);
                    if (pts.length > 0 && validY.length === 0) {
                        errors.push(`${seriesName}: All values are undefined/infinite.`);
                    }
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
    'IO-22': (node, inputs) => {
        const input = inputs['in'] || Object.values(inputs)[0];
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

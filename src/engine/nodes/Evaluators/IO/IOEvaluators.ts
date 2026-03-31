import { DataType } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { InputOutputEngine } from '../../../InputOutputEngine';
import { NodeEvaluator } from '../../../NodeRegistry';
import { ColorUtils } from '../../../../utils/ColorUtils';
import { PlottingUtils } from '../../../../utils/PlottingUtils';

export const IOEvaluators: Record<string, NodeEvaluator> = {
    'IN-01': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const math = InputOutputEngine.getInstance().getMathInstance();
        const original = node.value || PayloadUtils.createScalar(0);
        // Fix: Support both 'value' and 'val' keys from different UI components
        const rawVal = data.value ?? data.val;
        let val = rawVal !== undefined ? (PayloadUtils.unwrap(rawVal) as number) : PayloadUtils.unwrap(original);

        // Support precision rounding for Constant node (IN-01 variant)
        const rawPrecision = data.precision ?? data.accuracy;
        const precision = rawPrecision !== undefined ? Number(rawPrecision) : -1;

        if (precision >= 0) {
            try { val = math.round(val, precision); } catch (e) { }
        }

        const extractedUnit = (rawVal && typeof rawVal === 'object' && (rawVal as any).meta?.unit) || (data.unit as string) || (original.meta?.unit);

        const payload = PayloadUtils.createScalar(val, extractedUnit);
        return {
            ...payload,
            meta: { ...payload.meta, ...original.meta, unit: extractedUnit }
        };
    },
    'IN-02': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const math = InputOutputEngine.getInstance().getMathInstance();
        const original = node.value || PayloadUtils.createScalar(0);
        // Fix: Support both 'value' and 'val'
        const rawVal = data.value ?? data.val;
        let val = rawVal !== undefined ? (PayloadUtils.unwrap(rawVal) as number) : PayloadUtils.unwrap(original);

        // Support precision rounding for Slider node
        const rawPrecision = data.precision ?? data.accuracy;
        const precision = rawPrecision !== undefined ? Number(rawPrecision) : -1;

        if (precision >= 0) {
            try { val = math.round(val, precision); } catch (e) { }
        }

        const extractedUnit = (rawVal && typeof rawVal === 'object' && (rawVal as any).meta?.unit) || (data.unit as string) || (original.meta?.unit);

        const payload = PayloadUtils.createScalar(val, extractedUnit);
        return {
            ...payload,
            meta: { ...payload.meta, ...original.meta, unit: extractedUnit }
        };
    },
    'IN-04': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const original = node.value || PayloadUtils.createString('');
        const rawVal = PayloadUtils.unwrap(data.value ?? data.val);
        let val = rawVal !== undefined ? rawVal : PayloadUtils.unwrap(original);
        const meta = { ...original.meta } as any;
        if (data.unit) meta.unit = String(data.unit);
        return {
            ...PayloadUtils.createString(String(val ?? '')),
            meta
        };
    },
    'OT-01': (node, inputs) => {
        const payload = inputs['in_a'] || PayloadUtils.createScalar(0);
        const data = (node.data || {}) as Record<string, unknown>;
        const precision = data.precision as number | undefined;

        if (precision !== undefined && (payload.type === DataType.Scalar || payload.type === DataType.Array)) {
            const math = InputOutputEngine.getInstance().getMathInstance();
            const val = PayloadUtils.unwrap(payload);
            try {
                const hydrated = PayloadUtils.hydrate(val, math);
                // Fix: Handle plain Arrays as well as mathjs objects
                const rounded = (typeof hydrated === 'number' || Array.isArray(hydrated) || (hydrated && typeof hydrated === 'object' && ((hydrated as any).isBigNumber || (hydrated as any).isFraction || (hydrated as any).isComplex || (hydrated as any).isMatrix)))
                    ? math.round(hydrated, precision)
                    : hydrated;

                const wrapped = PayloadUtils.wrap(rounded);
                return {
                    ...wrapped,
                    meta: { ...payload.meta, ...wrapped.meta }
                };
            } catch (e: any) {
                console.error(`[OT-01] Precision Failed: ${e.message}`, { val, precision });
                return payload;
            }
        }

        return payload;
    },
    'IN-07': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;

        // 1. Check direct 'value' (from Parser or Stepwise propagation)
        const dataVal = data.value;
        if (dataVal !== undefined) {
            return PayloadUtils.createArray(dataVal);
        }

        // 2. Check 'array' property (Legacy or Positional Data)
        const raw = data.array;
        if (raw !== undefined) {
            return PayloadUtils.createArray(raw);
        }

        // 3. Fallback to node.value (Stale cache)
        if (node.value && typeof node.value === 'object' && ('type' in node.value)) {
            return node.value as any;
        }

        // 4. Ultimate Fallback: Default 3x3 Zero Matrix
        return PayloadUtils.createArray([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    },
    'IN-03': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const rawValue = data.value ?? data.val;

        // Priority: Static UI Value (data.value) -> Stale Cache (node.value) -> Default Blue
        const source = rawValue ?? node.value ?? '#3b82f6';

        const depth = (data.depth as string) || '8bit';
        return ColorUtils.standardize(source, depth);
    },
    // TR-07 is now redundant and has been merged into IN-03.
    // Logic extracted to ColorUtils.ts for better reuse.
    'UT-03': (node, inputs) => {
        return inputs['in_a'] || PayloadUtils.createArray([]);
    },
    'IN-08': (node) => {
        let total = 0;
        const digits = (node.data?.array as number[]) || [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < digits.length; i++) {
            total = total * 10 + digits[i];
        }
        return PayloadUtils.createScalar(total);
    },
    'OT-03': (node, inputs) => {
        // OT-03: Graph Plot — Pure engine sampling.
        // Receives capsule inputs, runs sampling, returns computed plotPoints in meta.
        const data = (node.data || {}) as Record<string, unknown>;
        const minX = typeof data.minX === 'number' ? data.minX : -10;
        const maxX = typeof data.maxX === 'number' ? data.maxX : 10;
        const pointsCount = typeof data.points === 'number' ? data.points : 100;

        const rawInput = inputs['in_a'];

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
                // Enhancement: Unified formula extraction from symbol tree or value
                const activeFormula = PayloadUtils.extractExprStr(p);

                if (activeFormula && (p.type === DataType.Symbolic || p.type === DataType.Scalar)) {
                    pts = PlottingUtils.generateSymbolicPoints(activeFormula, minX, maxX, pointsCount);
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
            value: {
                points: allPoints,
                formula: payloadList[0]?.symbol?.value || payloadList[0]?.value || '',
                label: payloadList[0]?.meta?.label || 'Series 1'
            },
            symbol: null,
            meta: {
                plotPoints: allPoints,
                plotErrors: errors,
            }
        };
    },
    'OT-02': (node, inputs) => {
        const input = inputs['in_a'];
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

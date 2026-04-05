import { NerdamerService } from '../engine/calculus/NerdamerService';

export type PlotPoint = { x: number; y: number | null; size?: number; u?: number; v?: number; z?: number };

export class PlottingUtils {
    static generateSymbolicPoints(
        formula: string,
        minX: number,
        maxX: number,
        points: number
    ): PlotPoint[] {
        const step = points > 1 ? (maxX - minX) / (points - 1) : 0;
        const result: PlotPoint[] = [];

        const svc = NerdamerService.getInstance();

        let targetVar = 'x';
        let isXFunctionOfY = false;
        let isParametric = false;
        let expressionToCompile = formula;
        let expressionY = '';

        const cleanFormula = formula.trim();

        // Upgrade: Detect Parametric [x(t), y(t)] or (x(t), y(t))
        if (cleanFormula.startsWith('[') && cleanFormula.endsWith(']')) {
            const inner = cleanFormula.substring(1, cleanFormula.length - 1);
            const parts = inner.split(',');
            if (parts.length === 2) {
                expressionToCompile = parts[0].trim();
                expressionY = parts[1].trim();
                isParametric = true;
                targetVar = 't';
            }
        }

        if (!isParametric && formula.includes('=')) {
            const parts = formula.split('=');
            if (parts.length === 2) {
                const lhs = parts[0].trim();
                const rhs = parts[1].trim();

                if (lhs === 'y') {
                    expressionToCompile = rhs;
                    targetVar = 'x';
                } else if (lhs === 'x') {
                    expressionToCompile = rhs;
                    targetVar = 'y';
                    isXFunctionOfY = true;
                } else if (rhs === 'y') {
                    expressionToCompile = lhs;
                    targetVar = 'x';
                } else if (rhs === 'x') {
                    expressionToCompile = lhs;
                    targetVar = 'y';
                    isXFunctionOfY = true;
                }
            }
        }

        const vars = isParametric
            ? [...svc.getVariables(expressionToCompile), ...svc.getVariables(expressionY)]
            : svc.getVariables(expressionToCompile);

        // Prioritize target variable mapping
        let orderedVars = [targetVar];
        for (const v of vars) {
            if (v !== targetVar && !orderedVars.includes(v)) orderedVars.push(v);
        }

        const fnX = svc.compileToFunction(expressionToCompile, orderedVars);
        const fnY = isParametric ? svc.compileToFunction(expressionY, orderedVars) : null;

        // For parametric, we usually want 0 to 2*PI if not specified
        const start = isParametric ? 0 : minX;
        const end = isParametric ? Math.PI * 2 : maxX;
        const rangeStep = points > 1 ? (end - start) / (points - 1) : 0;

        for (let i = 0; i < points; i++) {
            const tVal = start + i * rangeStep;

            // Build scope object
            const scope: Record<string, number> = { [targetVar]: tVal };
            for (const v of orderedVars) {
                if (v !== targetVar) scope[v] = 0;
            }

            let x: any;
            let y: any;
            try {
                if (isParametric) {
                    x = fnX(scope);
                    y = fnY!(scope);
                } else {
                    const independentVal = tVal;
                    const dependentVal = fnX(scope);
                    if (isXFunctionOfY) {
                        x = dependentVal;
                        y = independentVal;
                    } else {
                        x = independentVal;
                        y = dependentVal;
                    }
                }
            } catch (e) {
                x = NaN;
                y = NaN;
            }

            const cleanX = typeof x === 'number' && Number.isFinite(x) ? x : null;
            const cleanY = typeof y === 'number' && Number.isFinite(y) ? y : null;

            result.push({ x: cleanX as any, y: cleanY as any });
        }

        return result;
    }

    /**
     * 1.3 Adapter Mapping
     * Covers Scalar, Nx1, Nx2, and Nx3 data formats
     */
    static mapDataPayload(data: any): PlotPoint[] {
        if (typeof data === 'number') {
            return [{ x: 0, y: Number.isFinite(data) ? data : null }];
        }

        let arr: any[] = [];
        if (!data) return [];

        // 1. Handle Hydrated MathJS Matrix
        if (typeof data.toArray === 'function') {
            arr = data.toArray();
        }
        // 2. Handle Dehydrated MathJS Matrix
        else if (data.mathjs === 'Matrix' && Array.isArray(data.data)) {
            arr = data.data;
        }
        // 3. Handle data directly (some payloads wrap it differently)
        else if (data.data && Array.isArray(data.data)) {
            arr = data.data;
        }
        // 4. Handle Plain Array
        else if (Array.isArray(data)) {
            arr = data;
        }
        // 4. Handle wrapped value (Payload.value)
        else if (data.value && (Array.isArray(data.value) || (typeof data.value === 'object' && ('mathjs' in data.value || 'data' in data.value || typeof data.value.toArray === 'function')))) {
            return this.mapDataPayload(data.value);
        }
        else {
            return [];
        }

        if (arr.length === 0) return [];

        // Helper to robustly convert anything to number
        const toNum = (v: any): number | null => {
            if (v && typeof v === 'object') {
                if (v.mathjs === 'BigNumber') return Number(v.value);
                if (v.mathjs === 'Fraction') return Number(v.n) / Number(v.d);
                if (v.value !== undefined) return toNum(v.value);
            }
            const num = (typeof v === 'number') ? v : Number(v);
            return (isNaN(num) || !Number.isFinite(num)) ? null : num;
        };

        // Determine if it's 1D [1, 2, 3] or 2D [[1], [2]] or [[1,2], [3,4]]
        // If it's a 1D vector of objects (e.g. BigNumbers), it should still be treated as 1D
        const firstElem = arr[0];
        const is2D = Array.isArray(firstElem);

        if (!is2D) {
            // Array 1xN or index-based [1, 2, 3, ...]
            return arr.map((val, idx) => {
                const v = toNum(val);
                return { x: idx, y: v };
            });
        }

        // Matrix NxM (2D Array)
        return arr.map((row: any[], idx) => {
            // Nx1 fallback: If row only has one element [[y1], [y2], ...], map to (index, y)
            if (row.length === 1) {
                const y = toNum(row[0]);
                return { x: idx, y };
            }

            // Nx2 / Nx3 / Nx4 / Nx5 handling
            const xVal = toNum(row[0]);
            const yVal = toNum(row[1]);

            const x = xVal !== null ? xVal : idx;
            const y = yVal;

            const point: PlotPoint = { x, y };

            // Z is scalar, fallback size
            if (row.length === 3) {
                const sizeVal = toNum(row[2]);
                point.size = sizeVal !== null ? sizeVal : 0;
            }

            if (row.length >= 4) {
                const uVal = toNum(row[2]);
                const vVal = toNum(row[3]);
                point.u = uVal !== null ? uVal : 0;
                point.v = vVal !== null ? vVal : 0;
            }

            if (row.length >= 5) {
                const zVal = toNum(row[4]);
                point.z = zVal !== null ? zVal : 0;
            }

            return point;
        });
    }
}


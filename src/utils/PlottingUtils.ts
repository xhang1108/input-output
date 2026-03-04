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
        let expressionToCompile = formula;

        if (formula.includes('=')) {
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

        const vars = svc.getVariables(expressionToCompile);

        // Prioritize target variable mapping
        let orderedVars = [targetVar];
        for (const v of vars) {
            if (v !== targetVar) orderedVars.push(v);
        }

        const fn = svc.compileToFunction(expressionToCompile, orderedVars);

        for (let i = 0; i < points; i++) {
            const independentVal = minX + i * step;

            // Build scope object
            const scope: Record<string, number> = { [targetVar]: independentVal };
            for (const v of orderedVars) {
                if (v !== targetVar) scope[v] = 0; // Map unassigned vars to 0
            }

            let dependentVal: any;
            try {
                dependentVal = fn(scope);
            } catch (e) {
                console.error('[PlottingUtils] fn execution error:', e);
                dependentVal = NaN;
            }

            // 1.2 Asymptote Handling (detect infinity/NaN)
            if (typeof dependentVal !== 'number' || !Number.isFinite(dependentVal)) {
                dependentVal = null;
            }

            if (isXFunctionOfY) {
                result.push({ x: dependentVal, y: independentVal });
            } else {
                result.push({ x: independentVal, y: dependentVal });
            }
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
            // Matrix 1xN or index-based [1, 2, 3, ...]
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

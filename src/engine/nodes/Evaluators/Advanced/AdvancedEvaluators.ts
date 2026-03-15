import { InputOutputEngine } from '../../../InputOutputEngine';
import { DataType, NodePayload } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeEvaluator } from '../../../NodeRegistry';
import { NerdamerService } from '../../../calculus/NerdamerService';
import { RuntimeGuard } from '../../../calculus/RuntimeGuard';



export const AdvancedEvaluators: Record<string, NodeEvaluator> = {
    'DT-01': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        let items: any[] = [];

        // Support IOGL 2.0 Capsule handles: 'in', 'append', or numerical suffixes '[0]', '[1]'
        // Also support 'in_0', 'in_1' for legacy nodes
        Object.keys(inputs).sort((a, b) => {
            // Sort by numerical suffix if available: [0], [1]...
            const aNum = parseInt(a.match(/\d+/)?.[0] || '999');
            const bNum = parseInt(b.match(/\d+/)?.[0] || '999');
            return aNum - bNum;
        }).forEach(key => {
            const val = inputs[key];
            if (!val) return;

            // If it's a multi-link input (Array of payloads)
            if (Array.isArray(val)) {
                val.forEach(p => items.push(PayloadUtils.hydrate(PayloadUtils.unwrap(p), math)));
            } else {
                items.push(PayloadUtils.hydrate(PayloadUtils.unwrap(val), math));
            }
        });

        return PayloadUtils.createArray(items);
    },

    // DT-02: Array Extract
    'DT-02': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const index = Number(data.index || 0);
        const inPayload = inputs['in'];
        if (!inPayload) return PayloadUtils.createError('No Input');
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(inPayload), math);
        const arr = (hydrated && typeof hydrated === 'object' && 'toArray' in hydrated ? (hydrated as any).toArray() : Array.isArray(hydrated) ? hydrated : [hydrated]).flat(Infinity);
        return PayloadUtils.createScalar(PayloadUtils.dehydrate(arr[index] ?? 0));
    },

    // DT-03: List Utility
    'DT-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any, mode = data.mode || 'Sort (Asc)';
        const valPayload = inputs['data'] || inputs['in'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        let arr: any[] = (hydrated && typeof hydrated === 'object' && 'toArray' in (hydrated as any)) ? (hydrated as any).toArray().flat(Infinity) : (Array.isArray(hydrated) ? hydrated.flat(Infinity) : [hydrated]);
        if (arr.length === 0) return PayloadUtils.createArray([]);
        let result = [...arr];
        if (mode === 'Sort (Asc)') result.sort((a, b) => Number(a) - Number(b));
        else if (mode === 'Sort (Desc)') result.sort((a, b) => Number(b) - Number(a));
        else if (mode === 'Reverse') result.reverse();
        else if (mode === 'Unique') result = PayloadUtils.deduplicateResults(result);
        else if (mode === 'Clean') result = result.filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
        return PayloadUtils.createArray(PayloadUtils.dehydrate(result));
    },

    // DT-04: Set Operations
    'DT-04': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const mode = ((node.data || {}) as any).mode || 'Union';
        const getArr = (key: string) => {
            const p = inputs[key]; if (!p) return [];
            const h = PayloadUtils.hydrate(PayloadUtils.unwrap(p), math) as any;
            return (h && typeof h === 'object' && 'toArray' in h) ? h.toArray().flat(Infinity) : (Array.isArray(h) ? h : [h]);
        };
        const setA = new Set<string>(getArr('a').map((x: any) => String(x)));
        const setB = new Set<string>(getArr('b').map((x: any) => String(x)));
        let resultSet: string[] = [];
        if (mode === 'Union') resultSet = Array.from(new Set<string>([...Array.from(setA), ...Array.from(setB)]));
        else if (mode === 'Intersection') resultSet = Array.from(setA).filter((x: string) => setB.has(x));
        else if (mode === 'Difference') resultSet = Array.from(setA).filter((x: string) => !setB.has(x));
        const final = resultSet.map((x: string) => (isNaN(Number(x)) ? x : Number(x)));
        return PayloadUtils.createArray(final);
    },

    // DT-07: Matrix Tools
    'DT-07': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const data = (node.data || {}) as any, op = data.op || 'INV';
        try {
            const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
            let result: any;
            if (op === 'INV') result = math.inv(hydrated);
            else if (op === 'DET') result = math.det(hydrated);
            else if (op === 'TRANSPOSE') result = math.transpose(hydrated);
            else if (op === 'TRACE') result = math.trace(hydrated);
            else if (op === 'EIGEN') result = math.eigs(hydrated).values;
            else if (op === 'LUP') result = math.lup(hydrated).P;
            else if (op === 'QR') result = math.qr(hydrated).Q;
            else result = hydrated;
            return (Array.isArray(result) || result?.isMatrix) ? PayloadUtils.createArray(result) : PayloadUtils.createScalar(result);
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },

    // DT-05: Vector Utils
    'DT-05': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'DOT';
        const valA = inputs['in_a'], valB = inputs['in_b'];
        if (!valA || !valB) return PayloadUtils.createError('Missing Inputs');
        try {
            const hA = PayloadUtils.hydrate(PayloadUtils.unwrap(valA), math), hB = PayloadUtils.hydrate(PayloadUtils.unwrap(valB), math);

            // Auto-flatten Rank-2 "vectors" (e.g. [[1,2,3]]) to Rank-1 for mathjs compatibility
            const flattenIfNeeded = (h: any) => {
                // Handle mathjs Matrix
                if (h && typeof h === 'object' && h.isMatrix && h.size().length === 2) {
                    const size = h.size();
                    if (size[0] === 1 || size[1] === 1) return (h as any).toArray().flat(Infinity);
                }
                // Handle plain JS Array (the one mathjs dot logic often receives)
                if (Array.isArray(h)) {
                    // Row vector [[1, 2, 3]] -> [1, 2, 3]
                    if (h.length === 1 && Array.isArray(h[0])) return h[0];
                    // Column vector [[1], [2], [3]] -> [1, 2, 3]
                    if (h.length > 1 && Array.isArray(h[0]) && h[0].length === 1) return h.map(r => r[0]);
                }
                return h;
            };

            const vA = flattenIfNeeded(hA), vB = flattenIfNeeded(hB);
            let result: any;
            if (op === 'DOT') {
                if (Array.isArray(vA) && Array.isArray(vB)) {
                    // Force manual dot product for arrays to bypass mathjs dimensionality errors
                    result = vA.reduce((sum, val, i) => sum + (val * (vB[i] || 0)), 0);
                } else {
                    result = math.dot(vA, vB);
                }
            }
            else if (op === 'CROSS') result = math.cross(vA, vB);
            else if (op === 'NORM') result = math.norm(vA);
            else if (op === 'DISTANCE') result = math.distance(vA, vB);
            else result = math.dot(vA, vB);
            return (Array.isArray(result) || result?.isMatrix) ? PayloadUtils.createArray(result) : PayloadUtils.createScalar(result);
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },

    // MA-15: Combinatorics (Mapping from registration if needed, or keeping for internal)
    'AD-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'nCr';
        const valN = inputs['in_n'], valR = inputs['in_r'];
        if (!valN || !valR) return PayloadUtils.createError('Missing Inputs');
        try {
            const n = PayloadUtils.unwrap(valN), r = PayloadUtils.unwrap(valR);
            let result: any;
            if (op === 'nCr') result = math.combinations(n, r);
            else if (op === 'nPr') result = math.permutations(n, r);
            else if (op === 'STIRLING2') result = math.stirlingS2(n, r);
            else if (op === 'BELL') result = math.bellNumbers(n);
            else if (op === 'CATALAN') result = math.catalan(n);
            else result = math.combinations(n, r);
            return PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },

    // CL-01: Derivative
    'CL-01': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', order = Number(data.order) || 1;
        const exprStr = PayloadUtils.extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        try {
            const svc = NerdamerService.getInstance();
            return PayloadUtils.createSymbolic(svc.differentiate(exprStr, variable, order).text());
        } catch (e: any) { return PayloadUtils.createError(`Diff Failed: ${e.message}`); }
    },

    // CL-02: Integral
    'CL-02': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', mode = data.mode || 'indefinite', lower = data.lower || '', upper = data.upper || '';
        const exprStr = PayloadUtils.extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        try {
            const svc = NerdamerService.getInstance();
            if (mode === 'definite') {
                const res = RuntimeGuard.safeEvaluate(() => svc.definiteIntegral(exprStr, variable, lower, upper));
                if (res.ok) {
                    const text = (res.value as any).text('decimals');
                    const num = Number(text);
                    return (!isNaN(num) && isFinite(num)) ? PayloadUtils.createScalar(num) : PayloadUtils.createSymbolic(text);
                }
                return PayloadUtils.createError(res.error || 'Integral Failed');
            }
            return PayloadUtils.createSymbolic(svc.integrate(exprStr, variable).text());
        } catch (e: any) { return PayloadUtils.createError(`Integral Failed: ${e.message}`); }
    },

    // CL-04: Solver
    'CL-04': (node, inputs) => {
        const equations: string[] = [];
        const data = (node.data || {}) as any;
        let targetVar = data.variable || data.solveFor || '';

        // 1. Collect equations from ALL handles (Capsule support)
        const processPayload = (payload: any, key: string) => {
            if (!payload) return;

            // Handle Array of Payloads (Capsule behavior)
            if (Array.isArray(payload)) {
                payload.forEach(p => processPayload(p, key));
                return;
            }

            const raw = PayloadUtils.unwrap(payload);
            const items = Array.isArray(raw) ? raw.map(String) : [String(raw)];

            items.forEach(val => {
                if (val === null || val === undefined) return;
                const valStr = String(val).trim();
                
                if (!valStr || valStr === 'null' || valStr === 'undefined' || valStr === '[object Object]') return;

                // Priority 1: Use explicit label from metadata (if node is labeled)
                const label = payload.meta?.label;
                
                // If it's a numeric/string scalar and has a label, convert to equation
                if (label && typeof label === 'string' && !valStr.includes('=') && !['in', 'expr', 'in_a', 'in_b'].includes(label)) {
                    equations.push(`${label} = ${valStr}`);
                } 
                // Priority 2: Use key if it's not a generic handle (wireless links using node label)
                else if (!key.startsWith('in') && !key.startsWith('append') && !valStr.includes('=')) {
                    equations.push(`${key} = ${valStr}`);
                }
                else {
                    equations.push(valStr);
                }
            });
        };

        Object.keys(inputs).sort().forEach(key => processPayload(inputs[key], key));

        if (equations.length === 0) {
            // Fallback to static expression from node.data
            const expr = (node.data as any)?.expression;
            if (expr) equations.push(expr);
        }

        if (equations.length === 0) return PayloadUtils.createError('No Equations');

        // 1. Unicode Case Warning: detect non-ASCII characters often used in math (², ×, −, etc.)
        const hasUnicode = equations.some(eq => /[^\x00-\x7F]/.test(eq));
        if (hasUnicode) {
            return PayloadUtils.createError('Unicode detected: Please use standard ASCII (e.g., x^2 instead of x², * for multiply, - for minus)');
        }

        try {
            const svc = NerdamerService.getInstance();
            const nerd = svc.getNerdamer();

            // ─── Phase 1: Iteratively extract scalar assignments into scope ───
            // e.g., "V=12" → scope["V"] = "12"
            // Handles expressions like "R=4" or "4=R"
            let remainingEqs = [...equations];
            const scope: Record<string, string> = {};
            let changed = true;

            while (changed) {
                changed = false;
                const next: string[] = [];
                for (const eq of remainingEqs) {
                    if (typeof eq !== 'string') continue;
                    const parts = eq.split('=').map(s => s.trim());
                    if (parts.length === 2) {
                        const [lhs, rhs] = parts;
                        if (/^[a-zA-Z_]\w*$/.test(lhs) && !isNaN(Number(rhs))) {
                            scope[lhs] = rhs; changed = true; continue;
                        }
                        if (/^[a-zA-Z_]\w*$/.test(rhs) && !isNaN(Number(lhs))) {
                            scope[rhs] = lhs; changed = true; continue;
                        }
                    }
                    next.push(eq);
                }
                remainingEqs = next;
            }

        // ─── Phase 2: Substitute scope into remaining equations ──────────
        const prepareExpr = (eq: string) => {
            const trimmed = eq.trim();
            if (!trimmed.includes('=')) return trimmed;
            const [lhs, rhs] = trimmed.split('=').map(s => s.trim());
            return `(${lhs}) - (${rhs})`;
        };

        // If targetVar is already in the scope, we're done immediately
        if (targetVar && scope[targetVar] !== undefined) {
            const val = Number(scope[targetVar]);
            return !isNaN(val)
                ? PayloadUtils.createArray([val])
                : PayloadUtils.createArray([scope[targetVar]]);
        }

        // Substitute all known scope values into remaining equations
        const substituted: string[] = remainingEqs.map(eq => {
            let expr = prepareExpr(eq);
            for (const [varName, value] of Object.entries(scope)) {
                try { expr = nerd(expr).sub(varName, value).toString(); }
                catch { /* ignore */ }
            }
            return expr;
        });

        // Also include the original standardized equations in case no substitution was needed
        const standardized: string[] =
            substituted.length > 0 ? substituted : equations.map(prepareExpr);

        // ─── Phase 3: Collect variables, auto-detect target, solve ────────
        const allVars = new Set<string>();
        standardized.forEach(eq => {
            try { nerd(eq).variables().forEach((v: string) => allVars.add(v)); }
            catch { /* ignore */ }
        });

        if (!targetVar) {
            const assignedConst = new Set<string>(Object.keys(scope));
            const allVarsArr = Array.from(allVars);
            const freeVars = allVarsArr.filter(v => !assignedConst.has(v));
            targetVar = freeVars.length > 0 ? freeVars[0] : (allVarsArr[0] || 'x');
        } else {
            allVars.add(targetVar);
        }

        const varList = Array.from(allVars);

        let resultObj: any;
        if (standardized.length === 0) {
            return PayloadUtils.createError('No solvable equations after substitution');
        } else if (standardized.length === 1) {
            resultObj = nerd(`solve(${standardized[0]}, ${targetVar})`);
        } else {
            const systemResults = nerd.solveEquations(standardized, varList);
            if (Array.isArray(systemResults)) {
                const match = systemResults.find((r: any) => Array.isArray(r) && r[0] === targetVar);
                resultObj = match ? nerd(match[1]) : nerd('[]');
            } else {
                resultObj = nerd(systemResults);
            }
        }

            if (!resultObj) return PayloadUtils.createError('No Result');
            const textResult = String(resultObj);

            // ─── Smart Result Formatter ─────────────────────────────────────
            /**
             * Converts a nerdamer result token to the best display value:
             * - If it evaluates to an integer → keep as integer
             * - If it's a simple fraction of large integers (rational approx) → convert to decimal
             * - If it's a symbolic expression (contains vars/i) → keep as string
             */
            const formatToken = (tok: string): string | number => {
                const trimmed = tok.trim();
                if (!trimmed) return trimmed;

                // Contains alphabetic chars (symbolic/complex) — keep as-is
                if (/[a-zA-Z]/.test(trimmed)) return trimmed;

                try {
                    const num = Number(nerd(trimmed).evaluate().text('decimals'));
                    if (isNaN(num) || !isFinite(num)) return trimmed;
                    // If it's effectively an integer, return the integer
                    if (Math.abs(num - Math.round(num)) < 1e-9) return Math.round(num);
                    // Otherwise round to 8 significant figures
                    return parseFloat(num.toPrecision(8));
                } catch {
                    return trimmed;
                }
            };

            // Parse the result string into tokens
            let tokens: (string | number)[] = [];
            if (textResult.startsWith('[') && textResult.endsWith(']')) {
                const content = textResult.slice(1, -1).trim();
                if (!content) return PayloadUtils.createArray([]);
                tokens = content.split(',').map(formatToken);
            } else if (textResult) {
                tokens = [formatToken(textResult)];
            }

            if (tokens.length === 0) return PayloadUtils.createArray([]);
            
            // Apply deduplication (epsilon-based) and sort by absolute value
            const finalTokens = PayloadUtils.deduplicateResults(tokens)
                .sort((a, b) => Math.abs(Number(a)) - Math.abs(Number(b)))
                .slice(0, 6); // MAX_SOLUTIONS = 6

            return PayloadUtils.createArray(finalTokens);
        } catch (e: any) { 
            return PayloadUtils.createError(`Solve Failed: ${e.message}`); 
        }
    },


    // TR-04: Vector Field
    'TR-04': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const mode = data.mode || 'gradient', var1 = data.var1 || 'x', var2 = data.var2 || 'y';
        const exprStr = PayloadUtils.extractExprStr(inputs['in_f']);
        if (!exprStr) return PayloadUtils.createError('No Function Input');
        try {
            const svc = NerdamerService.getInstance();
            if (mode === 'gradient') {
                const dx = svc.differentiate(exprStr, var1).text(), dy = svc.differentiate(exprStr, var2).text();
                return PayloadUtils.createArray([dx, dy]);
            }
            if (mode === 'divergence') {
                const p = PayloadUtils.extractExprStr(inputs['in_p']), q = PayloadUtils.extractExprStr(inputs['in_q']);
                if (!p || !q) return PayloadUtils.createError('Missing P/Q components');
                const dp = svc.differentiate(p, var1).text(), dq = svc.differentiate(q, var2).text();
                return PayloadUtils.createSymbolic(`(${dp})+(${dq})`);
            }
            if (mode === 'curl') {
                const p = PayloadUtils.extractExprStr(inputs['in_p']), q = PayloadUtils.extractExprStr(inputs['in_q']);
                if (!p || !q) return PayloadUtils.createError('Missing P/Q components');
                const dq_dx = svc.differentiate(q, var1).text(), dp_dy = svc.differentiate(p, var2).text();
                return PayloadUtils.createSymbolic(`(${dq_dx})-(${dp_dy})`);
            }
            return PayloadUtils.createError('Unsupported Mode');
        } catch (e: any) { return PayloadUtils.createError(`VectorField Failed: ${e.message}`); }
    },

    // DT-06: Vector Split
    'DT-06': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any, mode = data.mode || 'separate';
        if (mode === 'separate') {
            const inPayload = inputs['in'] || inputs['in_v'];
            if (!inPayload) return PayloadUtils.createError('No Input');
            const h = PayloadUtils.hydrate(PayloadUtils.unwrap(inPayload), math);
            const arr = (h && typeof h === 'object' && (h as any).toArray ? (h as any).toArray() : Array.isArray(h) ? h : [h]).flat(Infinity);
            return {
                type: DataType.Array,
                value: {
                    x: PayloadUtils.dehydrate(arr[0] ?? 0),
                    y: PayloadUtils.dehydrate(arr[1] ?? 0),
                    z: PayloadUtils.dehydrate(arr[2] ?? 0),
                    w: PayloadUtils.dehydrate(arr[3] ?? 0)
                },
                symbol: null,
                meta: {}
            };
        } else {
            const x = PayloadUtils.unwrap(inputs['in_x'] || inputs['x'] || PayloadUtils.createScalar(0));
            const y = PayloadUtils.unwrap(inputs['in_y'] || inputs['y'] || PayloadUtils.createScalar(0));
            const z = PayloadUtils.unwrap(inputs['in_z'] || inputs['z'] || PayloadUtils.createScalar(0));
            const w = PayloadUtils.unwrap(inputs['in_w'] || inputs['w'] || PayloadUtils.createScalar(0));
            return PayloadUtils.createArray([x, y, z, w]);
        }
    },

    // TR-03: Geometry
    'TR-03': (node, inputs) => {
        const data = (node.data || {}) as any, shape = data.shape || 'Circle';
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const getNum = (key: string) => Number(PayloadUtils.unwrap(inputs[key] || PayloadUtils.createScalar(0)));
        const a = getNum('in_a'), b = getNum('in_b');
        let area = 0, perimeter = 0;
        if (shape === 'Circle') { area = Math.PI * a * a; perimeter = 2 * Math.PI * a; }
        else if (shape === 'Quad') { area = a * b; perimeter = 2 * (a + b); }
        else if (shape === 'Triangle') { area = 0.5 * a * b; perimeter = a + b + Math.sqrt(a * a + b * b); }
        return {
            type: DataType.Array,
            value: { area: PayloadUtils.dehydrate(area), perimeter: PayloadUtils.dehydrate(perimeter) },
            symbol: null,
            meta: {}
        };
    },

    'CL-03': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x', approach = data.approach || '0', direction = data.direction || 'both';
        const exprStr = PayloadUtils.extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        try {
            const svc = NerdamerService.getInstance();
            const result = RuntimeGuard.safeEvaluate(() => svc.limit(exprStr, variable, approach));
            if (result.ok) {
                const text = result.value.text('decimals'), num = Number(text);
                if (!isNaN(num) && isFinite(num)) {
                    if (direction === 'both' && !isNaN(Number(approach))) {
                        const compiled = svc.compileToFunction(exprStr, [variable]);
                        const a = Number(approach);
                        if (Math.abs(Number(compiled({ [variable]: a - 1e-8 })) - Number(compiled({ [variable]: a + 1e-8 }))) > 0.01) return PayloadUtils.createError('Limit DNE');
                    }
                    return PayloadUtils.createScalar(num);
                }
                return PayloadUtils.createSymbolic(text);
            }
            return RuntimeGuard.evaluateToPayload(() => {
                const compiled = svc.compileToFunction(exprStr, [variable]), a = Number(approach);
                return direction === 'left' ? compiled({ [variable]: a - 1e-10 }) : compiled({ [variable]: a + 1e-10 });
            }, (v: any) => PayloadUtils.wrap(v));
        } catch (e: any) { return PayloadUtils.createError(`Limit Failed: ${e.message}`); }
    },

    // CL-05: ODE Solver
    'CL-05': (node, inputs) => {
        const data = (node.data || {}) as any;
        const t0 = Number(data.t0) || 0;
        const tEnd = Number(data.tEnd) || 1;
        const y0 = Number(data.y0) || 1;
        const stepSize = Number(data.stepSize) || 0.01;
        const exprStr = PayloadUtils.extractExprStr(inputs['expr']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        try {
            const svc = NerdamerService.getInstance();
            const compiled = svc.compileToFunction(exprStr, ['t', 'y']);
            const results: number[][] = [[t0, y0]];
            let t = t0, y = y0, steps = 0, maxSteps = 10000;
            while (t < tEnd && steps < maxSteps) {
                const h = Math.min(stepSize, tEnd - t);
                const k1 = Number(compiled({ t, y }));
                const k2 = Number(compiled({ t: t + h / 2, y: y + h * k1 / 2 }));
                const k3 = Number(compiled({ t: t + h / 2, y: y + h * k2 / 2 }));
                const k4 = Number(compiled({ t: t + h, y: y + h * k3 }));
                y = y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
                t = t + h; steps++;
                if (!isFinite(y) || Math.abs(y) > 1e15) return PayloadUtils.createError(`ODE diverged at t=${t.toFixed(4)}`);
                results.push([parseFloat(t.toFixed(10)), y]);
            }
            return PayloadUtils.createArray(results as any);
        } catch (e: any) { return PayloadUtils.createError(`ODE Failed: ${e.message}`); }
    },

    // IN-09: Expert Node (Expression)
    'IN-09': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const code = String(data.code || '');
        if (!code) return PayloadUtils.createError('No Expression');
        try {
            const svc = NerdamerService.getInstance();
            const result = svc.evaluate(code);
            // result is already a string from svc.evaluate
            return PayloadUtils.createSymbolic(result);
        } catch (e: any) {
            return PayloadUtils.createError(`Eval Failed: ${e.message}`);
        }
    }
};

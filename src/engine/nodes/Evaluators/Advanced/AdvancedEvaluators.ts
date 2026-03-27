import { InputOutputEngine } from '../../../InputOutputEngine';
import { DataType, NodePayload } from '../../../../types/payload';
import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeEvaluator } from '../../../NodeRegistry';
import { NerdamerService } from '../../../calculus/NerdamerService';
import { RuntimeGuard } from '../../../calculus/RuntimeGuard';



export const AdvancedEvaluators: Record<string, NodeEvaluator> = {
    'DT-01': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const axis = Number(data.axis || 0);

        let items: any[] = [];

        const sortKeys = Object.keys(inputs).sort();

        sortKeys.forEach(key => {
            const val = inputs[key];
            if (!val) return;

            if (Array.isArray(val)) {
                val.forEach(p => items.push(PayloadUtils.hydrate(PayloadUtils.unwrap(p), math)));
            } else {
                items.push(PayloadUtils.hydrate(PayloadUtils.unwrap(val), math));
            }
        });

        if (items.length === 0) return PayloadUtils.createArray([]);

        try {
            // Robust Concatenation: Coerce scalars and ensure min-dimensions for the target axis
            const preparedItems = items.map(item => {
                let val = item;
                // If it's already an array or matrix, use it.
                if (!Array.isArray(val) && !(val && val.isMatrix)) {
                    val = [val]; // Coerce scalar to 1D
                }

                // If axis is 1 (Columns) or higher, but value is 1D, promote it to 2D
                // This allows joining scalars/vectors horizontally.
                // e.g. [1, 2] -> [[1, 2]] (row vector)
                if (axis >= 1 && Array.isArray(val) && !Array.isArray(val[0])) {
                    val = [val];
                }

                return val;
            });

            const result = math.concat(...preparedItems, axis);
            return PayloadUtils.createArray(result);
        } catch (e: any) {
            return PayloadUtils.createError(`Join Failed: ${e.message}`);
        }
    },

    // DT-02: Array Extract
    'DT-02': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const mode = data.indexMode || '1D';

        const inPayload = inputs['in_a'];
        const indexPayload = inputs['in_b'];

        if (!inPayload) return PayloadUtils.createError('No Input Vector/Matrix');

        try {
            const arr = PayloadUtils.hydrate(PayloadUtils.unwrap(inPayload), math);
            const idxRaw = indexPayload ? PayloadUtils.hydrate(PayloadUtils.unwrap(indexPayload), math) : 0;

            let result: any;

            // Helper to get raw numeric values from hydrate result (handles mathjs objects)
            const getNumeric = (val: any): number => {
                if (val === null || val === undefined) return 0;
                if (typeof val === 'number') return val;
                if (val.isBigNumber) return val.toNumber();
                if (typeof val === 'string') return parseFloat(val) || 0;
                return 0;
            };

            if (mode === '1D') {
                // 1D: Flat index extraction (1-based from user perspective)
                let flatIdxRaw = 0;
                if (Array.isArray(idxRaw)) flatIdxRaw = getNumeric(idxRaw[0]);
                else if (idxRaw && typeof idxRaw === 'object' && (idxRaw as any).isMatrix) flatIdxRaw = getNumeric((idxRaw as any).get([0]));
                else flatIdxRaw = getNumeric(idxRaw);

                // Convert 1-based to 0-based
                const flatIdx = flatIdxRaw - 1;

                if (arr && typeof arr === 'object' && (arr as any).isMatrix) {
                    const size = (arr as any).size();
                    if (size.length === 1) {
                        result = math.subset(arr, math.index(flatIdx));
                    } else if (size.length === 2) {
                        if (size[0] === 1) result = math.subset(arr, math.index(0, flatIdx));
                        else if (size[1] === 1) result = math.subset(arr, math.index(flatIdx, 0));
                        else result = math.subset(arr, math.index(flatIdx));
                    } else {
                        result = math.subset(arr, math.index(flatIdx));
                    }
                } else {
                    const flatArr = Array.isArray(arr) ? arr : [arr];
                    result = flatArr[flatIdx] ?? 0;
                }
            } else {
                // 2D: [row, col] extraction (1-based from user perspective)
                let rRaw = 0, cRaw = 0;
                if (Array.isArray(idxRaw)) {
                    rRaw = getNumeric(idxRaw[0]);
                    cRaw = getNumeric(idxRaw[1]);
                } else if (idxRaw && typeof idxRaw === 'object' && (idxRaw as any).isMatrix) {
                    const data = (idxRaw as any).toArray().flat(Infinity);
                    rRaw = getNumeric(data[0]);
                    cRaw = getNumeric(data[1]);
                } else {
                    rRaw = getNumeric(idxRaw);
                }

                // Convert 1-based to 0-based
                const r = rRaw - 1;
                const c = cRaw - 1;

                if (arr && typeof arr === 'object' && (arr as any).isMatrix) {
                    result = math.subset(arr, math.index(r, c));
                } else if (Array.isArray(arr)) {
                    result = (arr[r] && Array.isArray(arr[r])) ? arr[r][c] : 0;
                } else {
                    result = 0;
                }
            }

            // Auto-unwrap 1x1 matrix results
            if (result && typeof result === 'object' && (result as any).isMatrix) {
                const size = (result as any).size();
                if (size.every((s: number) => s === 1)) {
                    result = result.get(size.map(() => 0));
                }
            }

            return (Array.isArray(result) || (result && typeof result === 'object' && (result as any).isMatrix))
                ? PayloadUtils.createArray(PayloadUtils.dehydrate(result))
                : PayloadUtils.createScalar(PayloadUtils.dehydrate(result));
        } catch (e: any) {
            return PayloadUtils.createError(`Extract Failed: ${e.message}`);
        }
    },

    // DT-03: List Utility
    'DT-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any, mode = data.mode || 'Sort (Asc)';
        const valPayload = inputs['in_a'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
        let arr: any[] = (hydrated && typeof hydrated === 'object' && 'toArray' in (hydrated as any)) ? (hydrated as any).toArray().flat(Infinity) : (Array.isArray(hydrated) ? hydrated.flat(Infinity) : [hydrated]);
        if (arr.length === 0) return PayloadUtils.createArray([]);
        let result = [...arr];
        const modeLower = mode.toLowerCase();
        if (modeLower.includes('asc')) result.sort((a, b) => Number(a) - Number(b));
        else if (modeLower.includes('desc')) result.sort((a, b) => Number(b) - Number(a));
        else if (modeLower === 'sort') result.sort((a, b) => Number(a) - Number(b));
        else if (modeLower === 'reverse') result.reverse();
        else if (modeLower === 'unique') result = PayloadUtils.deduplicateResults(result);
        else if (modeLower === 'clean') result = result.filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
        return PayloadUtils.createArray(PayloadUtils.dehydrate(result));
    },

    // DT-04: Set Operations
    'DT-04': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const mode = ((node.data || {}) as any).mode || 'Union';
        const getArr = (key: string) => {
            const p = inputs[key]; if (!p) return [];
            const unwrapped = PayloadUtils.unwrap(p);
            // Handle array of values (capsule handle behavior)
            const rawArray = Array.isArray(unwrapped) ? unwrapped.flat(Infinity) : [unwrapped];
            return rawArray.map(v => {
                const h = PayloadUtils.hydrate(v, math);
                return (h && typeof h === 'object' && 'toArray' in h) ? (h as any).toArray().flat(Infinity) : h;
            }).flat(Infinity);
        };
        const setA = new Set<string>(getArr('in_a').map((x: any) => String(x)));
        const setB = new Set<string>(getArr('in_b').map((x: any) => String(x)));
        let resultSet: string[] = [];
        const modeLower = mode.toLowerCase();
        if (modeLower === 'union') resultSet = Array.from(new Set<string>([...Array.from(setA), ...Array.from(setB)]));
        else if (modeLower === 'intersection') resultSet = Array.from(setA).filter((x: string) => setB.has(x));
        else if (modeLower === 'difference') resultSet = Array.from(setA).filter((x: string) => !setB.has(x));
        const final = resultSet.map((x: string) => (isNaN(Number(x)) ? x : Number(x)));
        return PayloadUtils.createArray(final);
    },

    // DT-06: Matrix Tools
    'DT-06': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const valPayload = inputs['in_a'];
        if (!valPayload) return PayloadUtils.createError('No Input');
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'INV';
        try {
            const hydrated = PayloadUtils.hydrate(PayloadUtils.unwrap(valPayload), math);
            let result: any;
            if (op === 'INV') result = math.inv(hydrated);
            else if (op === 'DET') result = math.det(hydrated);
            else if (op === 'TRANSPOSE') result = math.transpose(hydrated);
            else if (op === 'TRACE') result = math.trace(hydrated);
            else if (op === 'EIGEN') result = math.eigs(hydrated);
            else if (op === 'LUP' || op === 'LU') result = math.lup(hydrated);
            else if (op === 'QR') result = math.qr(hydrated);
            else result = hydrated;

            // Handle multi-output objects (QR, LUP, EIGEN)
            if (result && typeof result === 'object' && !Array.isArray(result) && !(result as any).isMatrix && !(result as any).isBigNumber) {
                const multi: Record<string, any> = {};

                // Position-aware mapping for decomposition/spectral results
                if (op === 'QR') {
                    multi.out_a = PayloadUtils.wrap(result.Q);
                    multi.out_b = PayloadUtils.wrap(result.R);
                } else if (op === 'LUP' || op === 'LU') {
                    multi.out_a = PayloadUtils.wrap(result.L);
                    multi.out_b = PayloadUtils.wrap(result.U);
                    if (op === 'LUP') multi.out_c = PayloadUtils.wrap(result.P);
                } else if (op === 'EIGEN') {
                    multi.out_a = PayloadUtils.wrap(result.values);
                    // Extract vectors from {value, vector} objects and join as a matrix
                    const vectors = result.eigenvectors.map((ev: any) => ev.vector);
                    // In mathjs, these are usually 1D. We want them as Columns in a Matrix.
                    multi.out_b = PayloadUtils.wrap(math.transpose(math.matrix(vectors)));
                } else {
                    // Fallback for any other objects
                    for (const [key, val] of Object.entries(result)) {
                        multi[key] = (Array.isArray(val) || (val as any)?.isMatrix)
                            ? PayloadUtils.createArray(PayloadUtils.dehydrate(val))
                            : PayloadUtils.createScalar(PayloadUtils.dehydrate(val));
                    }
                }
                return { type: DataType.Object, value: multi, symbol: null, meta: {} };
            }

            return (Array.isArray(result) || result?.isMatrix) ? PayloadUtils.createArray(result) : PayloadUtils.createScalar(result);
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },

    // DT-05: Vector Utils
    'DT-05': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'DOT';
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
            return (Array.isArray(result) || (result as any)?.isMatrix) ? PayloadUtils.createArray(result) : PayloadUtils.createScalar(result);
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    },

    // MA-15: Combinatorics (Mapping from registration if needed, or keeping for internal)
    'AD-03': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'nCr';
        const valN = inputs['in_a'], valR = inputs['in_b'];
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
        const exprStr = PayloadUtils.extractExprStr(inputs['in_a']);
        if (!exprStr || ['null', 'undefined'].includes(exprStr)) return PayloadUtils.createError('No Expression Input');
        
        try {
            const svc = NerdamerService.getInstance();
            const text = svc.differentiate(exprStr, variable, order).text();
            const num = Number(text);
            return (!isNaN(num) && isFinite(num)) ? PayloadUtils.createScalar(num) : PayloadUtils.createSymbolic(text);
        } catch (e: any) { return PayloadUtils.createError(`Diff Failed: ${e.message}`); }
    },

    // CL-02: Integral
    'CL-02': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x';
        const mode = (data.mode || 'indefinite').toLowerCase();
        const lower = PayloadUtils.unwrap(inputs['in_b']) ?? data.lower ?? '';
        const upper = PayloadUtils.unwrap(inputs['in_c']) ?? data.upper ?? '';
        const exprStr = PayloadUtils.extractExprStr(inputs['in_a']);

        if (!exprStr || ['null', 'undefined'].includes(exprStr)) {
            return PayloadUtils.createError('No Expression Input');
        }
        try {
            const svc = NerdamerService.getInstance();
            if (mode === 'definite') {
                const res = RuntimeGuard.safeEvaluate(() => svc.definiteIntegral(exprStr, String(variable).trim(), String(lower).trim(), String(upper).trim()));
                if (res.ok) {
                    const text = (res.value as any).text('decimals');
                    const num = Number(text);
                    return (!isNaN(num) && isFinite(num)) ? PayloadUtils.createScalar(num) : PayloadUtils.createSymbolic(text);
                }
                return PayloadUtils.createError(res.error || 'Integral Failed');
            }
            const text = svc.integrate(exprStr, variable).text();
            const num = Number(text);
            return (!isNaN(num) && isFinite(num)) ? PayloadUtils.createScalar(num) : PayloadUtils.createSymbolic(text);
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

            const valStr = PayloadUtils.extractExprStr(payload);
            if (!valStr || valStr === 'null' || valStr === 'undefined' || valStr === '[object Object]') return;

            // Priority 1: Use explicit label from metadata (if node is labeled)
            const label = payload.meta?.label;

            // 1. System Handles: Internal position IDs (in_a, in_b...) or technical keys (append_).
            // 2. User Variables: Anything else that looks like a valid math variable (x, apple, Eq).
            const isSystemHandle = (s: string) => /^(in(_[a-z0-9]+)?|expr|append|out(_[a-z0-9]+)?)$/.test(s);
            const isValidMathVar = (s: string) => /^[a-zA-Z_]\w*$/.test(s);

            // Priority 1: Use explicit label from metadata (highest authority)
            if (label && typeof label === 'string' && !valStr.includes('=') && isValidMathVar(label) && !isSystemHandle(label)) {
                equations.push(`${label} = ${valStr}`);
            }
            // Priority 2: Use key if it's not a generic position ID
            else if (!valStr.includes('=') && isValidMathVar(key) && !isSystemHandle(key)) {
                equations.push(`${key} = ${valStr}`);
            }
            else {
                const trimmed = valStr.trim();
                // 💡 Fix: Skip raw numeric scalars without an assignment. 
                // Pushing '6' as an equation makes Nerdamer think '6 = 0', which is a contradiction.
                if (!trimmed.includes('=') && !isNaN(Number(trimmed))) {
                    return; // Ignore raw numeric constants that aren't assigned to a variable
                }
                equations.push(valStr);
            }
        };

        Object.keys(inputs).sort().forEach(key => processPayload(inputs[key], key));

        if (equations.length === 0) {
            // Robust Fallback: Search all inputs for symbolic/string content
            Object.keys(inputs).forEach(key => {
                const p = inputs[key];
                const raw = PayloadUtils.unwrap(p);
                if (typeof raw === 'string' && raw.trim()) {
                    equations.push(raw.trim());
                }
            });
        }

        if (equations.length === 0) {
            // Fallback to static expression from node.data
            const expr = (node.data as any)?.expression;
            if (expr) equations.push(expr);
        }

        if (equations.length === 0) {
            return PayloadUtils.createError('No Equations');
        }

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
                // 💡 Fix: Even early returns must be wrapped in an array for Solver consistency
                const finalVal = !isNaN(val) ? val : String(scope[targetVar]);
                return PayloadUtils.createArray([finalVal]);
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
                if (!trimmed) return '';

                // Contains alphabetic chars (symbolic/complex) — keep as-is, BUT check if it's just 'i'
                if (/[a-zA-Z]/.test(trimmed) && trimmed !== 'i') return trimmed;

                try {
                    // nerdamer evaluate().text('decimals') can return non-numeric strings for complex values
                    const evaluated = nerd(trimmed).evaluate().text('decimals');
                    const num = Number(evaluated);
                    
                    if (isNaN(num) || !isFinite(num)) {
                        // If it's a fraction string like "1/2", try to convert to decimal if it's simple
                        if (trimmed.includes('/')) {
                            const [n, d] = trimmed.split('/').map(Number);
                            if (!isNaN(n) && !isNaN(d) && d !== 0) return parseFloat((n / d).toPrecision(8));
                        }
                        return trimmed;
                    }

                    // If it's effectively an integer, return the integer
                    if (Math.abs(num - Math.round(num)) < 1e-10) return Math.round(num);
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
                .sort((a, b) => {
                    const numA = Number(a);
                    const numB = Number(b);
                    if (isNaN(numA) || isNaN(numB)) return 0;
                    return Math.abs(numA) - Math.abs(numB);
                })
                .slice(0, 6); // MAX_SOLUTIONS = 6

            // 💡 Fix: Equation Solver should ALWAYS return an array of solutions, 
            // even if there is only one root (e.g. [2]). 
            // This ensures consistency for downstream Plot and Result nodes.
            return PayloadUtils.createArray(finalTokens);
        } catch (error: any) {
            console.error('[CL-04] Solve Exception:', error);
            return PayloadUtils.createError(`Solve Failed: ${error.message || String(error)}`);
        }
    },


    // TR-04: Vector Field
    'TR-04': (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const mode = data.mode || 'gradient', var1 = data.var1 || 'x', var2 = data.var2 || 'y';

        try {
            const svc = NerdamerService.getInstance();
            let result: any = null;

            // Helper to sample any two component functions into an NX4 field array
            const sampleField = (fx: (s: any) => number, fy: (s: any) => number) => {
                const samples: any[] = [];
                try {
                    const min = (data.min !== undefined && data.min !== null) ? Number(data.min) : -5;
                    const max = (data.max !== undefined && data.max !== null) ? Number(data.max) : 5;
                    const density = (data.density !== undefined && data.density !== null) ? Number(data.density) : 10;
                    const step = (max - min) / density;
                    const eps = step / 100; // Small epsilon for inclusive loop

                    for (let x = min; x <= max + eps; x += step) {
                        for (let y = min; y <= max + eps; y += step) {
                            const scope = { [var1]: x, [var2]: y };
                            samples.push([
                                Number(x.toFixed(10)),
                                Number(y.toFixed(10)),
                                Number(fx(scope)),
                                Number(fy(scope))
                            ]);
                        }
                    }
                } catch (e) { /* fallback if sampling fails */ }
                return samples;
            };

            const sanitize = (s: string | null | undefined) => {
                if (!s) return '';
                return s.replace(/^[a-zA-Z_]\w*\s*(\([^)]*\))?\s*=\s*/, '').replace(/{/g, '(').replace(/}/g, ')');
            };

            if (mode === 'gradient') {
                const exprStr = sanitize(PayloadUtils.extractExprStr(inputs['in_a']));
                if (!exprStr) return PayloadUtils.createError('No Function Input');

                const dx = svc.differentiate(exprStr, var1).text();
                const dy = svc.differentiate(exprStr, var2).text();

                result = {
                    out_b: PayloadUtils.createSymbolic(`[${dx}, ${dy}]`),
                    out_a: PayloadUtils.createArray(sampleField(
                        svc.compileToFunction(dx, [var1, var2]) as any,
                        svc.compileToFunction(dy, [var1, var2]) as any
                    ))
                };
            } else if (mode === 'direct' || mode === 'vector field') {
                const p = sanitize(PayloadUtils.extractExprStr(inputs['in_b']));
                const q = sanitize(PayloadUtils.extractExprStr(inputs['in_c']));
                if (!p || !q) return PayloadUtils.createError('Missing P/Q components');

                result = {
                    out_b: PayloadUtils.createSymbolic(`[${p}, ${q}]`),
                    out_a: PayloadUtils.createArray(sampleField(
                        svc.compileToFunction(p, [var1, var2]) as any,
                        svc.compileToFunction(q, [var1, var2]) as any
                    ))
                };
            } else if (mode === 'divergence') {
                const p = sanitize(PayloadUtils.extractExprStr(inputs['in_b']));
                const q = sanitize(PayloadUtils.extractExprStr(inputs['in_c']));
                if (!p || !q) return PayloadUtils.createError('Missing P/Q components');
                const dp = svc.differentiate(p, var1).text(), dq = svc.differentiate(q, var2).text();
                result = { out_b: PayloadUtils.createSymbolic(`(${dp})+(${dq})`) };
            } else if (mode === 'curl') {
                const p = sanitize(PayloadUtils.extractExprStr(inputs['in_b']));
                const q = sanitize(PayloadUtils.extractExprStr(inputs['in_c']));
                if (!p || !q) return PayloadUtils.createError('Missing P/Q components');
                const dq_dx = svc.differentiate(q, var1).text(), dp_dy = svc.differentiate(p, var2).text();
                result = { out_b: PayloadUtils.createSymbolic(`(${dq_dx})-(${dp_dy})`) };
            }

            if (!result) return PayloadUtils.createError('Unsupported Mode');

            return {
                type: DataType.Array, // Using Array as a wrapper for multi-handle objects is common in this engine
                value: result,
                symbol: null,
                meta: {}
            };
        } catch (e: any) {
            console.error('[TR-04] VectorField Error:', e);
            return PayloadUtils.createError(`VectorField Failed: ${e.message}`);
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
            value: { out_a: PayloadUtils.dehydrate(area), out_b: PayloadUtils.dehydrate(perimeter) },
            symbol: null,
            meta: {}
        };
    },

    'CL-03': (node, inputs) => {
        const data = (node.data || {}) as any;
        const variable = data.variable || 'x';
        const approach = PayloadUtils.unwrap(inputs['in_b']) ?? data.approach ?? '0';
        const direction = data.direction || 'both';
        let exprStr = PayloadUtils.extractExprStr(inputs['in_a']);

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
        const getNum = (key: string, handleId: string, def: number) => {
            const val = inputs[handleId];
            if (val) {
                const unwrapped = PayloadUtils.unwrap(val);
                return isNaN(Number(unwrapped)) ? def : Number(unwrapped);
            }
            return Number(data[key]) || def;
        };

        const t0 = getNum('t0', 'in_b', 0);
        const tEnd = getNum('tEnd', 'in_c', 1);
        const y0 = getNum('y0', 'in_d', 1);
        const stepSize = getNum('stepSize', 'in_e', 0.01);
        let exprStr = PayloadUtils.extractExprStr(inputs['in_a']);

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
        const code = String(data.code || '').trim();
        if (!code) return PayloadUtils.createError('No Expression');

        const engine = InputOutputEngine.getInstance();
        const math = engine.getMathInstance();

        try {
            // 💡 Smart Evaluation & Assignment Detection
            const parsed = math.parse(code);
            let metadata: any = {};

            if (parsed && (parsed as any).isAssignmentNode) {
                const asmt = parsed as any;
                metadata.label = asmt.object?.name || asmt.name;

                // 💡 Fix: Assignments (e.g., "orange=4") should remain Symbolic in the Expression node.
                // This allows downstream Solvers to receive the full symbolic string.
                const payload = PayloadUtils.createSymbolic(code);
                payload.meta = { ...payload.meta, ...metadata };
                return payload;
            }

            const result = math.evaluate(code);
            if (result !== undefined && result !== null && typeof result !== 'function') {
                // Use wrap() for robust type detection (Scalar/Array/Boolean/Unit)
                const payload = PayloadUtils.wrap(result);
                payload.symbol = PayloadUtils.createSymbol('Literal', { value: code });
                payload.meta = { ...payload.meta, ...metadata };
                return payload;
            }
        } catch (e: any) {
            // Fallback to Symbolic if variables are present
        }

        return PayloadUtils.createSymbolic(code);
    }
};

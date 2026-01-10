import { Node, Edge } from '@xyflow/react';
import * as math from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Solve';
import { trackLogic } from '@/components/debug/Profiler';

// --- Types ---

export interface NodePayload {
    formula: string;    // Safe ID formula for MathJS (e.g. "node_a + node_b")
    scope: Record<string, any>; // Variable values
    display: string;    // Human-readable formula
    val: any;           // Preview value (can be number, array, matrix)
}

// --- Constants ---

export const FALLBACK_PAYLOAD: NodePayload = {
    formula: "0",
    scope: {},
    display: "0",
    val: 0
};

// --- Frame Cache for O(N) Performance ---
const frameCache = new Map<string, NodePayload>();

export const clearCache = () => {
    frameCache.clear();
};

// --- Helpers ---

export const toSafeVar = (label: string): string => {
    return label.replace(/[^a-zA-Z0-9]/g, '');
};

// --- Internals ---

// The core recursive logic (renamed from pullValue)
const _pullValue = (
    nodeId: string,
    nodes: Node[] | Map<string, Node>,
    edges: Edge[],
    visited: Set<string> = new Set()
): NodePayload => {

    // 0. Cache Hit
    if (frameCache.has(nodeId)) {
        return frameCache.get(nodeId)!;
    }

    // 1. Cycle Detection
    if (visited.has(nodeId)) {
        throw new Error(`Cycle detected at node ${nodeId}`);
    }
    const newVisited = new Set(visited);
    newVisited.add(nodeId);

    // Wrapper to cache result before returning
    const cacheAndReturn = (result: NodePayload) => {
        frameCache.set(nodeId, result);
        return result;
    };

    // 2. Find Node
    const node = (nodes instanceof Map) ? nodes.get(nodeId) : nodes.find(n => n.id === nodeId);
    if (!node) return FALLBACK_PAYLOAD;

    // 3. Mute Bypass
    if (node.data.muted) {
        let primaryInputKey: string | null = null;
        switch (node.type) {
            case 'mathNode': primaryInputKey = 'inputA'; break;
            case 'unaryNode': primaryInputKey = 'inputA'; break;
            case 'logicNode': primaryInputKey = 'inputA'; break;
            case 'compareNode': primaryInputKey = 'inputA'; break;
            case 'switchNode': primaryInputKey = 'ifFalse'; break;
            default: primaryInputKey = null;
        }

        if (primaryInputKey) {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === primaryInputKey);
            if (edge) {
                // RECURSIVE CALL -> _pullValue
                return cacheAndReturn(_pullValue(edge.source, nodes, edges, newVisited));
            }
        }
        return cacheAndReturn(FALLBACK_PAYLOAD);
    }

    // 4. Node Logic Switch
    switch (node.type) {
        case 'outputNode':
        case 'monitorNode':
        case 'numberNode':
        case 'matrixNode':
        case 'formulaNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            if (edge) {
                // Return result from connected source
                return cacheAndReturn(_pullValue(edge.source, nodes, edges, newVisited));
            }
            return cacheAndReturn(FALLBACK_PAYLOAD);
        }

        case 'sliderNode':
        case 'inputNode':
        case 'inputNumber': {
            if (node.data.muted) return FALLBACK_PAYLOAD;

            // Prefer 'value' if it's already a valid number (inputNumber sets value)
            // But legacy inputNode might use rawExpression string.
            let val = node.data.value ?? node.data.rawExpression;
            let parsedVal: any = 0;
            let displayVal = "0";

            try {
                if (typeof val === 'number') {
                    parsedVal = val;
                    displayVal = String(val);
                } else if (typeof val === 'string' && val.trim() !== '') {
                    // Critical: If string contains '=', it's likely a definition/equation (e.g. "x=5" or "2x+y=10").
                    // We MUST pass this as a raw string to downstream nodes (Solver) instead of evaluating it to a number.
                    if (val.includes('=')) {
                        // Check for spaces here too if we want strictness everywhere
                        if (/\s/.test(val.trim())) {
                            throw new Error("Invalid format: No spaces allowed in equation.");
                        }
                        throw new Error("Equation detected");
                    }

                    // STRICT NUMBER VALIDATION:
                    // The user demands "Error instead of 0" if there are spaces.
                    // This creates a "Zero Tolerance for Space in Numbers/Symbols" policy.
                    // Regex: Digit-Space, Dot-Space, Space-Digit, Space-Dot, or Alpha-Space-Alpha
                    // Note: We allow leading/trailing spaces via trim(), but internal spaces are forbidden.
                    const trimmed = val.trim();
                    if (/\s/.test(trimmed)) {
                        throw new Error("Invalid format: No spaces allowed.");
                    }

                    if (/^-?\d+\.?\d*$/.test(trimmed)) {
                        parsedVal = parseFloat(trimmed);
                        displayVal = trimmed;
                    } else {
                        parsedVal = math.evaluate(trimmed);
                        displayVal = String(parsedVal);
                    }
                } else {
                    parsedVal = Number(val) || 0;
                    displayVal = String(parsedVal);
                }
            } catch (e: any) {
                // If evaluation fails (e.g. standard equation "2x+5=15"),
                // treat it as a raw symbolic formula if it's a string.
                if (typeof val === 'string' && val.trim() !== '') {
                    let isError = false;

                    // Check if it was a strict validation error
                    if (e.message && e.message.startsWith("Invalid")) {
                        isError = true;
                        displayVal = "Error"; // Explicit Error Display
                        // We set val to NaN so valid downstream math fails too
                        parsedVal = NaN;
                    } else {
                        // Standard equation fallback
                        displayVal = val;
                        parsedVal = 0; // Fallback for solver
                    }

                    return cacheAndReturn({
                        formula: val, // Pass raw equation (e.g. "2x+5=15")
                        scope: {},
                        display: displayVal,
                        val: parsedVal
                    });
                }
                parsedVal = Number(val) || 0;
            }

            const safeId = node.data.symbol ? String(node.data.symbol).replace(/[^a-zA-Z0-9_]/g, '') : 'v_' + node.id.replace(/-/g, '_');

            return cacheAndReturn({
                formula: safeId,
                scope: { [safeId]: parsedVal },
                display: node.data.symbol ? String(node.data.symbol) : (node.data.label ? String(node.data.label) : (displayVal === "Error" ? "Error" : `${parsedVal}`)),
                val: parsedVal
            });
        }

        case 'inputMatrix': {
            if (node.data.muted) return FALLBACK_PAYLOAD;

            // NodeInputMatrix sets data.value to a math.matrix object. Trust it.
            const val = node.data.value;
            const safeId = node.data.symbol ? String(node.data.symbol).replace(/[^a-zA-Z0-9_]/g, '') : 'M_' + node.id.replace(/-/g, '_');

            return cacheAndReturn({
                formula: safeId,
                scope: { [safeId]: val },
                display: node.data.symbol ? String(node.data.symbol) : "Matrix",
                val: val // Pass object directly
            });
        }

        case 'mathNode': {
            const edgeA = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const edgeB = edges.find(e => e.target === nodeId && e.targetHandle === 'inputB');

            // RECURSIVE CALLS -> _pullValue
            const pA = edgeA ? _pullValue(edgeA.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const pB = edgeB ? _pullValue(edgeB.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const op = (node.data.operation as string) || 'add';
            let calculatedVal: any = 0;
            let symbol = '+';
            let mathFn: ((a: any, b: any) => any) | null = null;

            switch (op) {
                case 'add': mathFn = math.add; symbol = '+'; break;
                case 'sub': mathFn = math.subtract; symbol = '-'; break;
                case 'mul': mathFn = math.multiply; symbol = '*'; break;
                case 'div': mathFn = math.divide; symbol = '/'; break;
                case 'pow': mathFn = math.pow; symbol = '^'; break;
                case 'mod': mathFn = math.mod; symbol = '%'; break;
            }

            try {
                calculatedVal = mathFn ? mathFn(pA.val, pB.val) : 0;
            } catch (e) {
                // console.error(`MathNode error (${op}):`, e);
                calculatedVal = 0;
            }

            return cacheAndReturn({
                formula: `(${pA.formula}${symbol}${pB.formula})`,
                scope: { ...pA.scope, ...pB.scope },
                display: `(${pA.display} ${symbol} ${pB.display})`,
                val: calculatedVal
            });
        }

        case 'unaryNode': {
            const edge = edges.find(e => e.target === nodeId && (e.targetHandle === 'input' || e.targetHandle === 'inputA'));
            // RECURSIVE CALL -> _pullValue
            const payload = edge ? _pullValue(edge.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const op = (node.data.operation as string) || 'sqrt';
            let val: any = 0;
            let funcName = op;

            try {
                const mathFn = (math as any)[op];
                if (mathFn) {
                    const isCollection = payload.val && (payload.val.isMatrix || Array.isArray(payload.val));
                    if (isCollection) {
                        val = math.map(payload.val, (v: any) => mathFn(v));
                    } else {
                        val = mathFn(payload.val);
                    }
                } else {
                    val = 0;
                }
            } catch (e) {
                val = 0;
            }

            return cacheAndReturn({
                formula: `${funcName}(${payload.formula})`,
                scope: { ...payload.scope },
                display: `${funcName}(${payload.display})`,
                val: val
            });
        }

        case 'compareNode': {
            const edgeA = edges.find(e => e.target === nodeId && (e.targetHandle === 'inputA'));
            const edgeB = edges.find(e => e.target === nodeId && (e.targetHandle === 'inputB'));

            // RECURSIVE CALLS -> _pullValue
            const pA = edgeA ? _pullValue(edgeA.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const pB = edgeB ? _pullValue(edgeB.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const op = (node.data.operation as string) || 'eq';
            let bool = false;
            let sym = '==';

            switch (op) {
                case 'gt': bool = pA.val > pB.val; sym = '>'; break;
                case 'lt': bool = pA.val < pB.val; sym = '<'; break;
                case 'eq': bool = pA.val === pB.val; sym = '=='; break;
                case 'neq': bool = pA.val !== pB.val; sym = '!='; break;
                case 'gte': bool = pA.val >= pB.val; sym = '>='; break;
                case 'lte': bool = pA.val <= pB.val; sym = '<='; break;
            }

            const val = bool ? 1 : 0;

            return cacheAndReturn({
                formula: `(${pA.formula}${sym}${pB.formula})`,
                scope: { ...pA.scope, ...pB.scope },
                display: `(${pA.display} ${sym} ${pB.display})`,
                val: val
            });
        }

        case 'solverNode': {
            // 1. Identification: 'input_0' (or legacy 'inputA') is the Equation
            //    All other inputs are Context/Variables
            const edgesToNode = edges.filter(e => e.target === nodeId);

            let equations: string[] = [];
            let accumulatedScope: Record<string, any> = {};

            // Collect all inputs
            for (const edge of edgesToNode) {
                const p = _pullValue(edge.source, nodes, edges, newVisited);
                // Merge scopes from inputs (e.g. if a node provided a scope variable)
                accumulatedScope = { ...accumulatedScope, ...p.scope };

                // Check formula from input
                if (p.formula && p.formula.trim() !== '') {
                    equations.push(p.formula);
                }
            }

            const targetVar = (node.data.targetVar as string) || 'x';
            let solvedVal = 0;
            let solutionStr = '?';

            try {
                // Pre-process equations to find explicit definitions (LHS = RHS where LHS is symbol)
                let mainEq = "";

                for (let eqStr of equations) {
                    // ULTRA-STRICT VALIDATION: Zero tolerance for spaces.
                    // The user explicitly requested "No spaces allowed inside value" and complained about "6a= 103.8".
                    // To ensure absolute robustness and no ambiguity, we forbid spaces entirely.
                    // Users must write compact equations: "x=5", "2x+y=10".
                    if (/\s/.test(eqStr)) {
                        throw new Error("Invalid format: Spaces are not allowed anywhere. Please remove all spaces.");
                    }

                    // 2. Variables/Symbols cannot be split or imply implicit multiplication with spaces:
                    //    "a b" (two variables), "5 a" (number space variable), "my var" (split variable)
                    //    Valid: "a+b", "sin(x)", "3*x"
                    //    Regex: [Alphanumeric/Underscore] [Space] [Letter/Underscore/OpenParen]
                    //    Note: We allow space before operators like +, -, =, etc., so we target identifiers.
                    //    We assume operators are NOT alphanumeric (except maybe 'mod'?).
                    //    If nerdamer treats 'mod' as operator, we need to be careful. 
                    //    Let's target strict "Identifier Space Identifier" pattern for now.
                    if (/[a-zA-Z0-9_]\s+[a-zA-Z_]/.test(eqStr)) {
                        throw new Error("Invalid format: Spaces between values/variables are not allowed. Use explicit operators.");
                    }

                    // Robust Parsing: Split by '=' to handle complex cases
                    const parts = eqStr.split('=');

                    if (parts.length === 2) {
                        const lhs = parts[0].trim();
                        const rhs = parts[1].trim();

                        // STRICT VALIDATION (LHS):
                        // If LHS looks like multiple identifiers separated by spaces (e.g. "my var", "x y"),
                        // and has no other operators, throw an error.
                        // User requirement: "Don't have any spaces". 
                        // This prevents "my var" being silently treated as "my * var".
                        if (/^[a-zA-Z_]\w*(\s+[a-zA-Z_]\w*)+$/.test(lhs)) {
                            throw new Error("Invalid format: Spaces are not allowed in variable names. Use '*' for multiplication.");
                        }

                        // Check if LHS is a valid variable name
                        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(lhs)) {
                            // Basic sanitize for definition check (trim only)
                            const cleanRhs = rhs.trim();

                            // 2. Check if valid number (supports scientific: 1e2, -5.5e-10)
                            // Strict check: No spaces allowed within the number string
                            if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(cleanRhs)) {
                                accumulatedScope[lhs] = Number(cleanRhs);
                                continue; // It's a definition, don't treat as main equation
                            }
                        }
                    }

                    // If not a simple definition, it's an equation to solve
                    mainEq = eqStr;
                }

                // Optimization: If the target variable is ALREADY defined in the scope, 
                // we don't need to solve anything. Just return it!
                if (accumulatedScope[targetVar] !== undefined) {
                    solvedVal = accumulatedScope[targetVar];
                    solutionStr = String(solvedVal);

                    return cacheAndReturn({
                        formula: `${solvedVal}`,
                        scope: {},
                        display: solutionStr,
                        val: solvedVal
                    });
                }


                if (!mainEq) {
                    // Fallback logic
                    if (accumulatedScope[targetVar] !== undefined) {
                        mainEq = `${targetVar} = ${accumulatedScope[targetVar]}`;
                    } else if (equations.length > 0) {
                        mainEq = equations[0];
                    }
                }

                if (!mainEq || /[^a-zA-Z0-9_\.\s\+\-\*\/\^\(\),=]/.test(mainEq)) {
                    if (!mainEq) throw new Error("No Equation Found");
                    throw new Error("Invalid characters");
                }

                // Substitute Scope into Equation
                let expr = nerdamer(mainEq);
                const scopeKeys = Object.keys(accumulatedScope);

                if (scopeKeys.length > 0) {
                    for (const key of scopeKeys) {
                        if (key !== targetVar) {
                            expr = expr.sub(key, String(accumulatedScope[key]));
                        }
                    }
                }

                const finalEq = expr.toString();

                const result = (nerdamer as any).solve(finalEq, targetVar);
                const sol = result.toString();
                solutionStr = sol;
                const cleanSol = sol.replace(/[\[\]]/g, '');
                const firstSol = cleanSol.split(',')[0];

                // Nerdamer often returns fractions like "1/2". 
                // Number("1/2") is NaN. We need to evaluate it using mathjs to get a decimal.
                try {
                    // Try simple parse first
                    let parsed = Number(firstSol);
                    if (isNaN(parsed)) {
                        // If plain number fails, try evaluating as expression (handles 1/2, sqrt(2), etc.)
                        parsed = math.evaluate(firstSol);
                    }
                    if (!isNaN(parsed)) solvedVal = parsed;
                } catch (e) {
                    // Fail silently, default to 0
                }

            } catch (e) {
                solutionStr = "Error";
            }


            return cacheAndReturn({
                formula: `${solvedVal}`,
                scope: {},
                display: solutionStr,
                val: solvedVal
            });
        }

        case 'logicNode': {
            const edgeA = edges.find(e => e.target === nodeId && (e.targetHandle === 'inputA'));
            const edgeB = edges.find(e => e.target === nodeId && (e.targetHandle === 'inputB'));

            // RECURSIVE CALLS -> _pullValue
            const pA = edgeA ? _pullValue(edgeA.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const pB = edgeB ? _pullValue(edgeB.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const op = (node.data.operation as string) || 'AND';
            let res = 0;
            let sym = 'and';

            const valA = pA.val !== 0;
            const valB = pB.val !== 0;

            switch (op) {
                case 'AND': res = (valA && valB) ? 1 : 0; sym = 'and'; break;
                case 'OR': res = (valA || valB) ? 1 : 0; sym = 'or'; break;
                case 'XOR': res = (valA !== valB) ? 1 : 0; sym = 'xor'; break;
                case 'NAND': res = !(valA && valB) ? 1 : 0; sym = 'and'; break;
            }

            let formulaStr = `(${pA.formula}${sym}${pB.formula})`;
            let displayStr = `(${pA.display} ${sym.toUpperCase()} ${pB.display})`;

            if (op === 'NAND') {
                formulaStr = `not(${pA.formula} and ${pB.formula})`;
                displayStr = `NAND(${pA.display}, ${pB.display})`;
            }

            return cacheAndReturn({
                formula: formulaStr,
                scope: { ...pA.scope, ...pB.scope },
                display: displayStr,
                val: res
            });
        }

        case 'switchNode': {
            const edgeCond = edges.find(e => e.target === nodeId && e.targetHandle === 'condition');
            const edgeTrue = edges.find(e => e.target === nodeId && e.targetHandle === 'ifTrue');
            const edgeFalse = edges.find(e => e.target === nodeId && e.targetHandle === 'ifFalse');

            // RECURSIVE CALL -> _pullValue
            const pCond = edgeCond ? _pullValue(edgeCond.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const condition = pCond.val !== 0;

            // RECURSIVE CALLS -> _pullValue
            const pTrue = edgeTrue ? _pullValue(edgeTrue.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const pFalse = edgeFalse ? _pullValue(edgeFalse.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const resVal = condition ? pTrue.val : pFalse.val;

            return cacheAndReturn({
                formula: `(${pCond.formula}?${pTrue.formula}:${pFalse.formula})`,
                scope: { ...pCond.scope, ...pTrue.scope, ...pFalse.scope },
                display: condition ? pTrue.display : pFalse.display,
                val: resVal
            });
        }

        default:
            return cacheAndReturn(FALLBACK_PAYLOAD);
    }
};

/**
 * Public Exported Wrapper: Pulls value from a node with performance tracking.
 */
export const pullValue = (
    nodeId: string,
    nodes: Node[] | Map<string, Node>,
    edges: Edge[],
    visited: Set<string> = new Set()
): NodePayload => {
    const start = performance.now();
    try {
        return _pullValue(nodeId, nodes, edges, visited);
    } finally {
        trackLogic('Brain:pullValue', performance.now() - start);
    }
};

// --- Dead Code Elimination ---
// Returns true if the node is part of a dependency chain leading to a Sink (Output/Monitor/Network)
export const isNodeAlive = (
    nodeId: string,
    nodes: Node[] | Map<string, Node>,
    edges: Edge[]
): boolean => {
    // 1. Quick Check: Am I connected to anything?
    // If I have no outgoing edges, and I am not a Sink, I am dead.
    const hasOutgoing = edges.some(e => e.source === nodeId);

    // Normalize Data Structure
    let isSink = false;
    if (nodes instanceof Map) {
        const n = nodes.get(nodeId);
        if (n && (n.type === 'outputNode' || n.type === 'monitorNode')) isSink = true;
    } else {
        const n = (nodes as Node[]).find(n => n.id === nodeId);
        if (n && (n.type === 'outputNode' || n.type === 'monitorNode')) isSink = true;
    }

    if (isSink) return true;
    if (!hasOutgoing) return false;

    // 2. Full Reachability Check (BFS)
    // Search forward to see if we can reach ANY Sink.
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const curr = queue.shift()!;
        if (visited.has(curr)) continue;
        visited.add(curr);

        // Check types of current node to see if it's a sink
        let currNode: Node | undefined;
        if (nodes instanceof Map) {
            currNode = nodes.get(curr);
        } else {
            currNode = (nodes as Node[]).find(n => n.id === curr);
        }

        if (currNode && (currNode.type === 'outputNode' || currNode.type === 'monitorNode')) {
            return true;
        }

        // Find outgoing edges
        const outgoers = edges.filter(e => e.source === curr);
        for (const edge of outgoers) {
            queue.push(edge.target);
        }
    }

    return false;
};

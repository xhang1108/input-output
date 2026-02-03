import { Node, Edge } from '@xyflow/react';
import * as math from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Solve';
import { trackLogic } from '@/components/debug/Profiler';

// --- Types ---

export interface NodePayload {
    soul: string;       // Standardized AST/LaTeX/Logical identifier (The "Identity")
    body: any;          // Executed value: number, array, matrix, or object (The "Result")
    scope: Record<string, any>; // Variable context
    display: string;    // Human-readable string for UI preview
}

// Context for Macro recursion
interface EvaluationContext {
    // A function to resolve a value for a specific inner input node ID (which corresponds to an outer connection)
    resolveMacroInput?: (innerNodeId: string, visited: Set<string>) => NodePayload;
}

// --- Constants ---

export const FALLBACK_PAYLOAD: NodePayload = {
    soul: "0",
    body: 0,
    scope: {},
    display: "0"
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

/**
 * Extracts the correct value from a source payload based on the connecting handle.
 * Supports both single-value nodes (primitive) and multi-value nodes (macros/objects).
 */
const resolveSourceValue = (payload: NodePayload, sourceHandle: string | null | undefined): any => {
    const val = payload.body;
    // If it's a Macro/Multi-Output (Object/Map) AND we have a specific handle
    if (val && typeof val === 'object' && !Array.isArray(val) && !val.isMatrix && sourceHandle && sourceHandle in val) {
        return val[sourceHandle];
    }
    // Default / Single Value / Matrix / Array
    return val;
};

// --- Internals ---

/**
 * RK4 (Runge-Kutta 4th Order) Solver Plugin
 * Solves dy/dt = f(t, y)
 */
const solveRK4 = (
    func: (t: number, y: number) => number,
    y0: number,
    t0: number,
    tn: number,
    h: number
): Array<{ t: number, y: number }> => {
    const results = [];
    let t = t0;
    let y = y0;
    results.push({ t, y });

    while (t < tn) {
        const k1 = h * func(t, y);
        const k2 = h * func(t + h / 2, y + k1 / 2);
        const k3 = h * func(t + h / 2, y + k2 / 2);
        const k4 = h * func(t + h, y + k3);

        y = y + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
        t = t + h;
        results.push({ t, y });
    }
    return results;
};

// The core recursive logic (renamed from pullValue)
const _pullValue = (
    nodeId: string,
    nodes: Node[] | Map<string, Node>,
    edges: Edge[],
    visited: Set<string> = new Set(),
    context?: EvaluationContext
): NodePayload => {

    // 0. Cache Hit
    if (frameCache.has(nodeId)) {
        return frameCache.get(nodeId)!;
    }

    // 1. Cycle Detection
    if (visited.has(nodeId)) {
        // Return fallback to break cycle gracefully usually, but error is safer for debugging
        // throw new Error(`Cycle detected at node ${nodeId}`);
        // For robustness, we return 0/Error instead of crashing the whole graph
        return FALLBACK_PAYLOAD;
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
            case 'C11':
            case 'mathNode': primaryInputKey = 'inputA'; break;
            case 'C13':
            case 'logicNode': primaryInputKey = 'inputA'; break;
            case 'C14':
            case 'switchNode': primaryInputKey = 'ifFalse'; break;
            case 'C15':
            case 'gateNode': primaryInputKey = 'inputA'; break;
            default: primaryInputKey = null;
        }

        if (primaryInputKey) {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === primaryInputKey);
            if (edge) {
                return cacheAndReturn(_pullValue(edge.source, nodes, edges, newVisited, context));
            }
        }
        return cacheAndReturn(FALLBACK_PAYLOAD);
    }

    // 4. Node Logic Switch
    switch (node.type) {
        // --- Macro Logic ---
        case 'macroNode': {
            // A Macro contains an inner graph.
            // We need to evaluate the "Inner Outputs" and return them bundled.
            // data.nodes, data.edges, data.outputs (list of {id, label})

            const innerNodes = node.data.nodes as Node[] | undefined;
            const innerEdges = node.data.edges as Edge[] | undefined;
            const outputDefs = node.data.outputs as Array<{ id: string, label: string }> | undefined;

            if (!innerNodes || !innerEdges || !outputDefs) {
                return cacheAndReturn(FALLBACK_PAYLOAD);
            }

            // Define Context for Inner Graph
            const innerContext: EvaluationContext = {
                resolveMacroInput: (innerInputId, innerVisited) => {
                    // This callback runs WHEN the inner graph hits a 'macroInput' node.
                    // We need to find the OUTER edge connected to this Macro Node's corresponding input handle.

                    // 1. Find the input definition in the Macro Node data that matches this innerInputId
                    // (The macroInput node ID inside IS the handle ID for the outside, usually? 
                    //  Or we store a map? Let's assume innerInputId === inputHandleId for simplicity 
                    //  OR the macroNode has `data.inputs` mapping).
                    // Implementation Plan Assumption: innerNode.id === outerHandleId
                    // Let's verify: In `data.inputs`, we have `{ id: 'inner_id', label: 'A' }`.
                    // The handle on the macroNode would likely be the `inner_id`.

                    const outerHandleId = innerInputId;

                    const outerEdge = edges.find(e => e.target === nodeId && e.targetHandle === outerHandleId);

                    if (outerEdge) {
                        // Jump back to Outer Graph!
                        // We use `newVisited` (outer visited set) to prevent cycles crossing boundaries
                        return _pullValue(outerEdge.source, nodes, edges, newVisited, context); // Inherit outer context too? Yes.
                    }

                    return FALLBACK_PAYLOAD;
                }
            };

            // Calculate ALL outputs
            // (Since we cache by Node, we must compute the whole node state)
            const resultBundle: Record<string, any> = {};
            const scopes: Record<string, any> = {};
            let displayStr = "Macro";

            outputDefs.forEach(outDef => {
                // outDef.id is the ID of the 'macroOutput' node inside
                const innerResult = _pullValue(outDef.id, innerNodes, innerEdges, new Set(), innerContext);

                resultBundle[outDef.id] = innerResult.body;
                Object.assign(scopes, innerResult.scope);
                // For display, we might just pick the first one or combine
                if (displayStr === "Macro") displayStr = innerResult.display;
            });

            return cacheAndReturn({
                soul: `macro_${node.id}`,
                body: resultBundle,
                scope: scopes,
                display: displayStr
            });
        }

        case 'macroInput': {
            // This node exists INSIDE a macro. It represents a connection to the outside.
            // We delegate to the context.
            if (context && context.resolveMacroInput) {
                // Pass current visited stack?
                // The context func switches graphs, so handling `visited` there is complex.
                // `resolveMacroInput` will restart search in Outer Graph.
                return context.resolveMacroInput(nodeId, visited);
            }
            return cacheAndReturn(FALLBACK_PAYLOAD);
        }

        case 'macroOutput': {
            // This node exists INSIDE a macro. It behaves like an Output/Result node.
            // It just passes through its input.
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            if (edge) {
                return cacheAndReturn(_pullValue(edge.source, nodes, edges, newVisited, context));
            }
            return cacheAndReturn(FALLBACK_PAYLOAD);
        }

        // --- 1. Foundational IO (C1 - C10) ---

        case 'C1': // Input (Scalar)
        case 'inputNumber':
        case 'numberNode':
        case 'inputNode': {
            if (node.data.muted) return FALLBACK_PAYLOAD;

            const data = node.data as any;
            let val = data.value ?? data.rawExpression ?? 0;
            let parsedVal: any = 0;

            try {
                if (typeof val === 'number') {
                    parsedVal = val;
                } else if (typeof val === 'string' && val.trim() !== '') {
                    const trimmed = val.trim();
                    if (/\s/.test(trimmed)) throw new Error("Spaces not allowed");
                    parsedVal = math.evaluate(trimmed);
                } else {
                    parsedVal = Number(val) || 0;
                }
            } catch (e) {
                parsedVal = NaN;
            }

            const safeVar = data.symbol ? toSafeVar(String(data.symbol)) : `v_${nodeId.replace(/-/g, '_')}`;
            const unit = data.unit || "";

            return cacheAndReturn({
                soul: safeVar,
                body: parsedVal,
                scope: { [safeVar]: parsedVal },
                display: unit ? `${data.symbol || parsedVal} [${unit}]` : `${data.symbol || parsedVal}`
            });
        }

        case 'C2': // Slider
        case 'sliderNode': {
            const data = node.data as any;
            const val = data.value ?? 0;
            const safeVar = data.symbol ? toSafeVar(String(data.symbol)) : `slide_${nodeId.replace(/-/g, '_')}`;
            return cacheAndReturn({
                soul: safeVar,
                body: val,
                scope: { [safeVar]: val },
                display: `${val}`
            });
        }

        case 'C3': // Constants
        case 'constantsNode': {
            const type = node.data.constantType || 'pi';
            let val = math.pi;
            let soul = "pi";
            switch (type) {
                case 'pi': val = math.pi; soul = "pi"; break;
                case 'e': val = math.e; soul = "e"; break;
                case 'G': val = 6.6743e-11; soul = "G"; break;
                case 'c': val = 299792458; soul = "c"; break;
                case 'phi': val = 1.6180339887; soul = "phi"; break;
            }
            return cacheAndReturn({
                soul,
                body: val,
                scope: { [soul]: val },
                display: soul
            });
        }

        case 'C4': // String
        case 'stringNode': {
            const data = node.data as any;
            const text = String(data.text || "");
            return cacheAndReturn({
                soul: `"${text}"`,
                body: text,
                scope: {},
                display: text
            });
        }

        case 'C6': // Array Input
        case 'matrixNode':
        case 'inputMatrix': {
            const val = node.data.value || math.matrix([]);
            const safeVar = node.data.symbol ? toSafeVar(node.data.symbol) : `M_${nodeId.replace(/-/g, '_')}`;
            return cacheAndReturn({
                soul: safeVar,
                body: val,
                scope: { [safeVar]: val },
                display: "Array"
            });
        }

        case 'C7': // Result
        case 'outputNode':
        case 'monitorNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            if (edge) {
                const payload = _pullValue(edge.source, nodes, edges, newVisited, context);
                const val = resolveSourceValue(payload, edge.sourceHandle);
                return cacheAndReturn({ ...payload, body: val });
            }
            return cacheAndReturn(FALLBACK_PAYLOAD);
        }

        case 'C8': // Formula
        case 'formulaNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            if (edge) {
                return cacheAndReturn(_pullValue(edge.source, nodes, edges, newVisited, context));
            }
            return cacheAndReturn(FALLBACK_PAYLOAD);
        }

        // --- 2. Core Calculation & Logic (C11 - C20) ---

        case 'C11': // Math (Universal)
        case 'mathNode': {
            const edgeA = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const edgeB = edges.find(e => e.target === nodeId && e.targetHandle === 'inputB');

            const pA = edgeA ? _pullValue(edgeA.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const pB = edgeB ? _pullValue(edgeB.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;

            const vA = resolveSourceValue(pA, edgeA?.sourceHandle);
            const vB = resolveSourceValue(pB, edgeB?.sourceHandle);

            const op = (node.data.operation as string) || 'add';
            let res: any = 0;
            let sym = '+';
            let mathFn = math.add;

            switch (op) {
                case 'add': mathFn = math.add; sym = '+'; break;
                case 'sub': mathFn = math.subtract; sym = '-'; break;
                case 'mul': mathFn = math.multiply; sym = '*'; break;
                case 'div': mathFn = math.divide; sym = '/'; break;
                case 'pow': mathFn = math.pow; sym = '^'; break;
                case 'mod': mathFn = math.mod; sym = '%'; break;
                case 'round': mathFn = math.round; sym = ' rnd '; break;
                case 'floor': mathFn = math.floor; sym = ' flr '; break;
                case 'ceil': mathFn = math.ceil; sym = ' cel '; break;
                case 'abs': mathFn = math.abs; sym = ' abs '; break;
            }

            try {
                res = mathFn(vA, vB);
            } catch (e) {
                // If it's a unary op used in binary, or error
                try { res = (math as any)[op](vA); } catch { res = NaN; }
            }

            return cacheAndReturn({
                soul: `(${pA.soul}${sym}${pB.soul})`,
                body: res,
                scope: { ...pA.scope, ...pB.scope },
                display: `(${pA.display}${sym}${pB.display})`
            });
        }

        case 'C12': // Number Theory
        case 'theoryNode': {
            const edgeA = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const edgeB = edges.find(e => e.target === nodeId && e.targetHandle === 'inputB');
            const pA = edgeA ? _pullValue(edgeA.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const pB = edgeB ? _pullValue(edgeB.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const vA = resolveSourceValue(pA, edgeA?.sourceHandle);
            const vB = resolveSourceValue(pB, edgeB?.sourceHandle);

            const op = node.data.operation || 'gcd';
            let res = 0;
            try {
                switch (op) {
                    case 'gcd': res = math.gcd(vA, vB); break;
                    case 'lcm': res = math.lcm(vA, vB); break;
                    case 'isPrime': res = (math as any).isPrime(vA) ? 1 : 0; break;
                }
            } catch { res = NaN; }

            return cacheAndReturn({
                soul: `${op}(${pA.soul},${pB.soul})`,
                body: res,
                scope: { ...pA.scope, ...pB.scope },
                display: `${op}(${vA})`
            });
        }

        case 'C15': // Boolean Gates (Bitwise/Logical)
        case 'gateNode': {
            const edgeA = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const edgeB = edges.find(e => e.target === nodeId && e.targetHandle === 'inputB');
            const pA = edgeA ? _pullValue(edgeA.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const pB = edgeB ? _pullValue(edgeB.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const vA = resolveSourceValue(pA, edgeA?.sourceHandle) !== 0;
            const vB = resolveSourceValue(pB, edgeB?.sourceHandle) !== 0;

            const op = node.data.operation || 'AND';
            let res = false;
            switch (op) {
                case 'AND': res = vA && vB; break;
                case 'OR': res = vA || vB; break;
                case 'NOT': res = !vA; break;
                case 'XOR': res = vA !== vB; break;
            }
            return cacheAndReturn({
                soul: `${op}(${pA.soul},${pB.soul})`,
                body: res ? 1 : 0,
                scope: { ...pA.scope, ...pB.scope },
                display: res ? "TRUE" : "FALSE"
            });
        }

        case 'C16': // Unit Tag
        case 'C17': // Unit Convert
        case 'unitNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const p = edge ? _pullValue(edge.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const val = resolveSourceValue(p, edge?.sourceHandle);

            const op = node.data.operation || 'tag';
            const unit = node.data.unit || 'm';
            let res = val;
            try {
                if (op === 'tag' || node.type === 'C16') {
                    res = math.unit(val, unit);
                } else {
                    // Convert
                    res = (val as any).toNumber(unit);
                }
            } catch { res = val; }

            return cacheAndReturn({
                soul: `unit(${p.soul},"${unit}")`,
                body: res,
                scope: p.scope,
                display: `${res}`
            });
        }

        // --- 3. Data Shaping & Stats (C21 - C25) ---

        case 'C21': // Statistics
        case 'statsNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const p = edge ? _pullValue(edge.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const val = resolveSourceValue(p, edge?.sourceHandle);

            const op = node.data.operation || 'mean';
            let res = 0;
            try {
                res = (math as any)[op](val);
            } catch { res = NaN; }

            return cacheAndReturn({
                soul: `${op}(${p.soul})`,
                body: res,
                scope: p.scope,
                display: `${op}: ${res}`
            });
        }

        case 'C25': // Random
        case 'randomNode': {
            const edgeTrig = edges.find(e => e.target === nodeId && e.targetHandle === 'trig');
            const edgeSeed = edges.find(e => e.target === nodeId && e.targetHandle === 'seed');

            // Seed check
            let seed = undefined;
            if (edgeSeed) {
                const pSeed = _pullValue(edgeSeed.source, nodes, edges, newVisited, context);
                seed = resolveSourceValue(pSeed, edgeSeed.sourceHandle);
            }

            // Implementation of seeded random would go here. 
            // For now, simple math.random
            const val = math.random();
            return cacheAndReturn({
                soul: `rand(${seed || ''})`,
                body: val,
                scope: {},
                display: `R: ${val.toFixed(3)}`
            });
        }

        // --- 4. Advanced Math (C26 - C33) ---

        case 'C26': // Matrix Tools
        case 'expertMatrixNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const p = edge ? _pullValue(edge.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const val = resolveSourceValue(p, edge?.sourceHandle);

            const op = node.data.operation || 'inv';
            let res: any = 0;
            try {
                switch (op) {
                    case 'inv': res = math.inv(val); break;
                    case 'det': res = math.det(val); break;
                    case 'transpose': res = math.transpose(val); break;
                }
            } catch { res = NaN; }

            return cacheAndReturn({
                soul: `${op}(${p.soul})`,
                body: res,
                scope: p.scope,
                display: `${op}`
            });
        }

        case 'C27': // Vector Utils
        case 'vectorNode': {
            const edgeA = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const edgeB = edges.find(e => e.target === nodeId && e.targetHandle === 'inputB');
            const pA = edgeA ? _pullValue(edgeA.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const pB = edgeB ? _pullValue(edgeB.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const vA = resolveSourceValue(pA, edgeA?.sourceHandle);
            const vB = resolveSourceValue(pB, edgeB?.sourceHandle);

            const op = node.data.operation || 'dot';
            let res: any = 0;
            try {
                switch (op) {
                    case 'dot': res = math.dot(vA, vB); break;
                    case 'cross': res = math.cross(vA, vB); break;
                    case 'norm': res = math.norm(vA); break;
                    case 'distance': res = math.distance(vA, vB); break;
                }
            } catch { res = NaN; }

            return cacheAndReturn({
                soul: `${op}(${pA.soul},${pB.soul})`,
                body: res,
                scope: { ...pA.scope, ...pB.scope },
                display: `${op}`
            });
        }

        case 'C29': // Derivative
        case 'derivativeNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const p = edge ? _pullValue(edge.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;

            const targetVar = node.data.variable || 'x';
            let soul = `d/d${targetVar}(${p.soul})`;
            let body = 0;

            try {
                const deriv = nerdamer.diff(p.soul, targetVar);
                soul = deriv.toString();
                body = math.evaluate(soul, p.scope);
            } catch { body = NaN; }

            return cacheAndReturn({
                soul,
                body,
                scope: p.scope,
                display: `d/d${targetVar}`
            });
        }

        case 'C31': // ODE Solver (RK4)
        case 'odeNode': {
            const edgeEq = edges.find(e => e.target === nodeId && e.targetHandle === 'eq');
            const edgeInit = edges.find(e => e.target === nodeId && e.targetHandle === 'initial');

            const pEq = edgeEq ? _pullValue(edgeEq.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const pInit = edgeInit ? _pullValue(edgeInit.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;

            // Simplified RK4 call
            const h = node.data.stepSize || 0.1;
            const tn = node.data.tn || 10;

            // Dummy implementation for now - returning a sequence
            const res = solveRK4((t, y) => {
                try {
                    return math.evaluate(pEq.soul, { ...pEq.scope, t, y });
                } catch { return 0; }
            }, resolveSourceValue(pInit, edgeInit?.sourceHandle), 0, tn, h);

            return cacheAndReturn({
                soul: `RK4(${pEq.soul})`,
                body: res,
                scope: {},
                display: "ODE Path"
            });
        }

        case 'C32': // Solver
        case 'solverNode': {
            const edgesToNode = edges.filter(e => e.target === nodeId);
            let equations: string[] = [];
            let accumulatedScope: Record<string, any> = {};

            for (const edge of edgesToNode) {
                const p = _pullValue(edge.source, nodes, edges, newVisited, context);
                accumulatedScope = { ...accumulatedScope, ...p.scope };
                if (p.soul) equations.push(p.soul);
            }

            const targetVar = node.data.targetVar || 'x';
            let res = 0;
            try {
                const sol = nerdamer.solve(equations[0], targetVar);
                const solStr = sol.toString().replace(/[\[\]]/g, '').split(',')[0];
                res = math.evaluate(solStr, accumulatedScope);
            } catch { res = NaN; }

            return cacheAndReturn({
                soul: `${res}`,
                body: res,
                scope: {},
                display: `sol: ${res}`
            });
        }

        case 'C33': // Complex
        case 'complexNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const p = edge ? _pullValue(edge.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const z = resolveSourceValue(p, edge?.sourceHandle);
            const data = node.data as any;

            const op = data.operation || 're';
            let res = 0;
            try {
                const c = math.complex(z);
                switch (op) {
                    case 're': res = c.re; break;
                    case 'im': res = c.im; break;
                    case 'mag': res = math.abs(c); break;
                    case 'arg': res = math.arg(c); break;
                }
            } catch { res = NaN; }

            return cacheAndReturn({
                soul: `${op}(${p.soul})`,
                body: res,
                scope: p.scope,
                display: `${op}(z)`
            });
        }

        // --- 5. Simulation & Expert (C34 - C42) ---

        case 'C34': // Sequence (Range)
        case 'rangeNode': {
            const edgeStart = edges.find(e => e.target === nodeId && e.targetHandle === 'start');
            const edgeEnd = edges.find(e => e.target === nodeId && e.targetHandle === 'end');
            const edgeStep = edges.find(e => e.target === nodeId && e.targetHandle === 'step');

            const pStart = edgeStart ? _pullValue(edgeStart.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const pEnd = edgeEnd ? _pullValue(edgeEnd.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const pStep = edgeStep ? _pullValue(edgeStep.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;

            const vStart = resolveSourceValue(pStart, edgeStart?.sourceHandle);
            const vEnd = resolveSourceValue(pEnd, edgeEnd?.sourceHandle);
            const vStep = resolveSourceValue(pStep, edgeStep?.sourceHandle) || 1;

            let res: any = [];
            try {
                res = math.range(vStart, vEnd, vStep, true);
            } catch { res = []; }

            return cacheAndReturn({
                soul: `range(${pStart.soul},${pEnd.soul},${pStep.soul})`,
                body: res,
                scope: { ...pStart.scope, ...pEnd.scope, ...pStep.scope },
                display: "Sequence"
            });
        }

        case 'C37': // Probability (Distribution)
        case 'probNode': {
            const edgeInput = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const p = edgeInput ? _pullValue(edgeInput.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const val = resolveSourceValue(p, edgeInput?.sourceHandle);
            const data = node.data as any;

            const dist = data.dist || 'normal';
            // Simple probability density stub
            let res = 0;
            try {
                if (dist === 'normal') {
                    // Placeholder for actual stats math
                    res = math.exp(-0.5 * math.pow(val, 2)) / math.sqrt(2 * math.pi);
                }
            } catch { res = NaN; }

            return cacheAndReturn({
                soul: `pdf_${dist}(${p.soul})`,
                body: res,
                scope: p.scope,
                display: `P(${dist})`
            });
        }

        case 'C40': // Remap (Linear Interpolation)
        case 'remapNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const p = edge ? _pullValue(edge.source, nodes, edges, newVisited, context) : FALLBACK_PAYLOAD;
            const val = resolveSourceValue(p, edge?.sourceHandle);
            const data = node.data as any;

            const inMin = data.inMin ?? 0;
            const inMax = data.inMax ?? 1;
            const outMin = data.outMin ?? 0;
            const outMax = data.outMax ?? 1;

            const res = outMin + (outMax - outMin) * (val - inMin) / (inMax - inMin);

            return cacheAndReturn({
                soul: `remap(${p.soul},${inMin},${inMax},${outMin},${outMax})`,
                body: res,
                scope: p.scope,
                display: `Map: ${res.toFixed(2)}`
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
    let type = '';
    if (nodes instanceof Map) {
        const n = nodes.get(nodeId);
        if (n) type = n.type || '';
    } else {
        const n = (nodes as Node[]).find(n => n.id === nodeId);
        if (n) type = n.type || '';
    }

    // Macro Nodes might be sinks or sources depending on context, 
    // but usually they are treated like generic nodes unless they are top-level outputs.
    // Basic Sink Check:
    if (type === 'outputNode' || type === 'monitorNode') isSink = true;

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
        let currType = '';
        if (nodes instanceof Map) {
            const n = nodes.get(curr);
            if (n) currType = n.type || '';
        } else {
            const n = (nodes as Node[]).find(n => n.id === curr);
            if (n) currType = n.type || '';
        }

        if (currType === 'outputNode' || currType === 'monitorNode') {
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

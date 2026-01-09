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
            case 'outputNode': primaryInputKey = 'inputA'; break;
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
        case 'inputNode':
        case 'inputNumber': {
            if (node.data.muted) return FALLBACK_PAYLOAD;

            // Prefer 'value' if it's already a valid number (inputNumber sets value)
            // But legacy inputNode might use rawExpression string.
            let val = node.data.value ?? node.data.rawExpression;
            let parsedVal: any = 0;

            try {
                if (typeof val === 'number') {
                    parsedVal = val;
                } else if (typeof val === 'string' && val.trim() !== '') {
                    if (/^-?\d+\.?\d*$/.test(val.trim())) {
                        parsedVal = parseFloat(val);
                    } else {
                        parsedVal = math.evaluate(val);
                    }
                } else {
                    parsedVal = Number(val) || 0;
                }
            } catch (e) {
                parsedVal = Number(val) || 0;
            }

            const safeId = node.data.symbol ? String(node.data.symbol).replace(/[^a-zA-Z0-9_]/g, '') : 'v_' + node.id.replace(/-/g, '_');

            return cacheAndReturn({
                formula: safeId,
                scope: { [safeId]: parsedVal },
                display: node.data.symbol ? String(node.data.symbol) : (node.data.label ? String(node.data.label) : `${parsedVal}`),
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
                formula: `(${pA.formula} ${symbol} ${pB.formula})`,
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
                formula: `(${pA.formula} ${sym} ${pB.formula})`,
                scope: { ...pA.scope, ...pB.scope },
                display: `(${pA.display} ${sym} ${pB.display})`,
                val: val
            });
        }

        case 'solverNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            // RECURSIVE CALL -> _pullValue
            const payload = edge ? _pullValue(edge.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const targetVar = (node.data.targetVar as string) || 'x';
            let solvedVal = 0;
            let solutionStr = '?';

            try {
                if (!payload.formula || /[^a-zA-Z0-9_\.\s\+\-\*\/\^\(\),=]/.test(payload.formula)) {
                    throw new Error("Invalid characters in formula");
                }
                const result = (nerdamer as any).solve(payload.formula, targetVar);
                const sol = result.toString();
                solutionStr = sol;
                const cleanSol = sol.replace(/[\[\]]/g, '');
                const firstSol = cleanSol.split(',')[0];
                const num = Number(firstSol);
                if (!isNaN(num)) solvedVal = num;
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

            let formulaStr = `(${pA.formula} ${sym} ${pB.formula})`;
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
                formula: `(${pCond.formula} ? ${pTrue.formula} : ${pFalse.formula})`,
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

import { Node, Edge } from '@xyflow/react';
import * as math from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Solve';

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

/**
 * Cleans a label to be a safe variable name for display.
 * e.g. "Rent Cost" -> "RentCost"
 */
export const toSafeVar = (label: string): string => {
    return label.replace(/[^a-zA-Z0-9]/g, '');
};

/**
 * Core Recursive Function: Pulls value from a node.
 * @param nodeId The ID of the node to pull from.
 * @param nodes All nodes in the graph.
 * @param edges All edges in the graph.
 * @param visited Set of visited node IDs for Cycle Detection.
 */
export const pullValue = (
    nodeId: string,
    nodes: Node[],
    edges: Edge[],
    visited: Set<string> = new Set()
): NodePayload => {

    // 1. Cycle Detection
    // 0. Cache Hit (Optimization)
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
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return FALLBACK_PAYLOAD;

    // DEBUG LOG
    // console.log(`[Brain] Pulling ${nodeId} (${node.type})`, { data: node.data, visited: Array.from(visited) });

    // 3. Mute Bypass (Blender Style)
    // If muted, we try to pass through the "primary" input value without processing.
    if (node.data.muted) {
        // Define primary inputs for each node type
        let primaryInputKey: string | null = null;
        switch (node.type) {
            case 'mathNode': primaryInputKey = 'inputA'; break; // Pass Input A
            case 'unaryNode': primaryInputKey = 'inputA'; break;
            case 'logicNode': primaryInputKey = 'inputA'; break;
            case 'compareNode': primaryInputKey = 'inputA'; break;
            case 'switchNode': primaryInputKey = 'ifFalse'; break; // Default to passing False path
            case 'outputNode': primaryInputKey = 'inputA'; break;
            default: primaryInputKey = null;
        }

        if (primaryInputKey) {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === primaryInputKey);
            if (edge) {
                return cacheAndReturn(pullValue(edge.source, nodes, edges, newVisited));
            }
        }
        // If no primary input connected, return 0 (as if it's a pass-through of nothing)
        return cacheAndReturn(FALLBACK_PAYLOAD);
    }

    // 4. Node Logic Switch
    switch (node.type) {
        case 'inputNode': {
            if (node.data.muted) return FALLBACK_PAYLOAD;

            // Use math.evaluate for robust parsing of numbers, arrays, and matrices
            let val = node.data.rawExpression ?? node.data.value;
            let parsedVal: any = 0;

            try {
                if (typeof val === 'string' && val.trim() !== '') {
                    parsedVal = math.evaluate(val);
                } else {
                    parsedVal = Number(val) || 0;
                }
            } catch (e) {
                parsedVal = Number(val) || 0;
            }

            const safeId = 'v_' + node.id.replace(/-/g, '_');

            return cacheAndReturn({
                formula: safeId,
                scope: { [safeId]: parsedVal },
                display: node.data.label ? String(node.data.label) : `${parsedVal}`,
                val: parsedVal
            });
        }

        case 'mathNode': {
            const edgeA = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const edgeB = edges.find(e => e.target === nodeId && e.targetHandle === 'inputB');

            const pA = edgeA ? pullValue(edgeA.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const pB = edgeB ? pullValue(edgeB.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

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
                console.error(`MathNode error (${op}):`, e);
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
            const payload = edge ? pullValue(edge.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const op = (node.data.operation as string) || 'sqrt';
            let val: any = 0;
            let funcName = op;

            try {
                // Use mathjs functions to support matrices
                const mathFn = (math as any)[op];
                if (mathFn) {
                    // Element-wise support: if it's a matrix or array, map it
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
                console.error(`UnaryNode error (${op}):`, e);
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

            const pA = edgeA ? pullValue(edgeA.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const pB = edgeB ? pullValue(edgeB.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

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
                // Determine formula representation for comparison?
                // MathJS supports comparison.
                formula: `(${pA.formula} ${sym} ${pB.formula})`,
                scope: { ...pA.scope, ...pB.scope },
                display: `(${pA.display} ${sym} ${pB.display})`,
                val: val
            });
        }

        case 'solverNode': {
            const edge = edges.find(e => e.target === nodeId && e.targetHandle === 'inputA');
            const payload = edge ? pullValue(edge.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const targetVar = (node.data.targetVar as string) || 'x';
            let solvedVal = 0;
            let solutionStr = '?';

            try {
                // Security Check: Only allow safe characters in the formula
                // Allowed: Integers, decimals, letters, underscores, parens, operators (+-*/^=), spaces
                if (!payload.formula || /[^a-zA-Z0-9_\.\s\+\-\*\/\^\(\),=]/.test(payload.formula)) {
                    throw new Error("Invalid characters in formula");
                }

                // We use nerdamer to solve the expression assuming LHS = 0
                // So if input is "x - 5", it solves for x - 5 = 0 -> x = 5.
                const result = (nerdamer as any).solve(payload.formula, targetVar);
                const sol = result.toString();
                solutionStr = sol;

                // Extract first numeric solution
                const cleanSol = sol.replace(/[\[\]]/g, '');
                // Handle multiple solutions by taking the first one
                const firstSol = cleanSol.split(',')[0];
                const num = Number(firstSol);
                if (!isNaN(num)) solvedVal = num;
            } catch (e) {
                // Silent fail for solver - it's common to have unsolvable states while typing
                solutionStr = "Error";
            }

            return cacheAndReturn({
                formula: `${solvedVal}`, // We return the CONCRETE solved value as the formula for downstream nodes
                scope: {}, // Constant value has no variables
                display: solutionStr,
                val: solvedVal
            });
        }

        case 'logicNode': {
            const edgeA = edges.find(e => e.target === nodeId && (e.targetHandle === 'inputA'));
            const edgeB = edges.find(e => e.target === nodeId && (e.targetHandle === 'inputB'));

            const pA = edgeA ? pullValue(edgeA.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const pB = edgeB ? pullValue(edgeB.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const op = (node.data.operation as string) || 'AND';
            let res = 0;
            let sym = 'and'; // mathjs operator

            // Inputs are treated as truthy/falsy
            const valA = pA.val !== 0;
            const valB = pB.val !== 0;

            switch (op) {
                case 'AND': res = (valA && valB) ? 1 : 0; sym = 'and'; break;
                case 'OR': res = (valA || valB) ? 1 : 0; sym = 'or'; break;
                case 'XOR': res = (valA !== valB) ? 1 : 0; sym = 'xor'; break;
                case 'NAND': res = !(valA && valB) ? 1 : 0; sym = 'and'; break; // Special case for formula
            }

            // MathJS formula construction for NAND is complex (not(a and b))
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

            const pCond = edgeCond ? pullValue(edgeCond.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            // Lazy Pulling: Only pull branch if needed for the VALUE calculation
            // But for Formula generation we might need both? 
            // In a reactive graph pull, we usually want the current value to be fast.
            const condition = pCond.val !== 0;

            // Always pull results for formula completeness if we want a static expression?
            // No, follow the "Pull" philosophy: only calculate what is requested.
            // If we want a symbolic representation of the whole graph, we'd need to pull all.
            // For now, let's balance:
            const pTrue = edgeTrue ? pullValue(edgeTrue.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const pFalse = edgeFalse ? pullValue(edgeFalse.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const resVal = condition ? pTrue.val : pFalse.val;

            return cacheAndReturn({
                // Use math.js ternary syntax (condition ? trueVal : falseVal)
                formula: `(${pCond.formula} ? ${pTrue.formula} : ${pFalse.formula})`,
                scope: { ...pCond.scope, ...pTrue.scope, ...pFalse.scope },
                display: condition ? pTrue.display : pFalse.display,
                val: resVal
            });
        }


        // Placeholder for other nodes
        default:
            return cacheAndReturn(FALLBACK_PAYLOAD);
    }
};

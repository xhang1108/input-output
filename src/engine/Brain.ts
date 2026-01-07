import { Node, Edge } from '@xyflow/react';
import * as math from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Solve';

// --- Types ---

export interface NodePayload {
    formula: string;    // Safe ID formula for MathJS (e.g. "node_a + node_b")
    scope: Record<string, number>; // Variable values (e.g. { node_a: 10, node_b: 20 })
    display: string;    // Human-readable formula (e.g. "Rent + Tax")
    val: number;        // Preview value for this node
}

// --- Constants ---

export const FALLBACK_PAYLOAD: NodePayload = {
    formula: "0",
    scope: {},
    display: "0",
    val: 0
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
    if (visited.has(nodeId)) {
        throw new Error(`Cycle detected at node ${nodeId}`);
    }
    const newVisited = new Set(visited);
    newVisited.add(nodeId);

    // 2. Find Node
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return FALLBACK_PAYLOAD;

    // 3. Node Logic Switch
    switch (node.type) {
        case 'inputNode': {
            const val = Number(node.data.value) || 0;
            // Use node ID as variable name in scope to ensure uniqueness
            // Use label for display
            // Clean ID to be safe for MathJS (usually IDs are safe, but better safe than sorry if we used UUIDs with dashes)
            // Actually MathJS handles many chars, but safeVar is better.
            // Our nanoid(8) might have dashes? nanoid default has -_.
            // Let's assume we treat ID as the key.
            // Namespace variables to avoid MathJS collisions (e.g. 'sin', 'pi', or leading numbers)
            const safeId = 'v_' + node.id.replace(/-/g, '_');

            return {
                formula: safeId,
                scope: { [safeId]: val },
                display: node.data.label ? String(node.data.label) : `${val}`,
                val: val
            };
        }

        case 'mathNode': {
            // Pull Inputs
            // MathNode expects inputs on handles 'inputA' and 'inputB' (or 'a' and 'b' depending on version, let's standardize on standardized 'inputA'/'inputB')
            // Wait, previous conversations said we standardized to 'inputA', 'inputB' for MathNode? 
            // Checking Body.tsx defaultEdges: targetHandle: 'inputA'
            // Checking Brain.ts (old): it used 'a' and 'b' in some places?
            // Let's look for edges targeting this node's 'inputA' and 'inputB'.

            // Standardize handles: 'inputA', 'inputB'
            const edgeA = edges.find(e => e.target === nodeId && (e.targetHandle === 'inputA' || e.targetHandle === 'a'));
            const edgeB = edges.find(e => e.target === nodeId && (e.targetHandle === 'inputB' || e.targetHandle === 'b'));

            const payloadA = edgeA ? pullValue(edgeA.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;
            const payloadB = edgeB ? pullValue(edgeB.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const op = (node.data.operation as string) || 'add';
            let calculatedVal = 0;
            let symbol = '+';

            switch (op) {
                case 'add': calculatedVal = Number(payloadA.val) + Number(payloadB.val); symbol = '+'; break;
                case 'sub': calculatedVal = Number(payloadA.val) - Number(payloadB.val); symbol = '-'; break;
                case 'mul': calculatedVal = Number(payloadA.val) * Number(payloadB.val); symbol = '*'; break;
                case 'div': {
                    const valA = Number(payloadA.val);
                    const valB = Number(payloadB.val);
                    calculatedVal = valB === 0 ? Infinity : valA / valB;
                    symbol = '/';
                    break;
                }
                case 'pow': calculatedVal = Math.pow(Number(payloadA.val), Number(payloadB.val)); symbol = '^'; break;
                case 'mod': calculatedVal = Number(payloadA.val) % Number(payloadB.val); symbol = '%'; break;
            }

            // Final safety filter
            if (isNaN(calculatedVal)) calculatedVal = 0;

            return {
                formula: `(${payloadA.formula} ${symbol} ${payloadB.formula})`,
                scope: { ...payloadA.scope, ...payloadB.scope },
                display: `(${payloadA.display} ${symbol} ${payloadB.display})`,
                val: calculatedVal
            };
        }

        case 'unaryNode': {
            const edge = edges.find(e => e.target === nodeId && (e.targetHandle === 'input' || e.targetHandle === 'inputA'));
            const payload = edge ? pullValue(edge.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const op = (node.data.operation as string) || 'sqrt';
            let val = 0;
            let funcName = op;

            const inputVal = Number(payload.val);
            switch (op) {
                case 'sqrt': val = Math.sqrt(inputVal); funcName = 'sqrt'; break;
                case 'sin': val = Math.sin(inputVal); funcName = 'sin'; break;
                case 'cos': val = Math.cos(inputVal); funcName = 'cos'; break;
                case 'tan': val = Math.tan(inputVal); funcName = 'tan'; break;
                case 'abs': val = Math.abs(inputVal); funcName = 'abs'; break;
                case 'log': val = Math.log(inputVal); funcName = 'log'; break;
                case 'round': val = Math.round(inputVal); funcName = 'round'; break;
            }

            return {
                formula: `${funcName}(${payload.formula})`,
                scope: { ...payload.scope },
                display: `${funcName}(${payload.display})`,
                val: val
            };
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

            return {
                // Determine formula representation for comparison?
                // MathJS supports comparison.
                formula: `(${pA.formula} ${sym} ${pB.formula})`,
                scope: { ...pA.scope, ...pB.scope },
                display: `(${pA.display} ${sym} ${pB.display})`,
                val: val
            };
        }

        case 'solverNode': {
            const edge = edges.find(e => e.target === nodeId && (e.targetHandle === 'input' || e.targetHandle === 'inputA'));
            const payload = edge ? pullValue(edge.source, nodes, edges, newVisited) : FALLBACK_PAYLOAD;

            const targetVar = (node.data.targetVar as string) || 'x';
            let solvedVal = 0;
            let solutionStr = '?';

            try {
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
                console.error("Solver failed:", e);
                solutionStr = "Error";
            }

            return {
                formula: `${solvedVal}`, // We return the CONCRETE solved value as the formula for downstream nodes
                scope: {}, // Constant value has no variables
                display: solutionStr,
                val: solvedVal
            };
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

            return {
                formula: formulaStr,
                scope: { ...pA.scope, ...pB.scope },
                display: displayStr,
                val: res
            };
        }


        // Placeholder for other nodes
        default:
            return FALLBACK_PAYLOAD;
    }
};

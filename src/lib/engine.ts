import { all, create, MathNode } from 'mathjs';

// Initialize Math.js instance
const math = create(all);

// --- Type Definitions ---

export type NodeData = {
    // UI Label
    label?: string;

    // User Input: Can be a number or a raw expression string (e.g., "2x + 5")
    value?: any; // [UPDATED] Allow number | Array | Matrix
    rawExpression?: string; // The string the user typed

    // Math Logic
    operation?: string; // For Math/Unary nodes (e.g., 'add', 'sin')

    // AST State
    ast?: MathNode;        // Local AST (e.g., "a + b")
    inheritedAST?: MathNode; // Full Tree (e.g., "(x^2) + 5")
    inheritedASTs?: Record<string, MathNode>; // For multi-output nodes
    subNetwork?: any; // For GroupNode

    // Lazy Evaluation State [NEW]
    version?: number; // Current version of this node's calculated output
    lastInputHash?: string; // Fingerprint of input versions used for last calc
    cachedResult?: any; // [UPDATED] Allow number | Array | Matrix
    cachedInheritedAST?: MathNode; // Cache for the formula tree

    [key: string]: unknown;
};

export type EdgeData = {
    source: string;
    target: string;
    targetHandle?: string | null | undefined;
    sourceHandle?: string | null | undefined;
    [key: string]: unknown;
};

// --- Helper: Build Local AST ---
function createLocalAST(node: { type?: string, data: NodeData }): MathNode {
    try {
        if (node.type === 'inputNode') {
            const expr = node.data.rawExpression || String(node.data.value ?? 0);
            return math.parse(expr);
        }

        if (node.type === 'mathNode') {
            const op = node.data.operation || 'add';
            switch (op) {
                case 'add': return math.parse('a + b');
                case 'sub': return math.parse('a - b');
                case 'mul': return math.parse('a * b');
                case 'div': return math.parse('a / b');
                case 'pow': return math.parse('a ^ b');
                case 'mod': return math.parse('a % b');
                default: return math.parse('a + b');
            }
        }

        if (node.type === 'unaryNode') {
            const op = node.data.operation || 'sqrt';
            switch (op) {
                case 'sin': return math.parse('sin(x)');
                case 'cos': return math.parse('cos(x)');
                case 'tan': return math.parse('tan(x)');
                case 'sqrt': return math.parse('sqrt(x)');
                case 'abs': return math.parse('abs(x)');
                case 'log': return math.parse('log(x, e)');
                case 'round': return math.parse('round(x)');
                default: return math.parse('x');
            }
        }

        if (node.type === 'outputNode') {
            return math.parse('x');
        }

    } catch (e) {
        // Silently fail for incomplete inputs (common during typing)
        // console.debug(`Parsing error for ${node.data?.label}:`, e);
        return math.parse('0');
    }

    return math.parse('0');
}

// --- Recursive Group Evaluation (Simplified for Lazy Eval?) ---
// Note: Group nodes might be complex to lazy eval internally, 
// for now we treat the Group Node as a single unit: if inputs change, re-run group logic.

function evaluateGroupNode(node: { data: NodeData }, inputASTs: Record<string, MathNode | null>): Record<string, MathNode> {
    const { subNetwork } = node.data;
    if (!subNetwork) return {};

    const { nodes, edges, inputMapping, outputMapping } = subNetwork;

    const internalNodes = nodes.map((n: any) => ({ ...n, data: { ...n.data } }));
    const virtualNodes: any[] = [];
    const virtualEdges: any[] = [];

    Object.entries(inputMapping).forEach(([groupHandleId, target]: [string, any]) => {
        const inputAST = inputASTs[groupHandleId];
        if (inputAST) {
            const virtualId = `__virtual_${groupHandleId}`;
            virtualNodes.push({
                id: virtualId,
                type: 'inputNode',
                data: { value: 0, inheritedAST: inputAST }
            });
            virtualEdges.push({
                source: virtualId,
                target: target.nodeId,
                targetHandle: target.handle,
                sourceHandle: null
            });
        }
    });

    const combinedNodes = [...internalNodes, ...virtualNodes];
    const combinedEdges = [...edges, ...virtualEdges];

    // Recursive call - this will run full eval on subnetwork based on new inputs
    const evaluatedMap = evaluateGraph(combinedNodes, combinedEdges);

    const results: Record<string, MathNode> = {};
    Object.entries(outputMapping as Record<string, { nodeId: string }>).forEach(([groupHandleId, source]: [string, any]) => {
        const sourceNode = evaluatedMap.get(source.nodeId);
        if (sourceNode && sourceNode.data.inheritedAST) {
            results[groupHandleId] = sourceNode.data.inheritedAST;
        }
    });

    return results;
}

// --- Main Engine ---

export function evaluateGraph(nodes: { id: string, type?: string, data: Record<string, unknown> }[], edges: EdgeData[]) {
    // 1. Create Lookup Maps
    const nodeMap = new Map<string, { id: string, type?: string, data: NodeData }>();
    nodes.forEach(node => {
        // We preserve existing data reference if possible to keep version history?
        // Actually valid if 'nodes' are new objects from React Flow, data might be stale or new.
        // We must ensure we prioritize the INCOMING data but keep the VERSION if it exists?
        // If the incoming data has a version, use it. If not, default to 0.
        nodeMap.set(node.id, {
            ...node,
            data: {
                ...node.data,
                rawExpression: (node.data.rawExpression as string) || String(node.data.value ?? 0),
                version: (node.data.version as number) || 0
            } as NodeData
        });
    });

    const nodeInputs = new Map<string, { handle: string | null | undefined, sourceId: string, sourceHandle: string | undefined, edgeId: string }[]>();
    nodes.forEach(n => nodeInputs.set(n.id, []));
    edges.forEach(edge => {
        const inputs = nodeInputs.get(edge.target) || [];
        inputs.push({
            handle: edge.targetHandle,
            sourceId: edge.source,
            sourceHandle: edge.sourceHandle || undefined,
            edgeId: `edge-${edge.source}-${edge.target}` // Simple edge ID for hashing
        });
        nodeInputs.set(edge.target, inputs);
    });

    // 2. Topological Sort
    const inDegree = new Map<string, number>();
    const graphAdj = new Map<string, string[]>();
    nodes.forEach(n => { inDegree.set(n.id, 0); graphAdj.set(n.id, []); });
    edges.forEach(e => {
        graphAdj.get(e.source)?.push(e.target);
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    });

    const queue: string[] = [];
    inDegree.forEach((degree, id) => { if (degree === 0) queue.push(id); });

    const sortedIds: string[] = [];
    while (queue.length > 0) {
        const u = queue.shift()!;
        sortedIds.push(u);
        const neighbors = graphAdj.get(u) || [];
        for (const v of neighbors) {
            inDegree.set(v, (inDegree.get(v) || 0) - 1);
            if (inDegree.get(v) === 0) queue.push(v);
        }
    }

    // 3. Evaluation
    const evaluatedNodes = new Map();

    sortedIds.forEach(nodeId => {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        // --- Lazy Evaluation Check ---

        // A. Calculate Input Hash (Fingerprint of dependencies)
        // Hash = "SourceID:Version|SourceID:Version|..." + "NodeInternalConfig"
        const inputs = nodeInputs.get(nodeId) || [];

        // Sort inputs to ensure stable hash
        const sortedInputs = [...inputs].sort((a, b) => a.sourceId.localeCompare(b.sourceId));

        let inputHashParts: string[] = [];

        // Check upstream versions
        let maxUpstreamVersionLength = 0; // Just for debugging or complexity check

        for (const input of sortedInputs) {
            const sourceNode = evaluatedNodes.get(input.sourceId);
            const sourceVersion = sourceNode ? (sourceNode.data.version || 0) : 0;
            // Also include sourceHandle to be precise if multi-output changes independently?
            // For now, node version covers all outputs.
            inputHashParts.push(`${input.sourceId}:${sourceVersion}`);
        }

        // B. Calculate Internal Config Hash
        // Changes if operation/expression changes
        const internalConfig = `${node.type}:${node.data.rawExpression}:${node.data.operation}`;

        const currentInputHash = `${internalConfig}|${inputHashParts.join('|')}`;

        // C. Compare with Last Hash
        const lastHash = node.data.lastInputHash as string | undefined;

        // If Hash Matches -> SKIP RECOMPUTE (Return Cached)
        // Exception: If node has NO version (first run), force compute.
        // Exception: groupNode always recompute subnetwork? Maybe optimize later. 
        // For strict lazy eval: if inputs to group are same, output is same.
        if (lastHash === currentInputHash && node.data.version !== undefined && node.data.cachedResult !== undefined) {
            // Cache Hit: Propagate cached values
            node.data.value = node.data.cachedResult;
            node.data.inheritedAST = node.data.cachedInheritedAST;
            // inheritedASTs?

            evaluatedNodes.set(nodeId, node);
            return;
        }

        // --- Cache Miss: Compute ---

        const getSourceAST = (handleName: string): MathNode | null => {
            let targetHandle = handleName;
            if (node.type === 'unaryNode' || node.type === 'outputNode' || node.type === 'solverNode') {
                if (handleName === 'x') targetHandle = 'in';
            }
            const connection = inputs.find(i => i.handle === targetHandle || (inputs.length === 1 && !i.handle));

            if (connection) {
                const sourceNode = evaluatedNodes.get(connection.sourceId);
                if (!sourceNode) return null;
                if (sourceNode.data.inheritedASTs && connection.sourceHandle) {
                    return sourceNode.data.inheritedASTs[connection.sourceHandle] || null;
                }
                return sourceNode.data.inheritedAST || null;
            }
            return null;
        };

        if (node.type === 'groupNode') {
            const groupInputs: Record<string, MathNode | null> = {};
            const inputDefs = (node.data.inputs as { id: string }[]) || [];
            inputDefs.forEach(def => {
                const inputs = nodeInputs.get(nodeId) || [];
                const connection = inputs.find(i => i.handle === def.id);
                if (connection) {
                    const sourceNode = evaluatedNodes.get(connection.sourceId);
                    if (sourceNode) {
                        if (sourceNode.data.inheritedASTs && connection.sourceHandle) {
                            groupInputs[def.id] = sourceNode.data.inheritedASTs[connection.sourceHandle];
                        } else {
                            groupInputs[def.id] = sourceNode.data.inheritedAST || null;
                        }
                    } else { groupInputs[def.id] = null; }
                } else { groupInputs[def.id] = null; }
            });

            try {
                const outputs = evaluateGroupNode(node, groupInputs);
                node.data.inheritedASTs = outputs;
                node.data.inheritedAST = Object.values(outputs)[0];
            } catch (e) {
                console.error("Group evaluation failed", e);
            }
        } else {
            // Standard Logic
            // Always generate local AST to capture internal changes (covered by internalHash check)
            node.data.ast = createLocalAST(node);

            if (node.data.ast) {
                const resolvedAST = node.data.ast.transform(function (childNode, path, parent) {
                    const cNode = childNode as any;
                    if (cNode.isSymbolNode || cNode.type === 'SymbolNode') {
                        const sourceTree = getSourceAST(cNode.name);
                        if (sourceTree) {
                            const sNode = sourceTree as any;
                            const isSimple = sNode.isConstantNode || sNode.type === 'ConstantNode' || sNode.isSymbolNode || sNode.type === 'SymbolNode';
                            if (isSimple) return sourceTree;
                            return new math.ParenthesisNode(sourceTree);
                        }
                    }
                    return childNode;
                });
                node.data.inheritedAST = resolvedAST;
            }
        }

        // Numeric Evaluation
        if (node.type !== 'groupNode' && node.data.inheritedAST) {
            try {
                const compiled = node.data.inheritedAST.compile();
                const result = compiled.evaluate({});
                // Allow any result type (number, Matrix, Array)
                node.data.value = result;
            } catch (e) {
                console.warn('Evaluation error:', e);
                node.data.value = NaN;
            }
        }

        // Update State
        // Increment version because we recomputed (and result presumably implies a change from previous state if inputHash changed)
        // Optimization: We COULD compare new value vs old value. If same, keep old version. 
        // But hash check confirms inputs changed, likely output changed. 
        // Let's strictly increment version on recompute to safeguard side effects.
        node.data.version = (node.data.version || 0) + 1;
        node.data.lastInputHash = currentInputHash;
        node.data.cachedResult = node.data.value; // Store for next time
        node.data.cachedInheritedAST = node.data.inheritedAST;

        evaluatedNodes.set(nodeId, node);
    });

    return evaluatedNodes;
}

export type NodeData = {
    label?: string;
    value?: number;
    operation?: string;
    [key: string]: unknown;
};

export type EdgeData = {
    source: string;
    target: string;
    targetHandle?: string | null;
    [key: string]: unknown;
};

export function evaluateGraph(nodes: NodeData[], edges: EdgeData[]) {
    // 1. Create a map of nodes for quick access
    const nodeMap = new Map();
    nodes.forEach(node => {
        // Clone data to avoid mutating original immediately
        // @ts-expect-error - node has id from React Flow
        nodeMap.set(node.id, { ...node, data: { ...node.data } });
    });

    // 2. Build adjacency list (which nodes depend on which)
    // We need to know: for a given node, what are its inputs?
    const inputs = new Map<string, { id: string, handle: string | null, value: number }[]>();

    // Initialize inputs for all nodes
    // @ts-expect-error - node has id from React Flow
    nodes.forEach(n => inputs.set(n.id, []));

    edges.forEach(edge => {
        const targetInputs = inputs.get(edge.target);
        if (targetInputs) {
            // We store the source ID. We'll resolve value during traversal.
            targetInputs.push({
                id: edge.source,
                handle: edge.targetHandle || null,
                value: 0 // Placeholder
            });
        }
    });

    // 3. Topological Sort (Kahn's Algorithm) or just recursive evaluation with memoization
    // Dependency Graph for sorting
    const deps = new Map<string, string[]>();
    // @ts-expect-error - node has id from React Flow
    nodes.forEach(n => deps.set(n.id, []));
    edges.forEach(e => {
        deps.get(e.target)?.push(e.source);
    });

    // Sort
    const sorted: string[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    let hasCycle = false;

    function visit(id: string) {
        if (hasCycle) return;
        if (temp.has(id)) { hasCycle = true; return; }
        if (visited.has(id)) return;

        temp.add(id);
        const dependencies = deps.get(id) || [];
        for (const depId of dependencies) {
            visit(depId);
        }
        temp.delete(id);
        visited.add(id);
        sorted.push(id);
    }

    // @ts-expect-error - node has id from React Flow
    nodes.forEach(n => {
        if (!visited.has(n.id)) visit(n.id);
    });

    if (hasCycle) {
        console.warn("Cycle detected in graph, stopping evaluation");
        return nodeMap;
    }

    // 4. Evaluate in order
    const results = new Map<string, number>(); // Map nodeID -> computed value

    sorted.forEach(nodeId => {
        const node = nodeMap.get(nodeId);
        if (!node) return;

        // Get inputs values
        const nodeInputs = inputs.get(nodeId) || [];
        const inputValues = nodeInputs.map(input => {
            // input.id is the source node ID
            // value comes from results (if computed) or nodeMap (if source was input node)
            const sourceNode = nodeMap.get(input.id);
            const sourceValue = results.has(input.id) ? results.get(input.id) : sourceNode?.data.value;

            return {
                ...input,
                value: Number(sourceValue) || 0
            };
        });

        // Compute based on type
        let newValue = node.data.value; // Default to existing (e.g. Input Node)

        if (node.type === 'mathNode') {
            const op = node.data.operation || 'add';
            // Assuming 2 inputs 'a' and 'b' for binary ops
            const valA = inputValues.find(i => i.handle === 'a')?.value || 0;
            const valB = inputValues.find(i => i.handle === 'b')?.value || 0;

            try {
                if (op === 'add') newValue = valA + valB;
                if (op === 'sub') newValue = valA - valB;
                if (op === 'mul') newValue = valA * valB;
                if (op === 'div') newValue = valA / valB;
            } catch (e) {
                console.error("Math error", e);
                newValue = NaN;
            }
        } else if (node.type === 'unaryNode') {
            const op = node.data.operation || 'sqrt';
            // Unary nodes have one input
            const val = inputValues.find(i => i.handle === 'in' || i.handle === 'default')?.value || (inputValues[0] ? inputValues[0].value : 0);

            try {
                if (op === 'sin') newValue = Math.sin(val);
                if (op === 'cos') newValue = Math.cos(val);
                if (op === 'tan') newValue = Math.tan(val);
                if (op === 'sqrt') newValue = Math.sqrt(val);
                if (op === 'abs') newValue = Math.abs(val);
                if (op === 'log') newValue = Math.log(val);
                if (op === 'round') newValue = Math.round(val);
            } catch (e) {
                console.error("Math error", e);
                newValue = NaN;
            }
        } else if (node.type === 'outputNode') {
            // Pass through first input
            if (inputValues.length > 0) {
                newValue = inputValues[0].value;
            }
        }

        // Store result
        results.set(nodeId, newValue);

        // Update the cloned node data
        node.data = { ...node.data, value: newValue };
    });

    return nodeMap;
}

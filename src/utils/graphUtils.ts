import { Edge } from '@xyflow/react';

/**
 * Traces the graph backward from a target node to find all ancestor nodes and edges.
 * Only includes paths that actually lead to the target node.
 */
export function findUpstreamPath(targetNodeId: string, edges: Edge[]): { nodeIds: string[], edgeIds: string[] } {
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();
    const queue: string[] = [targetNodeId];

    // Note: We don't add the targetNodeId to visitedNodes immediately 
    // because we want to highlight it too, but the loop processes its inputs.
    visitedNodes.add(targetNodeId);

    let head = 0;
    while (head < queue.length) {
        const currentNodeId = queue[head++];
        
        // Find all edges pointing TO the current node
        const incomingEdges = edges.filter(e => e.target === currentNodeId);
        
        for (const edge of incomingEdges) {
            visitedEdges.add(edge.id);
            if (!visitedNodes.has(edge.source)) {
                visitedNodes.add(edge.source);
                queue.push(edge.source);
            }
        }
    }

    return {
        nodeIds: Array.from(visitedNodes),
        edgeIds: Array.from(visitedEdges)
    };
}

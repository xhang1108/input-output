import { Edge } from '@xyflow/react';
import { GraphState, NodeLogic } from './types';

/**
 * ️ TopologyManager
 * 
 * Handles graph structure, adjacency indices, and dirty propagation logic.
 * Decouples structural logic from high-level orchestration.
 */
export class TopologyManager {
    private adjacency: Map<string, string[]> = new Map(); // Source -> Targets[]
    private reverseAdjacency: Map<string, { nodeId: string, sourceHandle: string, targetHandle: string }[]> = new Map(); // Target -> Inputs[]

    constructor() { }

    public updateAdjacency(edge: Edge, action: 'ADD' | 'REMOVE') {
        // 1. Forward Adjacency
        const targets = this.adjacency.get(edge.source) || [];
        if (action === 'ADD') {
            targets.push(edge.target);
            this.adjacency.set(edge.source, targets);
        } else {
            const index = targets.indexOf(edge.target);
            if (index !== -1) {
                targets.splice(index, 1);
                this.adjacency.set(edge.source, targets);
            }
        }

        // 2. Reverse Adjacency
        const inputs = this.reverseAdjacency.get(edge.target) || [];
        if (action === 'ADD') {
            inputs.push({ nodeId: edge.source, sourceHandle: edge.sourceHandle!, targetHandle: edge.targetHandle! });
            this.reverseAdjacency.set(edge.target, inputs);
        } else {
            const index = inputs.findIndex(i => i.nodeId === edge.source && i.sourceHandle === edge.sourceHandle && i.targetHandle === edge.targetHandle);
            if (index !== -1) {
                inputs.splice(index, 1);
                this.reverseAdjacency.set(edge.target, inputs);
            }
        }
    }

    public getChildren(nodeId: string): string[] {
        return this.adjacency.get(nodeId) || [];
    }

    public getInputs(nodeId: string): { nodeId: string, sourceHandle: string, targetHandle: string }[] {
        return this.reverseAdjacency.get(nodeId) || [];
    }

    public triggerDirtyChain(startNodeId: string, nodes: Map<string, NodeLogic>) {
        const children = this.getChildren(startNodeId);
        for (const childId of children) {
            const childNode = nodes.get(childId);
            if (childNode && !childNode.isInDirtyChain) {
                childNode.isInDirtyChain = true;
            }
        }
    }

    public syncFromGraph(edges: Edge[]) {
        this.adjacency.clear();
        this.reverseAdjacency.clear();
        edges.forEach(edge => this.updateAdjacency(edge, 'ADD'));
    }

    public clear() {
        this.adjacency.clear();
        this.reverseAdjacency.clear();
    }
}

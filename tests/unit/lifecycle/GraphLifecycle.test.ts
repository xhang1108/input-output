import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { Node, Edge } from '@xyflow/react';

describe('GraphLifecycle Core Stability', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getComputeSession('test-lifecycle');
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should maintain topological integrity through multiple BATCH transactions', async () => {
        const initialNodes: Node[] = [
            { id: 'n1', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 10 } },
            { id: 'n2', type: 'mathNode', position: { x: 100, y: 0 }, data: { opcode: 'add' } }
        ];

        // 1. Initial Batch
        await brain.applyTransaction({
            type: 'BATCH',
            payload: initialNodes.map(n => ({ type: 'ADD_NODE', payload: n }))
        });

        // 2. Connect
        await brain.applyTransaction({
            type: 'CONNECT',
            payload: { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'in_a' } as Edge
        });

        expect(brain.getNodesMap().size).toBe(2);
        expect(brain.getEdges().length).toBe(1);

        // 3. Batch Remove and Add (Replacement)
        await brain.applyTransaction({
            type: 'BATCH',
            payload: [
                { type: 'REMOVE_NODE', payload: 'n2' },
                { type: 'ADD_NODE', payload: { id: 'n3', type: 'OT-01', position: { x: 200, y: 0 } } }
            ]
        });

        expect(brain.getNodesMap().has('n2')).toBe(false);
        expect(brain.getNodesMap().has('n3')).toBe(true);
        // Edge should be gone because n2 was removed
        expect(brain.getEdges().length).toBe(0);
    });

    it('should correctly handle MOVE_NODE without breaking existing connections', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'n1', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 1 } },
                { id: 'n2', type: 'OT-01', position: { x: 100, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'in_a' }
            ]
        });

        // Move node
        await brain.applyTransaction({
            type: 'MOVE_NODE',
            payload: { id: 'n1', position: { x: 50, y: 50 } }
        });

        const n1 = brain.getNode('n1');
        expect(n1?.position).toEqual({ x: 50, y: 50 });
        expect(brain.getEdges().length).toBe(1); // Connection should still exist
    });
});


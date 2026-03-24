import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Brain } from '../Brain';
import { DataType } from '../../types/payload';
import { NodeRegistry } from '../NodeRegistry';
import { NodeLogic } from '../types';

describe('State Orchestration (Integration)', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        // Reset brain state
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    afterEach(() => {
        brain.dispose();
    });

    describe('Undo/Redo Stability', () => {
        it('should maintain perfect state consistency through a complex transaction sequence', async () => {
            // 1. Initial Step: Add two nodes
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'A', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 10 } }
            });
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'B', type: 'MA-01', position: { x: 200, y: 0 }, data: { op: 'ADD' } }
            });

            const stateAfterAdd = JSON.stringify(Array.from(brain.getNodesMap().values()));

            // 2. Connect them
            brain.applyTransaction({
                type: 'CONNECT',
                payload: { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' }
            });

            // 3. Move them
            brain.applyTransaction({
                type: 'MOVE_NODE',
                payload: { id: 'A', position: { x: 50, y: 50 } }
            });

            // 4. Undo Move
            brain.undo();
            expect(brain.getNode('A')?.position).toEqual({ x: 0, y: 0 });

            // 5. Undo Connect
            brain.undo();
            expect(brain.getEdges()).toHaveLength(0);

            // 6. Undo Add B
            brain.undo();
            expect(brain.getNodesMap().size).toBe(1);

            // 7. Redo Add B
            brain.redo();
            expect(brain.getNodesMap().size).toBe(2);

            // 8. Undo everything back to empty
            brain.undo(); // Undo Redo
            brain.undo(); // Undo Add B
            brain.undo(); // Undo Add A
            
            expect(brain.getNodesMap().size).toBe(0);
            expect(brain.getEdges()).toHaveLength(0);
        });
    });

    describe('Node Muting & Signal Flow', () => {
        it('should correctly deactivate downstream edges when a source node is muted', async () => {
            // Setup: A (Source) -> B (Math)
            await brain.injectNodes({
                nodes: [
                    { id: 'A', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 5 } },
                    { id: 'B', type: 'MA-01', position: { x: 200, y: 0 }, data: { op: 'ADD' } }
                ],
                edges: [
                    { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' }
                ]
            });

            // Simulate calculation response from worker to populate 'value'
            // In integration test, we can manually set value for A
            const nodeA = brain.getNodesMap().get('A');
            if (nodeA) {
                nodeA.value = { type: DataType.Scalar, value: 5, symbol: null, meta: {} };
            }

            const patches = new Map();
            patches.set('A', nodeA!.value);
            (brain as any).applyWorkerResults(patches);

            // Initially, A is not muted and has value, so edge e1 should be active
            expect(brain.getEdges()[0].data?.active).toBe(true);

            // Mute A
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id: 'A', data: { muted: true } }
            });

            // Trigger signal update with a dummy patch to satisfy size > 0 check
            (brain as any).applyWorkerResults(patches);

            // Edge should be inactive
            expect(brain.getEdges()[0].data?.active).toBe(false);

            // Unmute A
            brain.applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id: 'A', data: { muted: false } }
            });

            (brain as any).applyWorkerResults(patches);

            // Edge should be active again
            expect(brain.getEdges()[0].data?.active).toBe(true);
        });
    });
});

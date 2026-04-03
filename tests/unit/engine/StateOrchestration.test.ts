import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Brain } from '@/engine/Brain';
import { DataType } from '@/types/payload';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { NodeLogic } from '@/engine/types/engineTypes';

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



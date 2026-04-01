/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBrainSync } from '../useBrainSync';
import { useBrainUpdates } from '../useBrainUpdates';
import { Brain } from '../../engine/Brain';
import { Node, Edge } from '@xyflow/react';

// Mock useHistoryStore to avoid actual store side-effects
vi.mock('../../store/useHistoryStore', () => ({
    useHistoryStore: (selector: any) => selector({ isRestoring: false, push: vi.fn() })
}));

// Mock BrainContext if needed, but useBrain has a fallback to Brain.getComputeSession('main')
// We will manually use a test session to avoid polluting 'main'.
vi.mock('../../context/BrainContext', () => ({
    useBrain: () => Brain.getComputeSession('test-hook-sync')
}));

describe('BrainInteractions Integration (Hooks)', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getComputeSession('test-hook-sync');
        // Clear brain state before each test
        await brain.injectNodes({ nodes: [], edges: [] }, true);
        vi.clearAllMocks();
    });

    describe('useBrainSync', () => {
        it('should sync new nodes from UI to Brain', async () => {
            const nodes: Node[] = [
                { id: 'node-1', type: 'mathNode', position: { x: 100, y: 100 }, data: { value: 5 } }
            ];
            const edges: Edge[] = [];

            renderHook(() => useBrainSync(nodes, edges));

            const brainNode = brain.getNode('node-1');
            expect(brainNode).toBeDefined();
            expect(brainNode?.type).toBe('mathNode');
            expect(brainNode?.position).toEqual({ x: 100, y: 100 });
        });

        it('should handle node movement separately from structural batches', async () => {
            const initialNodes: Node[] = [
                { id: 'node-1', type: 'mathNode', position: { x: 100, y: 100 }, data: { value: 5 } }
            ];
            const spy = vi.spyOn(brain, 'applyTransaction');

            const { rerender } = renderHook(
                ({ n, e }) => useBrainSync(n, e),
                { initialProps: { n: initialNodes, e: [] as Edge[] } }
            );

            // Move node
            const movedNodes: Node[] = [
                { ...initialNodes[0], position: { x: 110, y: 110 } }
            ];

            await act(async () => {
                rerender({ n: movedNodes, e: [] });
            });

            // Verify MOVE_NODE transaction was called
            expect(spy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'MOVE_NODE',
                    payload: expect.objectContaining({ id: 'node-1', position: { x: 110, y: 110 } })
                }),
                false // isPassive
            );
        });

        it('should sync edge connections', async () => {
            const nodes: Node[] = [
                { id: 'n1', type: 'IN-01', position: { x: 0, y: 0 }, data: {} },
                { id: 'n2', type: 'OT-01', position: { x: 100, y: 0 }, data: {} }
            ];
            const edges: Edge[] = [
                { id: 'e1', source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'in_a' }
            ];

            renderHook(() => useBrainSync(nodes, edges));

            const brainEdges = brain.getEdges();
            expect(brainEdges.length).toBe(1);
            expect(brainEdges[0].id).toBe('e1');
            expect(brainEdges[0].source).toBe('n1');
        });
    });

    describe('useBrainUpdates', () => {
        it('should update React nodes when Brain results change', async () => {
            const setNodes = vi.fn();
            const setEdges = vi.fn();

            renderHook(() => useBrainUpdates(setNodes, setEdges));

            // Use a proper Brain payload (Scalar)
            const payload = { type: 'scalar', value: 42, meta: { rank: 0, dimensions: [] } };
            const mockUpdates = new Map<string, any>();
            mockUpdates.set('node-1', payload);

            await act(async () => {
                // @ts-ignore - accessing internal event emitter for testing
                brain.emit('graphChanged', mockUpdates);
            });

            expect(setNodes).toHaveBeenCalled();
            // Verify the updater function was called
            const updater = setNodes.mock.calls[0][0];
            // Simulate a mathNode (Non-Input)
            const currentNodes: Node[] = [{ id: 'node-1', type: 'mathNode', data: { value: 0 }, position: { x: 0, y: 0 } }];
            const nextNodes = updater(currentNodes);
            
            // For mathNode, data.value should be the full payload
            expect(nextNodes[0].data.value).toEqual(payload);
        });
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Brain } from '@/engine/Brain';
import { NodeRegistry } from '@/engine/NodeRegistry';

describe('Propagation Convergence', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getComputeSession('test-propagation');
        await brain.injectNodes({ nodes: [], edges: [] }, true);
        // Ensure nodes are initialized
        NodeRegistry.initializeNodes();
    });

    it('should propagate through a chain of 30 nodes in a single evaluation session', async () => {
        // 1. Create a chain: N0 (Input) -> N1 (Result) -> N2 (Result) -> ... -> N29 (Result)
        const nodes = [];
        const edges = [];
        const chainLength = 30;

        // Node N0 is the root producer (IN-01)
        nodes.push({
            id: 'N0',
            type: 'IN-01',
            position: { x: 0, y: 0 },
            data: { value: 10 }
        });

        // The rest are consumer nodes (OT-01) that pass through the value
        for (let i = 1; i < chainLength; i++) {
            nodes.push({
                id: `N${i}`,
                type: 'OT-01', // Result node (pass-through evaluator)
                position: { x: i * 100, y: 0 },
                data: {}
            });

            edges.push({
                id: `e${i}`,
                source: `N${i - 1}`,
                sourceHandle: 'out',
                target: `N${i}`,
                targetHandle: 'in_a'
            });
        }

        // 2. Inject the graph
        await brain.injectNodes({ nodes, edges }, true);

        // 3. Manually trigger recalculateDirtyChain (non-worker mode)
        const patches = await (brain as any).recalculateDirtyChain();

        // 4. Verify results
        const lastNodeId = `N${chainLength - 1}`;
        const lastVal = brain.peekValue(lastNodeId);
        expect(lastVal).not.toBeNull();
        expect(lastVal?.value).toBe(10);
    });

    it('should handle a very long chain (100 nodes) correctly', async () => {
        const nodes = [];
        const edges = [];
        const chainLength = 100;

        nodes.push({
            id: 'L0',
            type: 'IN-01',
            position: { x: 0, y: 0 },
            data: { value: 500 }
        });

        for (let i = 1; i < chainLength; i++) {
            nodes.push({
                id: `L${i}`,
                type: 'OT-01',
                position: { x: i * 50, y: i * 50 },
                data: {}
            });

            edges.push({
                id: `le${i}`,
                source: `L${i - 1}`,
                sourceHandle: 'out',
                target: `L${i}`,
                targetHandle: 'in_a'
            });
        }

        await brain.injectNodes({ nodes, edges }, true);
        await (brain as any).recalculateDirtyChain();

        const lastNodeId = `L${chainLength - 1}`;
        const lastVal = brain.peekValue(lastNodeId);
        expect(lastVal?.value).toBe(500);
    });

    it('should evaluate isolated nodes after injection (markAllDirty verification)', async () => {
        const nodes = [
            { id: 'ISO', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 42 } }
        ];
        
        await brain.injectNodes({ nodes, edges: [] }, true);
        
        // Before evaluation, value should be undefined in engine state (since Serializer prunes it)
        // Wait, injectNodes sets initialValue. Let's see if it's already there.
        // Actually injectNodes calls applyTransaction('ADD_NODE', { initialValue: 42 })
        // TransactionManager sets node.value = initialValue.
        // BUT, the evaluator for IN-01 might return a DIFFERENT value if it does some rounding or unit conversion.
        // And we want to ensure it RUNS.
        
        const patches = await (brain as any).recalculateDirtyChain();
        
        expect(patches.size).toBeGreaterThan(0);
        expect(patches.has('ISO')).toBe(true);
        expect(brain.peekValue('ISO')?.value).toBe(42);
    });
});



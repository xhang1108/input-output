import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '../Brain';

describe('Brain', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        // Reset brain state before each test
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    describe('Basic State Management', () => {
        it('should add a node correctly', async () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: {
                    id: 'N1',
                    type: 'IO-01',
                    position: { x: 10, y: 10 },
                    data: { label: 'Test Node', value: 10 }
                }
            });

            const nodes = Array.from(brain.getNodesMap().values());
            expect(nodes).toHaveLength(1);
            expect(nodes[0].id).toBe('N1');
        });

        it('should remove a node correctly', async () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'N1', type: 'IO-01', position: { x: 0, y: 0 }, data: {} }
            });
            expect(brain.getNodesMap().size).toBe(1);

            brain.applyTransaction({
                type: 'REMOVE_NODE',
                payload: 'N1'
            });
            expect(brain.getNodesMap().size).toBe(0);
        });

        it('should connect nodes correctly', async () => {
            await brain.injectNodes({
                nodes: [
                    { id: 'A', type: 'IO-01', position: { x: 0, y: 0 }, data: { value: 5 } },
                    { id: 'B', type: 'IO-11', position: { x: 100, y: 0 }, data: {} }
                ],
                edges: []
            });

            brain.applyTransaction({
                type: 'CONNECT',
                payload: {
                    id: 'e1',
                    source: 'A',
                    sourceHandle: 'out',
                    target: 'B',
                    targetHandle: 'in'
                }
            });

            expect(brain.getEdges()).toHaveLength(1);
            expect(brain.getEdges()[0].id).toBe('e1');
        });
    });

    describe('Calculations', () => {
        it('should perform addition correctly', async () => {
            // Setup: A(10) + B(20) = Result
            await brain.injectNodes({
                nodes: [
                    { id: 'A', type: 'IO-01', position: { x: 0, y: 0 }, value: 10 },
                    { id: 'B', type: 'IO-01', position: { x: 0, y: 50 }, value: 20 },
                    { id: 'Add', type: 'MA-01', position: { x: 100, y: 25 }, data: { op: 'ADD' } },
                    { id: 'Res', type: 'IO-11', position: { x: 200, y: 25 } }
                ],
                edges: [
                    { id: 'e1', source: 'A', sourceHandle: 'out', target: 'Add', targetHandle: 'in_a' },
                    { id: 'e2', source: 'B', sourceHandle: 'out', target: 'Add', targetHandle: 'in_b' },
                    { id: 'e3', source: 'Add', sourceHandle: 'out', target: 'Res', targetHandle: 'in' }
                ]
            });

            const result = await brain.getValue('Res');
            expect(result.value).toBe(30);
        });

        it('should update results when input values change', async () => {
            await brain.injectNodes({
                nodes: [
                    { id: 'A', type: 'IO-01', position: { x: 0, y: 0 }, value: 5 },
                    { id: 'Res', type: 'IO-11', position: { x: 100, y: 0 } }
                ],
                edges: [
                    { id: 'e1', source: 'A', sourceHandle: 'out', target: 'Res', targetHandle: 'in' }
                ]
            });

            expect((await brain.getValue('Res')).value).toBe(5);

            // Update A to 10
            brain.applyTransaction({
                type: 'UPDATE_VALUE',
                payload: { id: 'A', value: 10 }
            });

            expect((await brain.getValue('Res')).value).toBe(10);
        });
    });
});

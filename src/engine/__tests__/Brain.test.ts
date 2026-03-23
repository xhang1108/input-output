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

    describe('Content Metrics Protocol', () => {
        it('updateNodeBoundingBox should write width/height into NodeLogic', () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'N1', type: 'UI-01', position: { x: 100, y: 200 }, data: {} }
            });

            brain.updateNodeBoundingBox('N1', { width: 320, height: 180 });
            const bbox = brain.getNodeBoundingBox('N1');

            expect(bbox).not.toBeNull();
            expect(bbox!.width).toBe(320);
            expect(bbox!.height).toBe(180);
        });

        it('updateNodeBoundingBox should store absolute canvas position', () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'N2', type: 'UI-01', position: { x: 50, y: 75 }, data: {} }
            });

            brain.updateNodeBoundingBox('N2', { width: 100, height: 50 });
            const bbox = brain.getNodeBoundingBox('N2');

            // Absolute position should match node.position for a root node (no parent)
            expect(bbox!.x).toBe(50);
            expect(bbox!.y).toBe(75);
        });

        it('getNodeBoundingBox should return null before any measurement', () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'N3', type: 'UI-01', position: { x: 0, y: 0 }, data: {} }
            });

            expect(brain.getNodeBoundingBox('N3')).toBeNull();
        });

        it('updateNodeBoundingBox should not add to undo history', () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'N4', type: 'UI-01', position: { x: 0, y: 0 }, data: {} }
            });

            // Undo the ADD_NODE to get back to empty
            brain.undo();
            expect(brain.getNodesMap().size).toBe(0);

            // Re-add the node
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: { id: 'N4', type: 'UI-01', position: { x: 0, y: 0 }, data: {} }
            });

            // Write bounding box — should NOT pollute history
            brain.updateNodeBoundingBox('N4', { width: 200, height: 100 });

            // Undo should remove the ADD_NODE, not the bounding box write
            brain.undo();
            expect(brain.getNodesMap().size).toBe(0);
        });
    });

    describe('Layout Authority', () => {
        it('computeBoundingBox returns null for unknown node', () => {
            expect(brain.computeBoundingBox('no-such-node')).toBeNull();
        });

        it('computeBoundingBox uses data.width/height when available', () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: {
                    id: 'LA-1', type: 'IN-07',
                    position: { x: 100, y: 50 },
                    data: { width: 152, height: 160 }
                }
            });

            const bbox = brain.computeBoundingBox('LA-1');
            expect(bbox).not.toBeNull();
            expect(bbox!.width).toBe(152);
            expect(bbox!.height).toBe(160);
        });

        it('computeBoundingBox falls back to nodeDefinitions minWidth/minHeight', () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: {
                    id: 'LA-2', type: 'IN-07',
                    position: { x: 0, y: 0 },
                    data: {}  // No width/height
                }
            });

            const bbox = brain.computeBoundingBox('LA-2');
            expect(bbox).not.toBeNull();
            // IN-07 minWidth=64, minHeight=88
            expect(bbox!.width).toBe(64);
            expect(bbox!.height).toBe(88);
        });

        it('refreshBoundingBoxes auto-runs after ADD_NODE', () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: {
                    id: 'LA-3', type: 'IN-07',
                    position: { x: 200, y: 300 },
                    data: {}
                }
            });

            // After applyTransaction, refreshBoundingBoxes should have set boundingBox
            const stored = brain.getNodeBoundingBox('LA-3');
            expect(stored).not.toBeNull();
            expect(stored!.width).toBe(64);  // fallback from minWidth
        });

        it('UI-reported bounding box takes priority over engine-computed', () => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: {
                    id: 'LA-4', type: 'IN-07',
                    position: { x: 0, y: 0 },
                    data: {}
                }
            });

            // UI reports actual measured size
            brain.updateNodeBoundingBox('LA-4', { width: 999, height: 777 });

            const bbox = brain.computeBoundingBox('LA-4');
            expect(bbox!.width).toBe(999);
            expect(bbox!.height).toBe(777);
        });
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Brain } from '../Brain';
import { TransactionManager } from '../TransactionManager';

describe('Coordinate Normalization', () => {
    let brain: Brain;

    beforeEach(() => {
        // Reset Brain instance for each test
        // @ts-ignore - access private instance for testing cleanup
        Brain.instance = undefined;
        brain = Brain.getInstance();
    });

    it('should store child positions as relative to their parent', () => {
        // 1. Add Parent Node (Frame)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'parent-1',
                type: 'frame',
                position: { x: 100, y: 100 },
                data: { width: 200, height: 200 }
            }
        });

        // 2. Add Child Node inside Parent
        // In the UI, the absolute pos might be {x: 120, y: 120}
        // Relative to parent (TL = 100-100=0, 100-100=0), it should be {x: 20, y: 20}
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'child-1',
                type: 'mathNode',
                position: { x: 20, y: 20 },
                parentId: 'parent-1'
            }
        });

        const child = brain.getNode('child-1');
        expect(child?.parentId).toBe('parent-1');
        expect(child?.position).toEqual({ x: 20, y: 20 });
    });

    it('should calculate correct absolute position for nested nodes', () => {
        // Parent at {100, 100}, Size {200, 200} -> Top Left at {0, 0}
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'parent-1',
                type: 'frame',
                position: { x: 100, y: 100 },
                data: { width: 200, height: 200 }
            }
        });

        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'child-1',
                type: 'mathNode',
                position: { x: 50, y: 50 },
                parentId: 'parent-1'
            }
        });

        // AbsPos = Parent.TL + Child.Rel
        // TL = 100 - (200/2) = 0
        // Abs = 0 + 50 = 50
        const absPos = brain.getAbsolutePosition('child-1');
        expect(absPos).toEqual({ x: 50, y: 50 });

        // Move Parent
        brain.applyTransaction({
            type: 'MOVE_NODE',
            payload: {
                id: 'parent-1',
                position: { x: 200, y: 200 }
            }
        });

        // New TL = 200 - 100 = 100
        // New Abs = 100 + 50 = 150
        const newAbsPos = brain.getAbsolutePosition('child-1');
        expect(newAbsPos).toEqual({ x: 150, y: 150 });

        // Child relative position should be unchanged
        expect(brain.getNode('child-1')?.position).toEqual({ x: 50, y: 50 });
    });

    it('should handle multi-level absolute position calculation', () => {
        // Parent 1 (Root)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'p1',
                type: 'frame',
                position: { x: 100, y: 100 },
                data: { width: 200, height: 200 }
            }
        });

        // Parent 2 (Child of P1)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'p2',
                type: 'frame',
                position: { x: 50, y: 50 }, // Relative to P1 (TL=0,0)
                parentId: 'p1',
                data: { width: 100, height: 100 }
            }
        });

        // Child 1 (Child of P2)
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'c1',
                type: 'mathNode',
                position: { x: 10, y: 10 }, // Relative to P2 (TL = 50 - 50 = 0?)
                parentId: 'p2'
            }
        });

        // P1 TL = 0,0
        // P2 Pos (Rel to P1) = 50,50. P2 TL (Rel to P1) = 50 - 50 = 0,0
        // C1 Abs = P1.TL + P2.RelTL + C1.Rel = 0 + 0 + 10 = 10
        const absPos = brain.getAbsolutePosition('c1');
        expect(absPos).toEqual({ x: 10, y: 10 });
    });

    it('should maintain absolute position consistency during undo/redo', () => {
        // 1. Setup
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'p1',
                type: 'frame',
                position: { x: 100, y: 100 },
                data: { width: 200, height: 200 }
            }
        });
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: 'c1',
                position: { x: 50, y: 50 },
                parentId: 'p1'
            }
        });

        const initialAbs = brain.getAbsolutePosition('c1'); // {50, 50}

        // 2. Move parent
        brain.applyTransaction({
            type: 'MOVE_NODE',
            payload: {
                id: 'p1',
                position: { x: 300, y: 300 }
            }
        });

        const movedAbs = brain.getAbsolutePosition('c1'); // {300-100+50, 300-100+50} = {250, 250}
        expect(movedAbs).not.toEqual(initialAbs);

        // 3. Undo
        brain.undo();
        expect(brain.getAbsolutePosition('c1')).toEqual(initialAbs);
        expect(brain.getNode('p1')?.position).toEqual({ x: 100, y: 100 });

        // 4. Redo
        brain.redo();
        expect(brain.getAbsolutePosition('c1')).toEqual(movedAbs);
        expect(brain.getNode('p1')?.position).toEqual({ x: 300, y: 300 });
    });
});

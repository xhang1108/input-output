import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Brain } from '@/engine/Brain';
import { TransactionManager } from '@/engine/TransactionManager';

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
        // Parent top-left is {100, 100}; the child stores a position relative to it.
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
        // Parent position is its top-left: {100, 100}
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

        // AbsPos = Parent.TL + Child.Rel = 100 + 50
        const absPos = brain.getAbsolutePosition('child-1');
        expect(absPos).toEqual({ x: 150, y: 150 });

        // Move Parent
        brain.applyTransaction({
            type: 'MOVE_NODE',
            payload: {
                id: 'parent-1',
                position: { x: 200, y: 200 }
            }
        });

        // New Abs = 200 + 50
        const newAbsPos = brain.getAbsolutePosition('child-1');
        expect(newAbsPos).toEqual({ x: 250, y: 250 });

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
                position: { x: 50, y: 50 }, // parent-local to P1
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
                position: { x: 10, y: 10 }, // parent-local to P2
                parentId: 'p2'
            }
        });

        // P1 world = 100,100
        // P2 world = 100 + 50 = 150,150
        // C1 world = 150 + 10 = 160,160
        const absPos = brain.getAbsolutePosition('c1');
        expect(absPos).toEqual({ x: 160, y: 160 });
    });
});



import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '../Brain';
import { PayloadUtils } from '../../utils/PayloadUtils';

describe('ColorNode (IO-18)', () => {
    let brain: Brain;

    beforeEach(() => {
        brain = Brain.getInstance();
        brain.clearAll();
    });

    it('should calculate 3 formats from a single hex input', async () => {
        const colorId = 'color-1';

        // 1. Add Color Node
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: colorId,
                type: 'IO-18',
                data: { value: '#ff0000' }, // Red
                position: { x: 0, y: 0 }
            }
        });

        // 2. Extract specific handles
        const hexVal = brain.getValue(colorId, 'hex');
        const rgbVal = brain.getValue(colorId, 'rgb');
        const vec3Val = brain.getValue(colorId, 'vec3');

        expect(hexVal.value).toBe('#ff0000');
        expect(rgbVal.value).toEqual([255, 0, 0]);
        expect(vec3Val.value).toEqual([1, 0, 0]);
    });

    it('should propagate updates to all 3 handles when color changes', async () => {
        const colorId = 'color-1';

        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id: colorId,
                type: 'IO-18',
                data: { value: '#00ff00' }, // Green
                position: { x: 0, y: 0 }
            }
        });

        // Initial check
        expect(brain.getValue(colorId, 'hex').value).toBe('#00ff00');

        // Update color
        brain.applyTransaction({
            type: 'UPDATE_VALUE',
            payload: { id: colorId, value: '#0000ff' } // Blue
        });

        // The Brain.getValue should trigger recalculation if dirty
        expect(brain.getValue(colorId, 'hex').value).toBe('#0000ff');
        expect(brain.getValue(colorId, 'rgb').value).toEqual([0, 0, 255]);
        expect(brain.getValue(colorId, 'vec3').value).toEqual([0, 0, 1]);
    });
});

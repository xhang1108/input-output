import { describe, expect, it } from 'vitest';
import {
    resolveMouseDownAction,
    snapRotation,
    snapScale,
    snapTranslate,
} from '@/utils/transformSnap';

describe('S1 snapTranslate', () => {
    const cases: Array<[[number, number, number], { x: number; y: number }]> = [
        [[37, -13, 20], { x: 40, y: -20 }],
        [[10, 0, 20], { x: 20, y: 0 }],
        [[-10, 0, 20], { x: -20, y: 0 }],
        [[0, 0, 20], { x: 0, y: 0 }],
        [[30, 30, 20], { x: 40, y: 40 }],
        [[5, 5, 0], { x: 5, y: 5 }],
        [[5, 5, -20], { x: 5, y: 5 }],
    ];
    it.each(cases)('snapTranslate(%j) -> %j', (args, expected) => {
        expect(snapTranslate(args[0], args[1], args[2])).toEqual(expected);
    });
});

describe('S1 snapScale', () => {
    it.each([
        [0.32, 0.05, 0.05, 0.3],
        [0.02, 0.05, 0.05, 0.05],
        [1.0, 0.05, 0.05, 1.0],
        [0, 0.05, 0.05, 0.05],
        [-1, 0.05, 0.05, 0.05],
    ])('snapScale(%s) -> %s', (scale, step, min, expected) => {
        expect(snapScale(scale, step, min)).toBeCloseTo(expected, 10);
    });
    it('returns 1 for non-finite', () => {
        expect(snapScale(NaN, 0.05, 0.05)).toBe(1);
        expect(snapScale(Infinity, 0.05, 0.05)).toBe(1);
    });
});

describe('S1 snapRotation', () => {
    it.each([
        [172, 15, 165],
        [-172, 15, -165],
        [359, 15, 0],
        [7.5, 15, 15],
        [-7.5, 15, 0],
        [180, 15, -180],
    ])('snapRotation(%s,%s) -> %s', (deg, step, expected) => {
        expect(snapRotation(deg, step)).toBeCloseTo(expected, 10);
    });
});

describe('S2 resolveMouseDownAction', () => {
    const modes = ['IDLE', 'GRABBING', 'SCALING', 'ROTATING', 'CUTTING'] as const;
    it.each([
        [{ button: 2, ctrlKey: true, isMac: false, mode: 'IDLE' }, 'CUT'],
        [{ button: 2, ctrlKey: true, isMac: false, mode: 'GRABBING' }, 'CANCEL'],
        [{ button: 2, ctrlKey: true, isMac: false, mode: 'CUTTING' }, 'CANCEL'],
        [{ button: 2, ctrlKey: true, isMac: false, mode: 'SCALING' }, 'CANCEL'],
        [{ button: 2, ctrlKey: true, isMac: false, mode: 'ROTATING' }, 'CANCEL'],
        [{ button: 0, ctrlKey: true, isMac: true, mode: 'IDLE' }, 'CUT'],
        [{ button: 0, ctrlKey: true, isMac: true, mode: 'GRABBING' }, 'CANCEL'],
        [{ button: 0, ctrlKey: false, isMac: true, mode: 'IDLE' }, 'PASS'],
        [{ button: 0, ctrlKey: false, isMac: false, mode: 'IDLE' }, 'PASS'],
        [{ button: 2, ctrlKey: false, isMac: false, mode: 'IDLE' }, 'PASS'],
        [{ button: 1, ctrlKey: true, isMac: false, mode: 'IDLE' }, 'PASS'],
    ])('resolve %j -> %s', (input, expected) => {
        expect(resolveMouseDownAction(input as never)).toBe(expected);
    });
    it('non-cut buttons always PASS', () => {
        for (const mode of modes) {
            expect(resolveMouseDownAction({ button: 0, ctrlKey: false, isMac: false, mode })).toBe('PASS');
            expect(resolveMouseDownAction({ button: 1, ctrlKey: false, isMac: false, mode })).toBe('PASS');
            expect(resolveMouseDownAction({ button: 2, ctrlKey: false, isMac: false, mode })).toBe('PASS');
        }
    });
});

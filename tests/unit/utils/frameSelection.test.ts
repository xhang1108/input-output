import { describe, expect, it } from 'vitest';
import { selectionTouchesFrameBorder } from '@/utils/frameSelection';

const frame = { x: 0, y: 0, width: 300, height: 200 };

describe('frameSelection.selectionTouchesFrameBorder', () => {
    it('does not select when the marquee is entirely inside the frame', () => {
        expect(selectionTouchesFrameBorder({ x: 40, y: 40, width: 100, height: 80 }, frame)).toBe(false);
    });

    it('selects when the marquee touches the left border', () => {
        expect(selectionTouchesFrameBorder({ x: 2, y: 40, width: 100, height: 80 }, frame)).toBe(true);
    });

    it('selects when the marquee touches the bottom border', () => {
        expect(selectionTouchesFrameBorder({ x: 40, y: 190, width: 100, height: 8 }, frame)).toBe(true);
    });

    it('selects when the marquee covers the whole frame', () => {
        expect(selectionTouchesFrameBorder({ x: -10, y: -10, width: 400, height: 300 }, frame)).toBe(true);
    });

    it('does not select when the marquee is outside', () => {
        expect(selectionTouchesFrameBorder({ x: 400, y: 400, width: 50, height: 50 }, frame)).toBe(false);
    });

    it('selects a tiny frame as soon as it overlaps', () => {
        expect(
            selectionTouchesFrameBorder(
                { x: 1, y: 1, width: 20, height: 20 },
                { x: 0, y: 0, width: 10, height: 10 }
            )
        ).toBe(true);
    });
});

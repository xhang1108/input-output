import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { expandFrameToFitChildren, fitFrameToContents, getFrameMinSize } from '@/utils/frameGeometry';

function frame(x: number, y: number, width: number, height: number): Node {
    return {
        id: 'f1',
        type: 'frame',
        position: { x, y },
        width,
        height,
        measured: { width, height },
        data: { width, height, label: 'Frame' },
        selected: false,
    };
}

function child(id: string, x: number, y: number, parentId = 'f1'): Node {
    return {
        id,
        type: 'test',
        position: { x, y },
        parentId,
        width: 50,
        height: 50,
        measured: { width: 50, height: 50 },
        data: { width: 50, height: 50 },
        selected: true,
    };
}

describe('frameGeometry.expandFrameToFitChildren', () => {
    it('does not touch a frame when children are inside', () => {
        const nodes = [frame(0, 0, 300, 200), child('c1', 50, 50)];

        const result = expandFrameToFitChildren(nodes, 'f1');

        expect(result.changed).toBe(false);
        expect(result.nodes).toBe(nodes);
    });

    it('grows right and bottom when a child leaves the frame', () => {
        const nodes = [frame(0, 0, 300, 200), child('c1', 280, 180)];

        const result = expandFrameToFitChildren(nodes, 'f1');
        const f = result.nodes.find(n => n.id === 'f1')!;
        const c = result.nodes.find(n => n.id === 'c1')!;

        expect(result.changed).toBe(true);
        expect(f.position).toEqual({ x: 0, y: 0 });
        expect(f.width).toBe(362); // 280 + 50 + 32
        expect(f.height).toBe(262); // 180 + 50 + 32
        expect(c.position).toEqual({ x: 280, y: 180 });
    });

    it('moves the frame and shifts every child when leaving left/top', () => {
        const nodes = [
            frame(100, 100, 300, 200),
            child('c1', -40, -30),
            child('c2', 50, 50),
        ];
        const before = nodes.map(n => ({ id: n.id, absolute: n.id === 'f1' ? n.position : {
            x: n.position.x + 100,
            y: n.position.y + 100,
        } }));

        const result = expandFrameToFitChildren(nodes, 'f1');
        const f = result.nodes.find(n => n.id === 'f1')!;
        const c1 = result.nodes.find(n => n.id === 'c1')!;
        const c2 = result.nodes.find(n => n.id === 'c2')!;

        // Child c1 world was 60,70; frame left becomes 60 - 32 = 28, top 70 - 40 = 30.
        expect(f.position).toEqual({ x: 28, y: 30 });
        expect(f.width).toBe(372); // old right 400 - 28
        expect(f.height).toBe(270); // old bottom 300 - 30
        expect(c1.position).toEqual({ x: 32, y: 40 });
        expect(c2.position).toEqual({ x: 122, y: 120 });

        // World positions of children must be unchanged.
        for (const item of before.filter(i => i.id !== 'f1')) {
            const current = result.nodes.find(n => n.id === item.id)!;
            const abs = { x: f.position.x + current.position.x, y: f.position.y + current.position.y };
            expect(abs).toEqual(item.absolute);
        }
    });

    it('uses the union of all children', () => {
        const nodes = [
            frame(0, 0, 200, 100),
            child('c1', 170, 20),
            child('c2', 20, 80),
        ];

        const result = expandFrameToFitChildren(nodes, 'f1');
        const f = result.nodes.find(n => n.id === 'f1')!;

        expect(f.width).toBe(252); // 170 + 50 + 32
        expect(f.height).toBe(162); // 80 + 50 + 32
    });
});

describe('frameGeometry.fitFrameToContents', () => {
    it('shrinks and grows around the children, keeping their world positions', () => {
        const nodes = [
            frame(100, 100, 600, 500),
            child('c1', 200, 200),
        ];

        const result = fitFrameToContents(nodes, 'f1');
        expect(result.changed).toBe(true);

        const f = result.nodes.find(n => n.id === 'f1')!;
        const c1 = result.nodes.find(n => n.id === 'c1')!;

        // child world = 300,300; size 50x50.
        expect(f.position).toEqual({ x: 268, y: 260 }); // 300 - 32 / 300 - 40
        expect(f.width).toBe(200);   // 50 + 64, clamped to the 200 minimum
        expect(f.height).toBe(122);  // 50 + 40 + 32
        expect(c1.position).toEqual({ x: 32, y: 40 });

        // Absolute position is unchanged (world 300,300).
        expect({ x: f.position.x + c1.position.x, y: f.position.y + c1.position.y })
            .toEqual({ x: 300, y: 300 });
    });

    it('is a no-op when the frame already fits its content', () => {
        const nodes = [
            frame(268, 260, 200, 122),
            child('c1', 32, 40),
        ];

        expect(fitFrameToContents(nodes, 'f1')).toEqual({ nodes, changed: false });
    });

    it('ignores a frame without children or a missing frame', () => {
        const empty = [frame(0, 0, 300, 300)];
        expect(fitFrameToContents(empty, 'f1')).toEqual({ nodes: empty, changed: false });
        expect(fitFrameToContents([], 'ghost')).toEqual({ nodes: [], changed: false });
    });
});

describe('frameGeometry.getFrameMinSize', () => {
    it('returns the minimum frame size when empty', () => {
        expect(getFrameMinSize([frame(0, 0, 300, 300)], 'f1')).toEqual({ w: 200, h: 120 });
    });

    it('uses the content outer edge relative to the frame origin', () => {
        const nodes = [
            frame(100, 100, 500, 500),
            child('c1', 200, 150),
        ];

        // child world = 300,250; right = 350, bottom = 300.
        // Relative to frame origin: 250, 200.
        expect(getFrameMinSize(nodes, 'f1')).toEqual({ w: 250, h: 200 });
    });

    it('never goes below the frame minimum', () => {
        const nodes = [
            frame(0, 0, 300, 300),
            child('c1', 10, 10),
        ];

        expect(getFrameMinSize(nodes, 'f1')).toEqual({ w: 200, h: 120 });
    });
});

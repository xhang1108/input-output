import { Parser } from '@/engine/iogl/Parser';
import { Encoder } from '@/engine/iogl/Encoder';
import { describe, it, expect } from 'vitest';

/**
 * [P2.1] IOGL frame support: `FRAME` keyword + reserved `{parent: "<label>"}` prop.
 * Child @x,y stays parent-local; the frame @x,y is world.
 */
describe('IOGL Frame (P2.1)', () => {
    const frameGraph = () => ({
        nodes: [
            // Deliberately declared before the frame: the encoder pre-pass must
            // still resolve the parent label.
            {
                id: 'n1',
                type: 'IN-01',
                position: { x: 20, y: 20 },
                parentId: 'f1',
                data: { label: 'num', value: 42 }
            },
            {
                id: 'f1',
                type: 'frame',
                position: { x: 100, y: 100 },
                data: { label: 'Group 1', width: 400, height: 300 }
            },
            {
                id: 'n2',
                type: 'OT-01',
                position: { x: 20, y: 120 },
                parentId: 'f1',
                data: { label: 'res' }
            }
        ],
        edges: [
            { id: 'e1', source: 'n1', sourceHandle: 'out_a', target: 'n2', targetHandle: 'in_a' }
        ]
    });

    it('encodes FRAME with {W,H} and children with a local @x,y + parent prop', () => {
        const encoded = Encoder.encode(frameGraph() as any);

        expect(encoded).toBe(
            '[num] IN-01 42 {parent: "Group 1"} @20,20\n' +
            '[Group 1] FRAME {400,300} @100,100\n' +
            '[res] OT-01 {parent: "Group 1"} @20,120\n' +
            '\n' +
            '[num].a -> [res].a\n'
        );
    });

    it('parses FRAME + children back to parentId, local positions and size', () => {
        const script = `
[Group 1] FRAME {400,300} @100,100
[num] IN-01 42 {parent: "Group 1"} @20,20
[res] OT-01 {parent: "Group 1"} @20,120

[num].a -> [res].a
`;
        const { graph, diagnostics } = new Parser(script).parse();

        expect(diagnostics.filter(d => d.severity === 'Error')).toHaveLength(0);

        const frame = graph.nodes.find(n => n.type === 'frame')!;
        const num = graph.nodes.find(n => n.data?.label === 'num')!;
        const res = graph.nodes.find(n => n.data?.label === 'res')!;

        expect(frame.position).toEqual({ x: 100, y: 100 });
        expect(frame.data!.width).toBe(400);
        expect(frame.data!.height).toBe(300);
        expect(frame.width).toBe(400);
        expect(frame.height).toBe(300);

        expect(num.position).toEqual({ x: 20, y: 20 });
        expect(num.parentId).toBe(frame.id);
        expect(num.data!.parent).toBeUndefined();

        expect(res.position).toEqual({ x: 20, y: 120 });
        expect(res.parentId).toBe(frame.id);
        expect(res.data!.parent).toBeUndefined();
    });

    it('keeps parent-first ordering in the parsed graph', () => {
        const script = `
[num] IN-01 42 {parent: "Group 1"} @20,20
[Group 1] FRAME {400,300} @100,100
`;
        const { graph } = new Parser(script).parse();
        expect(graph.nodes[0]!.type).toBe('frame');
        expect(graph.nodes[1]!.parentId).toBe(graph.nodes[0]!.id);
    });

    it('round-trips frame + children through encode -> parse -> encode', () => {
        const first = Encoder.encode(frameGraph() as any);
        const { graph } = new Parser(first).parse();
        const second = Encoder.encode(graph as any);

        // Frame is emitted before its children on the second pass; data is
        // otherwise identical (OT-01 may add its default mode prop).
        const lines = second.trim().split('\n');
        expect(lines[0]).toBe('[Group 1] FRAME {400,300} @100,100');
        expect(lines[1]).toBe('[num] IN-01 42 {parent: "Group 1"} @20,20');
        expect(lines[2]).toContain('[res] OT-01');
        expect(lines[2]).toContain('parent: "Group 1"} @20,120');
    });

    describe('legacy flat graphs', () => {
        it('emits byte-identical IOGL when no node has a parent', () => {
            const graph = {
                nodes: [
                    { id: 'n1', type: 'IN-01', position: { x: 10, y: 10 }, data: { label: 'n', value: 5 } },
                    { id: 'n2', type: 'OT-01', position: { x: 200, y: 10 }, data: { label: 'out' } }
                ],
                edges: [
                    { id: 'e1', source: 'n1', sourceHandle: 'out_a', target: 'n2', targetHandle: 'in_a' }
                ]
            };
            const encoded = Encoder.encode(graph as any);
            expect(encoded).toBe('[n] IN-01 5 @10,10\n[out] OT-01 @200,10\n\n[n].a -> [out].a\n');
            expect(encoded).not.toContain('parent');
        });

        it('parses legacy IOGL without a parent prop unchanged', () => {
            const script = '[n] IN-01 5 @10,10\n[out] OT-01 @200,10\n\n[n].a -> [out].a\n';
            const { graph, diagnostics } = new Parser(script).parse();

            expect(diagnostics).toHaveLength(0);
            expect(graph.nodes.map(n => n.data!.label)).toEqual(['n', 'out']);
            expect(graph.nodes.every(n => n.parentId === undefined)).toBe(true);
        });
    });

    describe('parser rejects invalid parents with a diagnostic', () => {
        it('unknown parent label', () => {
            const { graph, diagnostics } = new Parser(
                '[a] IN-01 5 {parent: "Nope"} @0,0\n'
            ).parse();

            expect(diagnostics.some(d => d.message.includes("Parent frame 'Nope'") && d.message.includes('was not found'))).toBe(true);
            expect(graph.nodes[0]!.parentId).toBeUndefined();
            expect(graph.nodes[0]!.data!.parent).toBeUndefined();
        });

        it('parent is not a frame', () => {
            const { graph, diagnostics } = new Parser(
                '[p] IN-01 5 @0,0\n[a] IN-01 6 {parent: "p"} @10,10\n'
            ).parse();

            expect(diagnostics.some(d => d.message.includes("of type 'IN-01', which is not a frame"))).toBe(true);
            const child = graph.nodes.find(n => n.data!.label === 'a')!;
            expect(child.parentId).toBeUndefined();
        });

        it('parent is itself a child (nested frames)', () => {
            const { graph, diagnostics } = new Parser(
                '[a] FRAME {100,100} @0,0\n' +
                '[b] FRAME {100,100} {parent: "a"} @10,10\n' +
                '[c] IN-01 1 {parent: "b"} @20,20\n'
            ).parse();

            expect(diagnostics.some(d => d.message.includes("Frame 'b' cannot have a parent"))).toBe(true);
            expect(diagnostics.some(d => d.message.includes("already has a parent"))).toBe(true);
            expect(graph.nodes.find(n => n.data!.label === 'c')!.parentId).toBeUndefined();
        });

        it('a frame cannot be a child', () => {
            const { graph, diagnostics } = new Parser(
                '[a] FRAME {100,100} @0,0\n[b] FRAME {100,100} {parent: "a"} @10,10\n'
            ).parse();

            expect(diagnostics.some(d => d.message.includes('nested frames are not supported'))).toBe(true);
            expect(graph.nodes.every(n => n.parentId === undefined)).toBe(true);
        });

        it('a frame without a label cannot be referenced', () => {
            const { graph, diagnostics } = new Parser(
                'FRAME {100,100} @0,0\n[c] IN-01 1 {parent: "Frame"} @10,10\n'
            ).parse();

            expect(diagnostics.some(d => d.message.includes("Parent frame 'Frame'") && d.message.includes('was not found'))).toBe(true);
            expect(graph.nodes.find(n => n.data!.label === 'c')!.parentId).toBeUndefined();
        });
    });

    describe('encoder aborts on invalid hierarchies', () => {
        it('throws when the parent id does not exist', () => {
            const graph = {
                nodes: [
                    { id: 'n1', type: 'IN-01', position: { x: 0, y: 0 }, parentId: 'ghost', data: { label: 'a', value: 1 } }
                ],
                edges: []
            };
            expect(() => Encoder.encode(graph as any)).toThrow(/missing parent "ghost"/);
        });

        it('throws when the parent is not a frame', () => {
            const graph = {
                nodes: [
                    { id: 'p', type: 'IN-01', position: { x: 0, y: 0 }, data: { label: 'p', value: 1 } },
                    { id: 'c', type: 'IN-01', position: { x: 10, y: 10 }, parentId: 'p', data: { label: 'c', value: 2 } }
                ],
                edges: []
            };
            expect(() => Encoder.encode(graph as any)).toThrow(/which is not a frame/);
        });

        it('throws when a frame has a parent (nested)', () => {
            const graph = {
                nodes: [
                    { id: 'f1', type: 'frame', position: { x: 0, y: 0 }, data: { label: 'A', width: 200, height: 150 } },
                    { id: 'f2', type: 'frame', position: { x: 10, y: 10 }, parentId: 'f1', data: { label: 'B', width: 100, height: 100 } }
                ],
                edges: []
            };
            expect(() => Encoder.encode(graph as any)).toThrow(/cannot have a parent/);
        });
    });
});

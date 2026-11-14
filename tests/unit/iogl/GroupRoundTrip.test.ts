import { Parser } from '@/engine/iogl/Parser';
import { Encoder } from '@/engine/iogl/Encoder';
import { describe, it, expect } from 'vitest';

/**
 * [E6] IOGL group spike: `GROUP` keyword + `subgraph` / `ports` as single-line
 * JSON string props. Acceptance: one group of 3 inner nodes,
 * encode -> parse -> encode is byte-equal and the inner node count is unchanged.
 */
describe('IOGL Group (E6 spike)', () => {
    const groupGraph = () => ({
        nodes: [
            {
                id: 'g1',
                type: 'group',
                position: { x: 10, y: 20 },
                data: {
                    label: 'My Group',
                    subGraph: {
                        nodes: [
                            { id: 'n1', type: 'IN-01', position: { x: 0, y: 0 }, data: { label: 'a', value: 2 } },
                            // Escaping torture: quotes, backslash, unicode in inner data.
                            { id: 'n2', type: 'MA-01', position: { x: 100, y: 0 }, data: { label: 'say "hi" \\ 中文 αβ', mode: 'ADD' } },
                            { id: 'n3', type: 'OT-01', position: { x: 200, y: 10 }, data: { label: 'out' } }
                        ],
                        edges: [
                            { id: 'e2', source: 'n2', sourceHandle: 'out_a', target: 'n3', targetHandle: 'in_a' },
                            { id: 'e1', source: 'n1', sourceHandle: 'out_a', target: 'n2', targetHandle: 'in_a' }
                        ]
                    },
                    boundary: {
                        inputs: [
                            {
                                portId: 'in_ext1__out_a',
                                innerNodeId: 'n2',
                                innerHandle: 'in_a',
                                dataType: 'scalar',
                                label: 'x "in"',
                                defaultValue: 1.5,
                                constraints: { min: 0, max: 10, step: 0.5 }
                            }
                        ],
                        outputs: [
                            { portId: 'out_n3__in_a', innerNodeId: 'n3', innerHandle: 'in_a', dataType: 'scalar' }
                        ]
                    },
                    // E3: compiled code is memory-only and must never be encoded.
                    compiled: { structHash: 'abc123', precision: 64, allowlistVersion: 1 }
                }
            }
        ],
        edges: []
    });

    const groupDataOf = (graph: any) => graph.nodes.find((n: any) => n.type === 'group')!.data as any;

    it('encodes GROUP with single-line subgraph/ports JSON string props', () => {
        const encoded = Encoder.encode(groupGraph() as any);
        const line = encoded.split('\n')[0]!;

        expect(line.startsWith('[My Group] GROUP {subgraph: "')).toBe(true);
        expect(line).toContain('",ports: "');
        expect(line.endsWith('} @10,20')).toBe(true);
        // Single-line props: the JSON payloads carry no literal newlines.
        expect(line.includes('\n')).toBe(false);
        // E3: compiled must not leak into IOGL.
        expect(encoded).not.toContain('compiled');
        expect(encoded).not.toContain('structHash');
    });

    it('round-trips encode -> parse -> encode byte-equal, inner count unchanged', () => {
        const first = Encoder.encode(groupGraph() as any);
        const { graph, diagnostics } = new Parser(first).parse();

        expect(diagnostics.filter(d => d.severity === 'Error')).toHaveLength(0);

        const data = groupDataOf(graph);
        expect(data.subGraph.nodes).toHaveLength(3);
        expect(data.subGraph.nodes.map((n: any) => n.id)).toEqual(['n1', 'n2', 'n3']);
        expect(data.subGraph.edges).toHaveLength(2);
        expect(data.boundary.inputs).toHaveLength(1);
        expect(data.boundary.outputs).toHaveLength(1);
        expect(data.boundary.inputs[0].portId).toBe('in_ext1__out_a');
        expect(data.boundary.inputs[0].defaultValue).toBe(1.5);
        expect(data.boundary.inputs[0].constraints).toEqual({ min: 0, max: 10, step: 0.5 });
        // Escaped inner label survives the double-encoding.
        expect(data.subGraph.nodes[1].data.label).toBe('say "hi" \\ 中文 αβ');
        // Reserved lowercase props never leak into node.data.
        expect(data.subgraph).toBeUndefined();
        expect(data.ports).toBeUndefined();

        const second = Encoder.encode(graph as any);
        expect(second).toBe(first);
    });

    it('is order-insensitive: shuffled nodes/edges/ports/keys encode identically', () => {
        const g: any = groupGraph();
        const d = g.nodes[0].data;
        d.subGraph.nodes = [...d.subGraph.nodes].reverse();
        d.subGraph.edges = [...d.subGraph.edges].reverse();
        d.boundary.inputs = [...d.boundary.inputs].reverse();
        // Shuffled keys inside one inner node must not change the output.
        d.subGraph.nodes[0] = { data: d.subGraph.nodes[0].data, position: d.subGraph.nodes[0].position, type: 'OT-01', id: 'n3' };

        expect(Encoder.encode(g as any)).toBe(Encoder.encode(groupGraph() as any));
    });

    it('reports invalid JSON in subgraph/ports instead of writing it raw', () => {
        const script = '[G] GROUP {subgraph: "not-json{", ports: "{\\"inputs\\": [], \\"outputs\\": []}"} @0,0\n';
        const { graph, diagnostics } = new Parser(script).parse();

        expect(diagnostics.some(d => d.severity === 'Error' && d.message.includes("invalid JSON in 'subgraph'"))).toBe(true);
        expect(groupDataOf(graph).subGraph).toEqual({ nodes: [], edges: [] });
    });

    it('rejects nested group/frame inside the subGraph (D2)', () => {
        const g: any = groupGraph();
        g.nodes[0].data.subGraph.nodes.push(
            { id: 'nx', type: 'group', position: { x: 0, y: 0 }, data: {} }
        );
        const { diagnostics } = new Parser(Encoder.encode(g as any)).parse();

        expect(diagnostics.some(d => d.severity === 'Error' && d.message.includes('nesting is not supported'))).toBe(true);
    });
});

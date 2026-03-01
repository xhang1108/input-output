import { describe, it, expect, beforeEach } from 'vitest';
import { GraphCodec } from '../GraphCodec';

describe('GraphCodec', () => {
    describe('decode', () => {
        it('should parse a basic CGL string with nodes and connections', () => {
            const cgl = `
# Test Graph
N1:io:num @100,200 = 42
N2:io:res @500,200

# Connection
N1 -- N2:in
`;
            const { graph, diagnostics } = GraphCodec.parse(cgl);

            expect(diagnostics).toHaveLength(0);
            expect(graph.nodes).toHaveLength(2);
            expect(graph.edges).toHaveLength(1);

            const n1 = graph.nodes.find(n => n.id === 'N1');
            expect(n1).toBeDefined();
            expect(n1?.position).toEqual({ x: 100, y: 200 });
            expect(n1?.value).toBe(42);

            const edge = graph.edges[0];
            expect(edge.source).toBe('N1');
            expect(edge.target).toBe('N2');
            expect(edge.targetHandle).toBe('in');
        });

        it('should handle optional coordinates (defaulting to 0,0)', () => {
            const cgl = `
FloatingNode:io:num = 123
LinkedNode:io:res
FloatingNode -- LinkedNode:in
`;
            const { graph, diagnostics } = GraphCodec.parse(cgl);

            expect(diagnostics).toHaveLength(0);
            expect(graph.nodes).toHaveLength(2);

            const fn = graph.nodes.find(n => n.id === 'FloatingNode');
            expect(fn?.position).toEqual({ x: 0, y: 0 });
        });

        it('should ignore empty lines and full-line comments', () => {
            const cgl = `
# Comment 1

N1:io:num @0,0
   
# Comment 2
N2:io:res @10,10

N1 -- N2:in
`;
            const { graph, diagnostics } = GraphCodec.parse(cgl);
            expect(diagnostics).toHaveLength(0);
            expect(graph.nodes).toHaveLength(2);
            expect(graph.edges).toHaveLength(1);
        });

        it('should capture diagnostics for invalid lines', () => {
            const cgl = `
Valid:io:num @0,0
Invalid Junk Line
Another:io:res @10,10
Valid -- Another:wrong_handle
`;
            const { graph, diagnostics } = GraphCodec.parse(cgl);

            // "Invalid Junk Line" should be a diagnostic
            // "Valid -- Another:wrong_handle" is actually valid syntax for the parser, 
            // but the UI might flag the handle later. 
            // Let's check the junk line.
            expect(diagnostics.some(d => d.includes('Skipped invalid syntax'))).toBe(true);
            expect(graph.nodes).toHaveLength(2);
        });

        it('should handle complex opCodes with underscores and hyphens', () => {
            const cgl = `
Complex_Node:math:ADD-VALUES @0,0
`;
            const { graph, diagnostics } = GraphCodec.parse(cgl);
            expect(diagnostics).toHaveLength(0);
            expect(graph.nodes).toHaveLength(1);
            expect(graph.nodes[0].id).toBe('Complex_Node');
        });
    });

    describe('encode', () => {
        it('should encode a graph back to strictly formatted CGL', () => {
            const injectable = {
                nodes: [
                    { id: 'N1', type: 'IO-01', position: { x: 10, y: 20 }, data: { label: 'Input', value: 3.14 } }
                ],
                edges: []
            };

            const encoded = GraphCodec.encode(injectable);
            expect(encoded).toContain('N1:io:num @10,20 = 3.14');
            expect(encoded).toContain('# input-output Graph Language');
        });
    });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphCodec } from '../GraphCodec';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { Brain } from '../Brain';
import { NodeRegistry } from '../NodeRegistry';

/**
 * IOGL 1.0 Master Logic Test Suite
 * 
 * This file consolidates all core syntax, protocol, edge-cases, 
 * and historical regression tests for the IOGL 1.0 engine.
 */

describe('IOGL 1.0 Master Logic Test', () => {
    let brain: Brain;

    beforeEach(() => {
        NodeRegistry.initializeNodes();
        brain = Brain.getComputeSession('iogl-master-test');
        brain.silentReset();
    });

    afterEach(() => {
        brain.dispose();
    });

    describe('1. Parser & Protocol (Standard Syntax)', () => {
        it('should parse basic nodes with labels and coordinates', () => {
            const iogl = `
                [num_1] IN-01 { data: 42 } @100,200
                [res_1] OT-01 @500,200
                num_1.a -> res_1.a
            `;
            const { graph, diagnostics } = GraphCodec.parse(iogl);
            
            expect(diagnostics).toHaveLength(0);
            expect(graph.nodes).toHaveLength(2);
            expect(graph.edges).toHaveLength(1);

            const n1 = graph.nodes.find(n => n.data!.label === 'num_1')!;
            expect(n1.type).toBe('IN-01');
            expect(n1.position).toEqual({ x: 100, y: 200 });

            const edge = graph.edges[0];
            expect(edge.sourceHandle).toBe('out_a');
            expect(edge.targetHandle).toBe('in_a');
        });

        it('should handle complex positional data mapping (Extreme Merging)', () => {
            const iogl = `
                [s1] IN-02 { data: [50, 0, 100, 1] } @0,0
                [r1] IN-10 { mode: "Normal", data: [0, 0.1, 100, 1] } @0,100
            `;
            const { graph, diagnostics } = GraphCodec.parse(iogl);
            
            expect(diagnostics).toHaveLength(0);
            
            const s1 = graph.nodes.find(n => n.data!.label === 's1')!;
            expect((s1.data!.value as any).value).toBe(50);
            expect(s1.data!.min).toBe(0);
            expect(s1.data!.max).toBe(100);

            const r1 = graph.nodes.find(n => n.data!.label === 'r1')!;
            expect(r1.data!.mode).toBe('Normal');
            expect(r1.data!.mean).toBe(0);
            expect(r1.data!.stdDev).toBe(0.1);
        });

        it('should support semantic mode mapping (Fraction, Builder)', () => {
            const iogl = `
                [frac] MA-06 { mode: "Mixed" }
                [builder] DT-01 { mode: "Cols" }
            `;
            const { graph } = GraphCodec.parse(iogl);
            
            const frac = graph.nodes.find(n => n.data!.label === 'frac')!;
            expect(frac.data!.mixed).toBe(true);

            const builder = graph.nodes.find(n => n.data!.label === 'builder')!;
            expect(builder.data!.axis).toBe(1); // Cols -> 1
        });
    });

    describe('2. Edge Cases & Boundary Conditions', () => {
        it('should correctly parse TR-03 (Geometry) with mode-only mapping', () => {
            const iogl = `
                [c1] TR-03 Circle
                [q1] TR-03 Quad
            `;
            const { graph, diagnostics } = GraphCodec.parse(iogl);
            expect(diagnostics).toHaveLength(0);

            const c1 = graph.nodes.find(n => n.data!.label === 'c1')!;
            expect(c1.data!.shape).toBe('Circle');
            expect(c1.data!.radius).toBeUndefined();
        });

        it('should correctly parse CL-02 (Integral) with definite/indefinite schemas', () => {
            const iogl = `
                [int1] CL-02 definite x 0 1
                [int2] CL-02 indefinite y
            `;
            const { graph, diagnostics } = GraphCodec.parse(iogl);
            expect(diagnostics).toHaveLength(0);

            const int1 = graph.nodes.find(n => n.data!.label === 'int1')!;
            expect(int1.data!.mode).toBe('definite');
            expect(int1.data!.variable).toBe('x');
            expect(int1.data!.lower).toBe(0);
            expect(int1.data!.upper).toBe(1);
        });

        it('should allow multiple connections to the same handle (Capsule support)', () => {
            const iogl = `
                [a1] IN-01 10
                [a2] IN-01 20
                [builder] DT-01 Rows
                a1.a -> builder.a
                a2.a -> builder.a
            `;
            const { graph, diagnostics } = GraphCodec.parse(iogl);
            expect(diagnostics).toHaveLength(0);
            const builder = graph.nodes.find(n => n.data!.label === 'builder')!;
            const incomingEdges = graph.edges.filter(e => e.target === builder.id);
            expect(incomingEdges).toHaveLength(2);
            expect(incomingEdges.every(e => e.targetHandle === 'in_a')).toBe(true);
        });

        it('should correctly parse negative coordinates', () => {
            const iogl = `[n1] IN-01 10 @-100,-200`;
            const { graph } = GraphCodec.parse(iogl);
            const n1 = graph.nodes.find(n => n.data!.label === 'n1')!;
            expect(n1.position.x).toBe(-100);
            expect(n1.position.y).toBe(-200);
        });
    });

    describe('3. Historical Regressions (Bug Fix Verification)', () => {
        it('should preserve injected IN-01 values correctly', async () => {
            const iogl = '[V18] IN-01 18 @0,180';
            const { graph } = GraphCodec.parse(iogl);
            
            const node = graph.nodes[0];
            expect(PayloadUtils.unwrap(node.data!.value)).toBe(18);

            await brain.injectNodes(graph, true);
            const brainNode = brain.getNode(node.id);
            expect(PayloadUtils.unwrap(brainNode?.data.value)).toBe(18);
        });

        it('should correctly preserve "0" in numeric inputs', async () => {
            const iogl = '[V0] IN-01 0 @0,0';
            const { graph } = GraphCodec.parse(iogl);
            expect(PayloadUtils.unwrap(graph.nodes[0].data!.value)).toBe(0);

            await brain.injectNodes(graph, true);
            const brainNode = brain.getNode(graph.nodes[0].id);
            expect(PayloadUtils.unwrap(brainNode?.data.value)).toBe(0);
        });
    });

    describe('4. Encoder Consistency', () => {
        it('should generate clean IOGL 1.0 from graph state', () => {
            const graph = {
                nodes: [
                    { id: 'n1', type: 'IN-01', position: { x: 10, y: 10 }, data: { label: 'MyInput', value: { type: 'scalar', value: 5 } } },
                    { id: 'n2', type: 'MA-06', position: { x: 100, y: 100 }, data: { label: 'Frac', mixed: true } }
                ],
                edges: [
                    { source: 'n1', sourceHandle: 'out_a', target: 'n2', targetHandle: 'in_a' }
                ]
            };
            
            const encoded = GraphCodec.encode(graph as any);
            expect(encoded).toContain('[MyInput] IN-01 5 @10,10');
            expect(encoded).toContain('[Frac] MA-06 { mode: "Mixed" }');
            expect(encoded).toContain('MyInput.a -> Frac.a');
        });
    });
});

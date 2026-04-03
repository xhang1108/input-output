import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphCodec } from '@/engine/GraphCodec';
import { Brain } from '@/engine/Brain';
import { NodeRegistry } from '@/engine/NodeRegistry';

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
                [num_1].a -> [res_1].a
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

        it('should handle complex positional data mapping (extreme merging surrogate)', () => {
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

        it('should correctly parse TR-03 (Geometry) with mode-based inputs', () => {
            const iogl = `
                [rad] IN-01 10
                [geo] TR-03 { mode: "Circle" }
                [rad].a -> [geo].a
            `;
            const { graph } = GraphCodec.parse(iogl);
            const edge = graph.edges[0];
            expect(edge.targetHandle).toBe('in_a');
        });

        it('should allow multiple connections to the same handle (Capsule support)', () => {
            const iogl = `
                [a1] IN-01 10
                [a2] IN-01 20
                [builder] DT-01 Rows
                [a1].a -> [builder].a
                [a2].a -> [builder].a
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
            expect(graph.nodes[0].position).toEqual({ x: -100, y: -200 });
        });

        it('should parse expression nodes (IN-09)', () => {
            const iogl = `
                [node] IN-09 "x^2"
                [res] OT-01
                [node].a -> [res].a
            `;
            const { graph } = GraphCodec.parse(iogl);
            expect(graph.nodes.find(n => n.type === 'IN-09')!.data!.code).toBe('x^2');
        });

        it('should handle complex algebraic chains', () => {
            const iogl = `
                [A] IN-01 10
                [B] IN-01 20
                [C] MA-01 ADD
                [D] OT-01
                [A].a -> [C].a
                [B].a -> [C].b
                [C].a -> [D].a
            `;
            const { graph, diagnostics } = GraphCodec.parse(iogl);
            expect(diagnostics).toHaveLength(0);
            expect(graph.edges).toHaveLength(3);
        });
    });

    describe('2. Error Handling & Validation', () => {
        it('should detect ghost links (non-existent handles)', () => {
            const iogl = `
                [n1] IN-01 10
                [n2] OT-01
                [n1].invalid -> [n2].a
            `;
            const { diagnostics } = GraphCodec.parse(iogl);
            expect(diagnostics.some(d => d.includes("does not have output handle"))).toBe(true);
        });
    });
});



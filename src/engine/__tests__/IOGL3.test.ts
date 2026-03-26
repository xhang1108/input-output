import { describe, it, expect } from 'vitest';
import { GraphCodec } from '../GraphCodec';

describe('IOGL 3.0 Parser Features', () => {
    it('should support positional data arrays (Extreme Array Merging)', () => {
        const iogl = `
            Num:io:num = [123]
            Slider:io:slider = [50, 0, 100, 1]
            Random:io:rand = [Uniform:Float, 1, 10, 0, 1]
        `;
        const { graph, diagnostics } = GraphCodec.parse(iogl);
        
        expect(diagnostics).toEqual([]);

        const numNode = graph.nodes.find(n => n.data!.label === 'Num')!;
        expect(numNode.data!.value).toBe(123);

        const sliderNode = graph.nodes.find(n => n.data!.label === 'Slider')!;
        expect(sliderNode.data!.value).toBe(50);
        expect(sliderNode.data!.min).toBe(0);
        expect(sliderNode.data!.max).toBe(100);
        expect(sliderNode.data!.step).toBe(1);

        const randNode = graph.nodes.find(n => n.data!.label === 'Random')!;
        expect(randNode.data!.mode).toBe('Uniform:Float');
        expect(randNode.data!.rows).toBe(1);
        expect(randNode.data!.cols).toBe(10);
    });

    it('should support handle aliasing (.a, .b)', () => {
        const iogl = `
            A:io:num = 10
            B:io:num = 20
            C:math:ADD
            A.a -> C.a
            B.a -> C.b
        `;
        const { graph, diagnostics } = GraphCodec.parse(iogl);
        
        expect(diagnostics).toEqual([]);
        expect(graph.edges).toHaveLength(2);

        const edges = graph.edges;
        expect(edges[0].sourceHandle).toBe('out_a');
        expect(edges[0].targetHandle).toBe('in_a');
        expect(edges[1].sourceHandle).toBe('out_a');
        expect(edges[1].targetHandle).toBe('in_b');
    });

    it('should handle context-aware positional mapping (e.g. IN-10 Normal vs Uniform)', () => {
        const iogl = `
            U:io:rand = [Uniform:Float, 1, 1, 0, 1]
            N:io:rand = [Normal:Float, 5, 1, 5, 2]
        `;
        const { graph, diagnostics } = GraphCodec.parse(iogl);
        
        expect(diagnostics).toEqual([]);

        const uNode = graph.nodes.find(n => n.data!.label === 'U')!;
        expect(uNode.data!.mode).toBe('Uniform:Float');
        expect(uNode.data!.min).toBe(0);
        expect(uNode.data!.max).toBe(1);

        const nNode = graph.nodes.find(n => n.data!.label === 'N')!;
        expect(nNode.data!.mode).toBe('Normal:Float');
        expect(nNode.data!.mean).toBe(5);
        expect(nNode.data!.stdDev).toBe(2);
    });

    it('should support TR-01 Unit mode and custom unit', () => {
        const iogl = `
            M:io:unit = [m]
            C:io:unit = [CUSTOM, "m/s"]
        `;
        const { graph, diagnostics } = GraphCodec.parse(iogl);
        
        expect(diagnostics).toEqual([]);

        const mNode = graph.nodes.find(n => n.data!.label === 'M')!;
        expect(mNode.data!.unit).toBe('m');

        const cNode = graph.nodes.find(n => n.data!.label === 'C')!;
        expect(cNode.data!.unit).toBe('CUSTOM');
        expect(cNode.data!.customUnit).toBe('m/s');
    });
});

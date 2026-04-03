import { Parser } from '@/engine/iogl/Parser';
import { Encoder } from '@/engine/iogl/Encoder';
import { describe, it, expect } from 'vitest';

describe('IOGL Unit Node Serialization', () => {
    it('should parse TR-01 REMOVE correctly', () => {
        const script = `[un] TR-01 REMOVE @10,10\n`;
        const parser = new Parser(script);
        const { graph } = parser.parse();
        
        expect(graph.nodes.length).toBe(1);
        const node = graph.nodes[0];
        expect(node!.data!.unit).toBe('REMOVE');
    });

    it('should parse TR-01 km correctly', () => {
        const script = `[un] TR-01 km @10,10\n`;
        const parser = new Parser(script);
        const { graph } = parser.parse();
        
        expect(graph.nodes.length).toBe(1);
        const node = graph.nodes[0];
        expect(node!.data!.unit).toBe('km');
    });

    it('should parse TR-01 CUSTOM "myunit" correctly', () => {
        const script = `[un] TR-01 CUSTOM "myunit" @10,10\n`;
        const parser = new Parser(script);
        const { graph } = parser.parse();
        
        expect(graph.nodes.length).toBe(1);
        const node = graph.nodes[0];
        expect(node!.data!.unit).toBe('CUSTOM');
        expect(node!.data!.customUnit).toBe('myunit');
    });

    it('should encode TR-01 REMOVE correctly', () => {
        const graph = {
            nodes: [{
                id: 'n1',
                type: 'TR-01',
                position: { x: 10, y: 10 },
                data: { unit: 'REMOVE', label: 'un' }
            }],
            edges: []
        };
        const encoded = Encoder.encode(graph as any);
        expect(encoded).toContain('TR-01 { mode: "REMOVE" }');
    });

    it('should encode TR-01 CUSTOM "myunit" correctly', () => {
        const graph = {
            nodes: [{
                id: 'n1',
                type: 'TR-01',
                position: { x: 10, y: 10 },
                data: { unit: 'CUSTOM', customUnit: 'myunit', label: 'un' }
            }],
            edges: []
        };
        const encoded = Encoder.encode(graph as any);
        expect(encoded).toContain('TR-01 "myunit" { mode: "CUSTOM" }');
    });
});

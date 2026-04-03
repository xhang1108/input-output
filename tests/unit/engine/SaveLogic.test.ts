
import { describe, it, expect } from 'vitest';
import { Serializer } from '@/engine/Serializer';
import { ProjectData } from '@/engine/types/types';

describe('Serializer / Save Logic (v4.0)', () => {
    
    const mockFullProject: any = {
        version: '1.0.0',
        mathPrecision: 64,
        settings: { theme: 'dark', showGrid: true },
        viewport: { x: 10, y: 20, zoom: 1.5 },
        nodes: [
            {
                id: 'val_1',
                type: 'io:val',
                position: { x: 100, y: 100 },
                data: {
                    label: 'Input A',
                    value: 42,
                    measured: { width: 100, height: 50 }, // BLOAT
                    selected: true,                       // BLOAT
                    dragging: false,                      // BLOAT
                    handles: [{ id: 'out', type: 'source' }] // BLOAT
                },
                measured: { width: 100, height: 50 },     // BLOAT (Root)
                selected: true                           // BLOAT (Root)
            }
        ],
        edges: [
            {
                id: 'e1',
                source: 'val_1',
                sourceHandle: 'out',
                target: 'calc_1',
                targetHandle: 'in',
                data: { stroke: 'red' } // BLOAT
            }
        ]
    };

    it('should prune redundant UI metadata and global settings', () => {
        const pruned = Serializer.prune(mockFullProject as ProjectData);

        // Core data must survive
        expect(pruned.nodes![0].id).toBe('val_1');
        expect((pruned.nodes![0].data as any).label).toBe('Input A');
        expect((pruned.nodes![0].data as any).value).toBe(42);
        expect(pruned.nodes![0].position).toEqual({ x: 100, y: 100 });

        // Bloat must be GONE from data
        expect((pruned.nodes![0].data as any).measured).toBeUndefined();
        expect((pruned.nodes![0].data as any).selected).toBeUndefined();
        expect((pruned.nodes![0].data as any).handles).toBeUndefined();

        // Bloat must be GONE from node root
        expect((pruned.nodes![0] as any).measured).toBeUndefined();
        expect((pruned.nodes![0] as any).selected).toBeUndefined();

        // Settings and Viewport must be GONE
        expect(pruned.settings).toBeUndefined();
        expect(pruned.viewport).toBeUndefined();

        // Edges should be lean
        expect(pruned.edges![0].id).toBe('e1');
        expect((pruned.edges![0] as any).data).toBeUndefined();
    });

    it('should perform a successful serialization round-trip', () => {
        const encoded = Serializer.serialize(mockFullProject as ProjectData);
        const decoded = Serializer.deserialize(encoded);

        expect(decoded).not.toBeNull();
        if (decoded) {
            // Pruning happens during serialization, so decoded should be lean
            expect(decoded.version).toBe('1.0.0');
            expect(decoded.nodes!.length).toBe(1);
            expect((decoded.nodes![0].data as any).value).toBe(42);
            expect(decoded.settings).toBeUndefined();
        }
    });

    it('should maintain data integrity for complex nested data', () => {
        const complexProject: any = {
            nodes: [{
                id: 'calc_1',
                data: {
                    matrix: [[1, 2], [3, 4]],
                    complexConfig: { mode: 'ADVANCED', options: [1, 2, 3] }
                }
            }]
        };

        const pruned = Serializer.prune(complexProject as ProjectData);
        expect((pruned.nodes![0].data as any).matrix).toEqual([[1, 2], [3, 4]]);
        expect(((pruned.nodes![0].data as any).complexConfig as any).mode).toBe('ADVANCED');
    });

    it('should handle missing or malformed data gracefully', () => {
        expect(Serializer.prune(null as any)).toBeNull();
        const empty = Serializer.prune({} as any);
        expect(empty.nodes).toEqual([]);
        expect(empty.edges).toEqual([]);
    });

});



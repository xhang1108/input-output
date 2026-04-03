import { describe, it, expect } from 'vitest';
import { findUpstreamPath } from '@/utils/graphUtils';
import { Edge } from '@xyflow/react';

describe('findUpstreamPath', () => {
    it('should find ancestors in a simple linear chain', () => {
        const edges: Edge[] = [
            { id: 'e1', source: 'A', target: 'B' },
            { id: 'e2', source: 'B', target: 'C' },
        ];
        
        const result = findUpstreamPath('C', edges);
        
        expect(result.nodeIds.sort()).toEqual(['A', 'B', 'C'].sort());
        expect(result.edgeIds.sort()).toEqual(['e1', 'e2'].sort());
    });

    it('should find ancestors with multiple branches', () => {
        const edges: Edge[] = [
            { id: 'e1', source: 'A', target: 'B' },
            { id: 'e2', source: 'C', target: 'B' },
            { id: 'e3', source: 'B', target: 'D' },
            { id: 'e4', source: 'E', target: 'F' }, // Unrelated
        ];
        
        const result = findUpstreamPath('D', edges);
        
        expect(result.nodeIds.sort()).toEqual(['A', 'B', 'C', 'D'].sort());
        expect(result.edgeIds.sort()).toEqual(['e1', 'e2', 'e3'].sort());
        expect(result.nodeIds).not.toContain('E');
        expect(result.edgeIds).not.toContain('e4');
    });

    it('should handle branched paths that do not lead to target', () => {
        const edges: Edge[] = [
            { id: 'e1', source: 'A', target: 'B' },
            { id: 'e2', source: 'B', target: 'C' },
            { id: 'e3', source: 'B', target: 'D' }, // Branch that doesn't lead to C
        ];
        
        const result = findUpstreamPath('C', edges);
        
        expect(result.nodeIds.sort()).toEqual(['A', 'B', 'C'].sort());
        expect(result.edgeIds.sort()).toEqual(['e1', 'e2'].sort());
        expect(result.nodeIds).not.toContain('D');
        expect(result.edgeIds).not.toContain('e3');
    });
});


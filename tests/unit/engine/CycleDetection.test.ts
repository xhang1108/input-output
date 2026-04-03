import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { createMockNode } from './TestUtils';

describe('Cycle Detection', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should reject a direct self-loop via validateConnection', async () => {
        await brain.injectNodes({
            nodes: [createMockNode('A', 'IN-01') as any],
            edges: []
        });

        const validation = brain.validateConnection('A', 'out', 'A', 'in');
        expect(validation.isValid).toBe(false);
        expect(validation.reason).toContain('node to itself');
    });

    it('should reject a simple A -> B -> A cycle', async () => {
        await brain.injectNodes({
            nodes: [
                createMockNode('A', 'IN-01') as any,
                createMockNode('B', 'MA-01') as any
            ],
            edges: [
                { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' }
            ]
        });

        const validation = brain.validateConnection('B', 'out', 'A', 'in');
        expect(validation.isValid).toBe(false);
        expect(validation.reason).toContain('cycle');
    });

    it('should reject a complex A -> B -> C -> A cycle', async () => {
        await brain.injectNodes({
            nodes: [
                createMockNode('A', 'IN-01') as any,
                createMockNode('B', 'MA-01') as any,
                createMockNode('C', 'MA-01') as any
            ],
            edges: [
                { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' },
                { id: 'e2', source: 'B', sourceHandle: 'out', target: 'C', targetHandle: 'in_a' }
            ]
        });

        const validation = brain.validateConnection('C', 'out', 'A', 'in');
        expect(validation.isValid).toBe(false);
        expect(validation.reason).toContain('cycle');
    });

    it('should block cycles during injectNodes and report them in diagnostics', async () => {
        const diagnostics = await brain.injectNodes({
            nodes: [
                { id: 'A', type: 'MA-01', position: { x: 0, y: 0 }, data: { op: 'ADD' } },
                { id: 'B', type: 'MA-01', position: { x: 100, y: 0 }, data: { op: 'ADD' } }
            ],
            edges: [
                { id: 'e1', source: 'A', sourceHandle: 'out', target: 'B', targetHandle: 'in_a' },
                { id: 'e2', source: 'B', sourceHandle: 'out', target: 'A', targetHandle: 'in_a' }
            ]
        });
        
        expect(diagnostics.some(d => d.includes('cycle'))).toBe(true);
        expect(brain.getEdges()).toHaveLength(1); // Only e1 should be added
    });
});



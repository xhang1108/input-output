import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { DataType } from '@/types/payload';

describe('Plot Node (OT-03) Integration', () => {
    beforeEach(() => {
        NodeRegistry.initializeNodes();
    });

    it('should extract formula from Scalar symbol when Expression Node provides x=2', async () => {
        // 1. Simulate Expression Node output for "x = 2"
        const expressionNode = {
            id: 'node-expr',
            type: 'IN-09',
            data: { code: 'x = 2' },
            isInDirtyChain: true
        };

        const exprResult = await NodeRegistry.evaluate(expressionNode as any, {});
        
        // Sanity check for Expression Node output (Now Symbolic per user request)
        expect(exprResult.type).toBe(DataType.Symbolic);
        expect(exprResult.value).toBe('x = 2');
        expect(exprResult.meta?.label).toBe('x');

        // 2. Simulate Plot Node (OT-03) evaluating this input
        const plotNode = {
            id: 'node-plot',
            type: 'OT-03',
            data: { mode: 'fx' } // Function mode
        };

        const inputs = {
            'in_a': exprResult
        };

        const plotResult = await NodeRegistry.evaluate(plotNode as any, inputs);
        
        // 3. Verify Plot Node correctly identified the formula
        // Result of OT-03 is usually metadata or the function itself for the UI
        expect(plotResult.type).toBe(DataType.Object);
        expect((plotResult.value as any).formula).toBe('x = 2');
        expect((plotResult.value as any).label).toBe('x');
    });

    it('should handle pure Symbolic input as fallback', async () => {
        const symbolicPayload = {
            type: DataType.Symbolic,
            value: 'sin(x)',
            symbol: null,
            meta: {}
        };

        const plotNode = {
            id: 'node-plot',
            type: 'OT-03',
            data: { mode: 'fx' }
        };

        const result = await NodeRegistry.evaluate(plotNode as any, { 'in_a': symbolicPayload });
        
        expect(result.type).toBe(DataType.Object);
        expect((result.value as any).formula).toBe('sin(x)');
    });
});


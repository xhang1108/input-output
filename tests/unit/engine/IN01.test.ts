import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { DataType } from '@/types/payload';

describe('IN-01 Initial Value Standard', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should initialize with value 0 when newly created (no data)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Num', type: 'IN-01', position: { x: 0, y: 0 }, data: {} },
                { id: 'Debug', type: 'OT-04', position: { x: 100, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'Num', sourceHandle: 'out', target: 'Debug', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Debug');
        
        // 1. Value Check
        expect(result.type).toBe(DataType.Scalar);
        expect(PayloadUtils.unwrap(result)).toBe(0);

        // 2. Symbol Check
        expect(result.symbol).toBeDefined();
        expect(result.symbol?.type).toBe('Literal');
        expect(result.symbol?.value).toBe(0);

        // 3. Source Attribution Check
        // It should be coming from 'Num', NOT from Debug's internal fallback.
        expect(result.symbol?.sourceId).toBe('Num');
    });

    it('should maintain 0 in symbol even if label is provided but value is empty', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'Num', type: 'IN-01', position: { x: 0, y: 0 }, data: { label: 'MyVar' } },
                { id: 'Debug', type: 'OT-04', position: { x: 100, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'Num', sourceHandle: 'out', target: 'Debug', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Debug');
        
        expect(PayloadUtils.unwrap(result)).toBe(0);
        expect(result.symbol?.type).toBe('Literal');
        expect(result.symbol?.value).toBe(0);
        expect(result.symbol?.sourceId).toBe('Num');
    });

    it('should prioritize data.value over stale node.value in symbolizer', async () => {
        // Mock a situation where node.value is '1' but node.data.value is '5'
        await brain.injectNodes({
            nodes: [
                { id: 'Num', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 5 }, value: PayloadUtils.createScalar(1) },
                { id: 'Debug', type: 'OT-04', position: { x: 100, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'Num', sourceHandle: 'out', target: 'Debug', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Debug');
        
        // Payload should be 5
        expect(PayloadUtils.unwrap(result)).toBe(5);
        // Symbol value should also be 5 (not the stale 1 from node.value)
        expect(result.symbol?.value).toBe(5);
    });
});

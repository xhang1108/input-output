import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '../Brain';
import { PayloadUtils } from '../../utils/PayloadUtils';

describe('UnitNode Engine Logic', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should assign a custom unit to a scalar input', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IO-01', position: { x: 0, y: 0 }, value: 10 },
                { id: 'Unit', type: 'IO-05', position: { x: 100, y: 0 }, data: { unit: 'm/s' } },
                { id: 'Res', type: 'IO-11', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.meta?.unit).toBe('m/s');
        expect(PayloadUtils.unwrap(result)).toBe(10);
    });

    it('should convert units correctly when mixed', async () => {
        // 10 m -> UnitNode(cm) -> 1000 cm
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IO-01', position: { x: 0, y: 0 }, value: PayloadUtils.createScalar(10, 'm') },
                { id: 'Unit', type: 'IO-05', position: { x: 100, y: 0 }, data: { unit: 'cm' } },
                { id: 'Res', type: 'IO-11', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.meta?.unit).toBe('cm');
        expect(Number(PayloadUtils.unwrap(result))).toBe(1000);
    });

    it('should handle custom unit conversion (m/s to km/h)', async () => {
        // 10 m/s -> UnitNode(km/h) -> 36 km/h
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IO-01', position: { x: 0, y: 0 }, value: PayloadUtils.createScalar(10, 'm/s') },
                { id: 'Unit', type: 'IO-05', position: { x: 100, y: 0 }, data: { unit: 'km/h' } },
                { id: 'Res', type: 'IO-11', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.meta?.unit).toBe('km/h');
        expect(Number(PayloadUtils.unwrap(result))).toBe(36);
    });

    it('should show error for incompatible units', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IO-01', position: { x: 0, y: 0 }, value: PayloadUtils.createScalar(10, 'kg') },
                { id: 'Unit', type: 'IO-05', position: { x: 100, y: 0 }, data: { unit: 'm' } },
                { id: 'Res', type: 'IO-11', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.type).toBe('error');
        expect(result.meta?.error).toContain('Cannot convert kg to m');
    });
});

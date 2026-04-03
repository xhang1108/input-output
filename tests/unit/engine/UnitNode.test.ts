import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { registerIONodes } from '@/engine/nodes/ioNodes';
import { registerMathNodes } from '@/engine/nodes/mathNodes';

describe('UnitNode Engine Logic', () => {
    let brain: Brain;

    beforeEach(async () => {
        registerIONodes();
        registerMathNodes();
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should assign a custom unit to a scalar input', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 10 } },
                { id: 'Unit', type: 'TR-01', position: { x: 100, y: 0 }, data: { unit: 'm/s' } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in_a' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.meta?.unit).toBe('m/s');
        expect(Number(PayloadUtils.unwrap(result))).toBe(10);
    });

    it('should convert units correctly when mixed', async () => {
        // 10 m -> UnitNode(cm) -> 1000 cm
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: PayloadUtils.createScalar(10, 'm') } },
                { id: 'Unit', type: 'TR-01', position: { x: 100, y: 0 }, data: { unit: 'cm' } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in_a' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.meta?.unit).toBe('cm');
        expect(Number(PayloadUtils.unwrap(result))).toBe(1000);
    });

    it('should support arbitrary labels like "apple" without conversion failure', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 10 } },
                { id: 'Unit', type: 'TR-01', position: { x: 100, y: 0 }, data: { unit: 'CUSTOM', customUnit: 'apple' } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in_a' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(Number(PayloadUtils.unwrap(result))).toBe(10);
        expect(result.meta?.unit).toBe('apple');
    });

    it('should handle conversion between standard units correctly', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 1, unit: 'm' } },
                { id: 'Unit', type: 'TR-01', position: { x: 100, y: 0 }, data: { unit: 'cm' } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in_a' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.meta?.unit).toBe('cm');
        expect(Number(PayloadUtils.unwrap(result))).toBe(100);
    });

    it('should handle custom unit conversion (m/s to km/h)', async () => {
        // 10 m/s -> UnitNode(km/h) -> 36 km/h
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: PayloadUtils.createScalar(10, 'm/s') } },
                { id: 'Unit', type: 'TR-01', position: { x: 100, y: 0 }, data: { unit: 'km/h' } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in_a' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.meta?.unit).toBe('km/h');
        expect(Number(PayloadUtils.unwrap(result))).toBe(36);
    });

    it('should show error for incompatible units', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: PayloadUtils.createScalar(10, 'kg') } },
                { id: 'Unit', type: 'TR-01', position: { x: 100, y: 0 }, data: { unit: 'm' } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Unit', targetHandle: 'in_a' },
                { id: 'e2', source: 'Unit', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.type).toBe('error');
        expect(result.meta?.error).toContain('Cannot convert kg to m');
    });
});


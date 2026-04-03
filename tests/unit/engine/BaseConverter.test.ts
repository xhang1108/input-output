import { describe, it, expect, beforeEach } from 'vitest';
import { Brain } from '@/engine/Brain';
import { PayloadUtils } from '@/utils/PayloadUtils';

describe('BaseConverter Node Engine Logic', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    it('should auto-detect Source Base from input unit (Hex unit to 10)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-04', position: { x: 0, y: 0 }, data: { value: 'A', unit: 'hex' } },
                { id: 'Base', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 10 } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Base', targetHandle: 'in_a' },
                { id: 'e2', source: 'Base', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(PayloadUtils.unwrap(result)).toBe('10');
        expect(result.meta?.unit).toBe('dec');
    });

    it('should convert Decimal to Binary and set output unit', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-04', position: { x: 0, y: 0 }, data: { value: '10', unit: 'dec' } },
                { id: 'Base', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 2 } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Base', targetHandle: 'in_a' },
                { id: 'e2', source: 'Base', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(PayloadUtils.unwrap(result)).toBe('1010');
        expect(result.meta?.unit).toBe('bin');
    });

    it('should fallback to base 10 for unknown units', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 15, unit: 'meters' } }, // Scalar is allowed
                { id: 'Base', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 16 } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Base', targetHandle: 'in_a' },
                { id: 'e2', source: 'Base', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(PayloadUtils.unwrap(result)).toBe('F');
        expect(result.meta?.unit).toBe('hex');
    });

    it('should default to base 10 for input "1000" if correctly typed as Scalar', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 1000 } }, // Scalar
                { id: 'BaseHex', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 16 } },
                { id: 'BaseDec', type: 'TR-02', position: { x: 100, y: 100 }, data: { toBase: 10 } },
                { id: 'ResHex', type: 'OT-01', position: { x: 200, y: 0 } },
                { id: 'ResDec', type: 'OT-01', position: { x: 200, y: 100 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'BaseHex', targetHandle: 'in_a' },
                { id: 'e2', source: 'BaseHex', sourceHandle: 'out', target: 'ResHex', targetHandle: 'in_a' },
                { id: 'e3', source: 'In', sourceHandle: 'out', target: 'BaseDec', targetHandle: 'in_a' },
                { id: 'e4', source: 'BaseDec', sourceHandle: 'out', target: 'ResDec', targetHandle: 'in_a' }
            ]
        });

        const resHex = await brain.getValue('ResHex');
        const resDec = await brain.getValue('ResDec');
        
        expect(PayloadUtils.unwrap(resHex)).toBe('3E8');
        expect(PayloadUtils.unwrap(resDec)).toBe('1000');
    });

    it('should return error for invalid input string for base', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-04', position: { x: 0, y: 0 }, data: { value: 'G', unit: 'hex' } },
                { id: 'Base', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 10 } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Base', targetHandle: 'in_a' },
                { id: 'e2', source: 'Base', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        console.log('[Test Error Case Result]', result);
        expect(result.type).toBe('error');
        expect(result.meta?.error).toContain('Base Conversion Failed');
    });

    it('should convert Base 4 to Decimal (10 to 4)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-04', position: { x: 0, y: 0 }, data: { value: '10', unit: 'quat' } },
                { id: 'Base', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 10 } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Base', targetHandle: 'in_a' },
                { id: 'e2', source: 'Base', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(PayloadUtils.unwrap(result)).toBe('4');
        expect(result.meta?.unit).toBe('dec');
    });

    it('should convert Decimal to Base 4 (4 to 10)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-04', position: { x: 0, y: 0 }, data: { value: '4', unit: 'dec' } },
                { id: 'Base', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 4 } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Base', targetHandle: 'in_a' },
                { id: 'e2', source: 'Base', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(PayloadUtils.unwrap(result)).toBe('10');
        expect(result.meta?.unit).toBe('quat');
    });

    it('should reject Array input (e.g., RGB)', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-07', position: { x: 0, y: 0 }, data: { value: [255, 128, 64], unit: 'rgb' } },
                { id: 'Base', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 16 } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Base', targetHandle: 'in_a' },
                { id: 'e2', source: 'Base', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.type).toBe('error');
        expect(result.meta?.error).toContain('scalar or base-prefixed strings');
    });

    it('should reject generic String input without unit', async () => {
        await brain.injectNodes({
            nodes: [
                { id: 'In', type: 'IN-04', position: { x: 0, y: 0 }, data: { value: '1010' } }, // No unit
                { id: 'Base', type: 'TR-02', position: { x: 100, y: 0 }, data: { toBase: 10 } },
                { id: 'Res', type: 'OT-01', position: { x: 200, y: 0 } }
            ],
            edges: [
                { id: 'e1', source: 'In', sourceHandle: 'out', target: 'Base', targetHandle: 'in_a' },
                { id: 'e2', source: 'Base', sourceHandle: 'out', target: 'Res', targetHandle: 'in_a' }
            ]
        });

        const result = await brain.getValue('Res');
        expect(result.type).toBe('error');
        expect(result.meta?.error).toContain('scalar or base-prefixed strings');
    });
});


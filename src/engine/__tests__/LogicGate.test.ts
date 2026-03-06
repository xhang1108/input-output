import { describe, it, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { InputOutputEngine } from '../InputOutputEngine';
import { DataType, NodePayload } from '../../types/payload';

describe('Logic Gate (LG-01)', () => {
    beforeAll(() => {
        // Ensure InputOutputEngine is initialized
        InputOutputEngine.getInstance();
        initializeNodes();
    });

    const evaluate = async (op: string, a: any, b?: any, aUnit?: string, bUnit?: string) => {
        const node = {
            id: 'test-logic',
            type: 'LG-01',
            data: { op },
            position: { x: 0, y: 0 },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            selected: false,
            isInDirtyChain: false
        } as unknown as import('../types').NodeLogic;

        const inputs: Record<string, NodePayload> = {};
        if (a !== undefined) inputs.in_a = PayloadUtils.createScalar(a, aUnit);
        if (b !== undefined) inputs.in_b = PayloadUtils.createScalar(b, bUnit);

        return await NodeRegistry.evaluate(node, inputs);
    };

    it('should correctly compare simple numbers', async () => {
        const resGT = await evaluate('GT', 5, 3);
        expect(resGT.value).toBe(true);

        const resLT = await evaluate('LT', 5, 3);
        expect(resLT.value).toBe(false);

        const resEQ = await evaluate('EQ', 5, 5);
        expect(resEQ.value).toBe(true);
    });

    it('should correctly evaluate standard logic gates', async () => {
        // AND
        expect((await evaluate('AND', true, true)).value).toBe(true);
        expect((await evaluate('AND', true, false)).value).toBe(false);

        // OR
        expect((await evaluate('OR', true, false)).value).toBe(true);
        expect((await evaluate('OR', false, false)).value).toBe(false);

        // NOT
        expect((await evaluate('NOT', true)).value).toBe(false);
        expect((await evaluate('NOT', false)).value).toBe(true);

        // XOR
        expect((await evaluate('XOR', true, false)).value).toBe(true);
        expect((await evaluate('XOR', true, true)).value).toBe(false);
    });

    it('should correctly evaluate NEW logic gates (NAND, NOR, XNOR)', async () => {
        // NAND
        expect((await evaluate('NAND', true, true)).value).toBe(false);
        expect((await evaluate('NAND', true, false)).value).toBe(true);

        // NOR
        expect((await evaluate('NOR', true, false)).value).toBe(false);
        expect((await evaluate('NOR', false, false)).value).toBe(true);

        // XNOR
        expect((await evaluate('XNOR', true, true)).value).toBe(true);
        expect((await evaluate('XNOR', true, false)).value).toBe(false);
    });

    it('should correctly compare Units', async () => {
        // 2m > 150cm (1.5m) -> True
        const resGT = await evaluate('GT', 2, 150, 'm', 'cm');
        expect(resGT.value).toBe(true);

        // 100cm < 1.2m -> True
        const resLT = await evaluate('LT', 100, 1.2, 'cm', 'm');
        expect(resLT.value).toBe(true);

        // 1m == 100cm -> True
        const resEQ = await evaluate('EQ', 1, 100, 'm', 'cm');
        expect(resEQ.value).toBe(true);
    });

    it('should fail gracefully for incompatible units', async () => {
        // 1m > 1kg -> Error
        const res = await evaluate('GT', 1, 1, 'm', 'kg');
        expect(res.type).toBe(DataType.Error);
        expect(res.meta.error).toContain('Failed');
    });
});

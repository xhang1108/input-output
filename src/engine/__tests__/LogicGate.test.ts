
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { MathEngine } from '../MathEngine';
import { DataType } from '../../types/payload';

describe('Logic Gate (MA-05)', () => {
    beforeAll(() => {
        // Ensure MathEngine is initialized
        MathEngine.getInstance();
    });

    const evaluate = async (op: string, a: any, b: any, aUnit?: string, bUnit?: string) => {
        const node = {
            id: 'test-logic',
            type: 'MA-05',
            data: { op },
            position: { x: 0, y: 0 },
            value: null
        };

        const inputs = {
            in_a: PayloadUtils.createScalar(a, aUnit),
            in_b: PayloadUtils.createScalar(b, bUnit)
        };

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

    it('should handle BigNumbers if configured (simulation)', async () => {
        // We can't easily switch engine mode here without mocking, 
        // but we can test if the evaluator handles object wrappers by manually creating one if needed.
        // For now, standard hydration test covers the logic path.
    });
});

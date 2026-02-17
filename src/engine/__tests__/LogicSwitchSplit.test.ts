
import { NodeRegistry } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { MathEngine } from '../MathEngine';
import { DataType } from '../../types/payload';

describe('Logic Switch & Split (MA-04/13)', () => {
    beforeAll(() => {
        MathEngine.getInstance();
    });

    const evaluate = async (type: string, inputs: any) => {
        const node = {
            id: 'test-logic',
            type,
            data: {},
            position: { x: 0, y: 0 },
            value: null
        };
        return await NodeRegistry.evaluate(node, inputs);
    };

    describe('MA-04 Switch', () => {
        it('should switch based on scalar boolean', async () => {
            const inputs = {
                condition: PayloadUtils.createBoolean(true),
                in_true: PayloadUtils.createScalar(1),
                in_false: PayloadUtils.createScalar(0)
            };
            const res = await evaluate('MA-04', inputs);
            expect(res.value).toBe(1);
        });

        it('should handle Unit truthiness correctly (0m is false, 5m is true)', async () => {
            // Case 1: 0m (Should be False -> return in_false)
            // Simulating MA-01 output: Dehydrated Unit Object
            const zeroUnitPayload = {
                type: DataType.Scalar,
                value: { mathjs: 'Unit', value: 0, unit: 'm' }, // Object!
                symbol: null,
                meta: { unit: 'm' }
            };

            let inputs = {
                condition: zeroUnitPayload,
                in_true: PayloadUtils.createString('TruePath'),
                in_false: PayloadUtils.createString('FalsePath')
            };
            let res = await evaluate('MA-04', inputs);
            expect(res.value).toBe('FalsePath'); // This should fail if object is truthy

            // Case 2: 5m (Should be True -> return in_true)
            const fiveUnitPayload = {
                type: DataType.Scalar,
                value: { mathjs: 'Unit', value: 5, unit: 'm' },
                symbol: null,
                meta: { unit: 'm' }
            };
            inputs = { ...inputs, condition: fiveUnitPayload };
            res = await evaluate('MA-04', inputs);
            expect(res.value).toBe('TruePath');
        });
    });

    describe('MA-13 Logic Split', () => {
        it('should split based on scalar boolean', async () => {
            const inputs = {
                condition: PayloadUtils.createBoolean(true),
                data: PayloadUtils.createScalar(42)
            };
            const res = await evaluate('MA-13', inputs);
            expect(res.value.out_true).not.toBeNull();
            expect(res.value.out_false).toBeNull();
            expect(res.value.out_true.value).toBe(42);
        });

        it('should handle Unit truthiness correctly', async () => {
            // Case 1: 0m (Should be False -> out_true=null, out_false=data)
            let inputs = {
                condition: PayloadUtils.createScalar(0, 'm'),
                data: PayloadUtils.createString('Data')
            };
            let res = await evaluate('MA-13', inputs);
            expect(res.value.out_true).toBeNull();
            expect(res.value.out_false).not.toBeNull();

            // Case 2: 5m (Should be True -> out_true=data, out_false=null)
            inputs.condition = PayloadUtils.createScalar(5, 'm');
            res = await evaluate('MA-13', inputs);
            expect(res.value.out_true).not.toBeNull();
            expect(res.value.out_false).toBeNull();
        });
    });
});

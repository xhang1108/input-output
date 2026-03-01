import { describe, it, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '../NodeRegistry';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { InputOutputEngine } from '../InputOutputEngine';
import { DataType, NodePayload } from '../../types/payload';

describe('Logic Switch & Split (MA-04/13)', () => {
    beforeAll(() => {
        InputOutputEngine.getInstance();
        initializeNodes();
    });

    const evaluate = async (type: string, inputs: Record<string, NodePayload>) => {
        const node = {
            id: 'test-logic',
            type,
            data: {},
            position: { x: 0, y: 0 },
            value: { type: DataType.Scalar, value: 0, symbol: null, meta: {} },
            isInDirtyChain: false
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
                value: { mathjs: 'Unit', value: 0, unit: 'm' },
                symbol: null,
                meta: { unit: 'm' }
            } as NodePayload;

            let inputs = {
                condition: zeroUnitPayload,
                in_true: PayloadUtils.createString('TruePath'),
                in_false: PayloadUtils.createString('FalsePath')
            };
            let res = await evaluate('MA-04', inputs);
            expect(res.value).toBe('FalsePath');

            // Case 2: 5m (Should be True -> return in_true)
            const fiveUnitPayload = {
                type: DataType.Scalar,
                value: { mathjs: 'Unit', value: 5, unit: 'm' },
                symbol: null,
                meta: { unit: 'm' }
            } as NodePayload;
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
            const val = res.value as Record<string, NodePayload>;
            expect(val.out_true).not.toBeNull();
            expect(val.out_false).toBeNull();
            expect(val.out_true.value).toBe(42);
        });

        it('should handle Unit truthiness correctly', async () => {
            // Case 1: 0m (Should be False -> out_true=null, out_false=data)
            const inputs = {
                condition: PayloadUtils.createScalar(0, 'm'),
                data: PayloadUtils.createString('Data')
            };
            let res = await evaluate('MA-13', inputs);
            let val = res.value as Record<string, NodePayload>;
            expect(val.out_true).toBeNull();
            expect(val.out_false).not.toBeNull();

            // Case 2: 5m (Should be True -> out_true=data, out_false=null)
            inputs.condition = PayloadUtils.createScalar(5, 'm');
            res = await evaluate('MA-13', inputs);
            val = res.value as Record<string, NodePayload>;
            expect(val.out_true).not.toBeNull();
            expect(val.out_false).toBeNull();
            expect(val.out_true.value).toBe('Data');
        });
    });
});

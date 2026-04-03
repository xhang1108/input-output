import { describe, it, expect, beforeAll } from 'vitest';
import { NodeRegistry, initializeNodes } from '@/engine/NodeRegistry';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { InputOutputEngine } from '@/engine/InputOutputEngine';
import { DataType, NodePayload } from '@/types/payload';

describe('Logic Switch & Split (LG-02/03)', () => {
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
            selected: false,
            isInDirtyChain: false
        };
        return await NodeRegistry.evaluate(node, inputs);
    };

    describe('LG-02 Switch', () => {
        it('should switch based on scalar boolean', async () => {
            const inputs = {
                in_a: PayloadUtils.createBoolean(true),
                in_b: PayloadUtils.createScalar(1),
                in_c: PayloadUtils.createScalar(0)
            };
            const res = await evaluate('LG-02', inputs);
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
                in_a: zeroUnitPayload,
                in_b: PayloadUtils.createString('TruePath'),
                in_c: PayloadUtils.createString('FalsePath')
            };
            let res = await evaluate('LG-02', inputs);
            expect(res.value).toBe('FalsePath');

            // Case 2: 5m (Should be True -> return in_true)
            const fiveUnitPayload = {
                type: DataType.Scalar,
                value: { mathjs: 'Unit', value: 5, unit: 'm' },
                symbol: null,
                meta: { unit: 'm' }
            } as NodePayload;
            inputs = { ...inputs, in_a: fiveUnitPayload };
            res = await evaluate('LG-02', inputs);
            expect(res.value).toBe('TruePath');
        });
    });

    describe('LG-03 Logic Split', () => {
        it('should split based on scalar boolean', async () => {
            const inputs = {
                in_a: PayloadUtils.createBoolean(true),
                in_b: PayloadUtils.createScalar(42)
            };
            const res = await evaluate('LG-03', inputs);
            const val = res.value as Record<string, NodePayload>;
            expect(val.out_a).not.toBeNull();
            expect(val.out_b).toBeNull();
            expect(val.out_a.value).toBe(42);
        });

        it('should handle Unit truthiness correctly', async () => {
            // Case 1: 0m (Should be False -> out_a=null, out_b=data)
            const inputs = {
                in_a: PayloadUtils.createScalar(0, 'm'),
                in_b: PayloadUtils.createString('Data')
            };
            let res = await evaluate('LG-03', inputs);
            let val = res.value as Record<string, NodePayload>;
            expect(val.out_a).toBeNull();
            expect(val.out_b).not.toBeNull();

            // Case 2: 5m (Should be True -> out_a=data, out_b=null)
            inputs.in_a = PayloadUtils.createScalar(5, 'm');
            res = await evaluate('LG-03', inputs);
            val = res.value as Record<string, NodePayload>;
            expect(val.out_a).not.toBeNull();
            expect(val.out_b).toBeNull();
            expect(val.out_a.value).toBe('Data');
        });
    });
});



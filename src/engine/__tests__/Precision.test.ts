import { describe, it, expect, beforeEach } from 'vitest';
import { InputOutputEngine } from '../InputOutputEngine';
import { MathEvaluators } from '../nodes/Evaluators/Math/MathEvaluators';
import { IOEvaluators } from '../nodes/Evaluators/IO/IOEvaluators';
import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';

describe('Precision and Units Integration', () => {
    let math: any;
    
    beforeEach(() => {
        math = InputOutputEngine.getInstance().getMathInstance();
    });

    it('should maintain Scalar type and support precision after multiplying two units (m * m)', async () => {
        const payloadA = PayloadUtils.createScalar(10, 'm');
        const payloadB = PayloadUtils.createScalar(5, 'm');
        
        // 1. Multiply (10m * 5m)
        const ma01 = MathEvaluators['MA-01'];
        const calcNode = { id: 'calc', data: { mode: 'MUL' } } as any;
        const result = ma01(calcNode, { 'in_a': payloadA, 'in_b': payloadB });
        
        expect(result.type).toBe(DataType.Scalar);
        expect(result.meta?.unit).toBe('m^2');
        
        // 2. Pass to Result Node with Precision (e.g. 2)
        const ot01 = IOEvaluators['OT-01'];
        const resultNode = { id: 'result', data: { precision: 2 } } as any;
        const final = ot01(resultNode, { 'in_a': result });
        
        expect(final.type).toBe(DataType.Scalar);
        expect(final.meta?.unit).toBe('m^2');
        
        // Expected value: 50.00 (as a dehydrated BigNumber or formatted result)
        // Note: OT-01 returns a Scalar payload.
        const val = PayloadUtils.unwrap(final);
        // Depending on implementation, it might be a BigNumber object or its dehydrated form
        const hydrated = PayloadUtils.hydrate(val as any, math);
        expect((hydrated as any).toString()).toBe('50');
    });

    it('should maintain Scalar type after unit conversion including precision', async () => {
        const payload = PayloadUtils.createScalar(100, 'm');
        
        // 1. Convert m to km (0.1 km)
        const tr01 = MathEvaluators['TR-01'];
        const convNode = { id: 'conv', data: { unit: 'km' } } as any;
        const converted = tr01(convNode, { 'in_a': payload });
        
        expect(converted.type).toBe(DataType.Scalar);
        expect(converted.meta?.unit).toBe('km');
        
        // 2. Round to precision 4
        const ot01 = IOEvaluators['OT-01'];
        const resultNode = { id: 'result', data: { precision: 4 } } as any;
        const final = ot01(resultNode, { 'in_a': converted });
        
        expect(final.type).toBe(DataType.Scalar);
        // Note: OT-01 rounding 0.1 to 4 precision should still be 0.1 internally
        // BUT it must remain a Scalar.
    });
});

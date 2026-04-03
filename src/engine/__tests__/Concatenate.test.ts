import { describe, it, expect, beforeEach } from 'vitest';
import { IOEvaluators } from '../nodes/Evaluators/IO/IOEvaluators';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { DataType } from '../../types/payload';

describe('UT-03 Concatenate Node', () => {
    const evaluator = IOEvaluators['UT-03'];

    it('should join multiple strings with an empty delimiter by default', () => {
        const node = { id: 'n1', type: 'UT-03', data: {} };
        const inputs = {
            'in_a': [
                PayloadUtils.createString('Hello'),
                PayloadUtils.createString('World')
            ]
        };

        const result = evaluator(node as any, inputs);
        expect(result.type).toBe(DataType.String);
        expect(result.value).toBe('HelloWorld');
    });

    it('should use a custom delimiter', () => {
        const node = { id: 'n1', type: 'UT-03', data: { delimiter: ', ' } };
        const inputs = {
            'in_a': [
                PayloadUtils.createString('Apple'),
                PayloadUtils.createString('Banana'),
                PayloadUtils.createString('Cherry')
            ]
        };

        const result = evaluator(node as any, inputs);
        expect(result.value).toBe('Apple, Banana, Cherry');
    });

    it('should automatically stringify non-string inputs', () => {
        const node = { id: 'n1', type: 'UT-03', data: { delimiter: ': ' } };
        const inputs = {
            'in_a': [
                PayloadUtils.createString('Score'),
                PayloadUtils.createScalar(42),
                PayloadUtils.createArray([1, 2, 3])
            ]
        };

        const result = evaluator(node as any, inputs);
        // PayloadUtils.createArray([1,2,3]) unwraps to [[1,2,3]] usually, 
        // String([[1,2,3]]) in JS is "1,2,3"
        expect(result.value).toBe('Score: 42: 1,2,3');
    });

    it('should handle empty inputs gracefully', () => {
        const node = { id: 'n1', type: 'UT-03', data: {} };
        const inputs = { 'in_a': [] };

        const result = evaluator(node as any, inputs);
        expect(result.value).toBe('');
    });

    it('should handle null/undefined unwrapped values as empty strings', () => {
        const node = { id: 'n1', type: 'UT-03', data: { delimiter: '-' } };
        const inputs = {
            'in_a': [
                PayloadUtils.createString('A'),
                null, // Simulate missing payload
                PayloadUtils.createString('C')
            ]
        };

        const result = evaluator(node as any, inputs as any);
        expect(result.value).toBe('A--C');
    });
});

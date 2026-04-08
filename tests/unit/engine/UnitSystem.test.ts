import { describe, test, it, expect, beforeEach, beforeAll } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { DataType } from '@/types/payload';
import { InputOutputEngine } from '@/engine/InputOutputEngine';
import { UnitAlgebra } from '@/utils/UnitAlgebra';
import { Brain } from '@/engine/Brain';
import { registerIONodes } from '@/engine/nodes/ioNodes';
import { registerMathNodes } from '@/engine/nodes/mathNodes';

describe('Unit System (UnitAlgebra + UnitNode Conversion)', () => {

    describe('UnitAlgebra Utility', () => {
        it('should parse simple and compound units', () => {
            expect(UnitAlgebra.parse('km').get('km')).toBe(1);
            expect(UnitAlgebra.parse('m/s').get('s')).toBe(-1);
            expect(UnitAlgebra.parse('kg*m/s^2').get('s')).toBe(-2);
        });

        it('should perform algebraic operations', () => {
            const m = UnitAlgebra.parse('m');
            const s = UnitAlgebra.parse('s');
            const ms = UnitAlgebra.multiply(m, UnitAlgebra.power(s, -1));
            expect(UnitAlgebra.format(ms)).toBe('m/s');
        });

        it('should merge units correctly', () => {
            expect(UnitAlgebra.merge('km', 'km', 'ADD')).toBe('km');
            expect(UnitAlgebra.merge('m/s', 's', 'MUL')).toBe('m');
            expect(UnitAlgebra.merge('km^2', 'km', 'DIV')).toBe('km');
        });

        it('should prettify units for display', () => {
            expect(UnitAlgebra.prettify('km^2')).toBe('km²');
            expect(UnitAlgebra.prettify('N*m')).toBe('N·m');
        });
    });

    describe('UnitNode (TR-01) Evaluation', () => {
        beforeAll(() => {
            NodeRegistry.initializeNodes();
        });

        async function evalUnitNode(unit: string, isCustom: boolean, inputPayload?: any) {
            const node = { 
                id: 'test-unit', 
                type: 'TR-01', 
                data: isCustom ? { unit: 'CUSTOM', customUnit: unit } : { unit } 
            } as any;
            const result = (await NodeRegistry.evaluate(node, { in_a: inputPayload })) as any;
            if (result && result.value !== undefined && result.value !== null && result.type !== DataType.Error) {
                const math = InputOutputEngine.getInstance().getMathInstance() as any;
                const hydrated = PayloadUtils.hydrate(result.value, math) as any;
                result.value = hydrated.toString();
            }
            return result;
        }

        test('Labeling mode', async () => {
            const res = await evalUnitNode('km', false, PayloadUtils.createScalar(10));
            expect(res.meta?.unit).toBe('km');
        });

        test('Automatic conversion (s to min)', async () => {
            const res = await evalUnitNode('min', false, PayloadUtils.createScalar(60, 's'));
            expect(res.value).toBe('1');
            expect(res.meta?.unit).toBe('min');
        });

        test('Incompatible units error', async () => {
            const res = await evalUnitNode('km', false, PayloadUtils.createScalar(1, 's'));
            expect(res.type).toBe(DataType.Error);
            expect(res.meta?.error).toContain('Cannot convert s to km');
        });

        test('High-Precision Area Conversion', async () => {
            const res = await evalUnitNode('km^2', false, PayloadUtils.createScalar('20024691.3578', 'm^2'));
            expect(res.value).toBe('20.0246913578');
        });
    });

    describe('Unit Evolution (Brain Integration)', () => {
        let brain: Brain;

        beforeEach(async () => {
            registerIONodes();
            registerMathNodes();
            brain = Brain.getInstance();
            await brain.injectNodes({ nodes: [], edges: [] }, true);
        });

        it('should propagate units through a chain', async () => {
            await brain.injectNodes({
                nodes: [
                    { id: 'In', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 10, unit: 'm' } },
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
    });
});

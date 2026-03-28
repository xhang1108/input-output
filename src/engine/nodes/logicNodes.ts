import { InputOutputEngine } from '../InputOutputEngine';
import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NodeRegistry } from '../NodeRegistry';

export function registerLogicNodes() {
    // LG-01: Logic Gate (AND, OR, NOT, XOR, NAND, NOR, XNOR)
    NodeRegistry.register('LG-01', (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'AND';
        const getVal = (key: string) => {
            const p = inputs[key];
            if (!p) return null;
            const raw = PayloadUtils.unwrap(p);
            const hydrated = PayloadUtils.hydrate(raw, math);
            if (p.meta?.unit && (typeof hydrated === 'number' || (hydrated as any)?.isBigNumber)) {
                try { return math.unit(hydrated, p.meta.unit); } catch (e) { return hydrated; }
            }
            return hydrated;
        };
        const valA = getVal('in_a');
        const valB = getVal('in_b');
        const toBool = (v: unknown) => PayloadUtils.toBoolean(v, math);
        try {
            const isHigh = (v: any) => {
                try {
                    return math.equal(v, 1) === true || v === true;
                } catch {
                    return false;
                }
            };

            const highA = isHigh(valA);
            const highB = isHigh(valB);
            const areEqual = math.equal(valA, valB);
            let result: boolean;

            switch (op) {
                case 'GT': result = math.larger(valA, valB); break;
                case 'LT': result = math.smaller(valA, valB); break;
                case 'GTE': result = math.largerEq(valA, valB); break;
                case 'LTE': result = math.smallerEq(valA, valB); break;
                case 'NEQ': result = !areEqual; break;
                case 'EQ': result = areEqual; break;
                case 'NOT': result = !highA; break;
                case 'AND': result = highA && highB; break;
                case 'OR': result = highA || highB; break;
                case 'XOR': result = (highA !== highB); break;
                case 'NAND': result = !(highA && highB); break;
                case 'NOR': result = !(highA || highB); break;
                case 'XNOR': result = (highA === highB); break;
                default: result = false;
            }
            return PayloadUtils.createBoolean(result);
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    }, (node, inputs) => {
        const data = (node.data || {}) as any;
        const op = data.mode || data.op || 'AND';
        const ops: any = { EQ: '==', GT: '>', LT: '<', GTE: '>=', LTE: '<=', NEQ: '!=', AND: '&&', OR: '||' };
        if (op === 'NOT') return PayloadUtils.createSymbol('UnaryExpression', { operator: '!', argument: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: false }) });
        if (ops[op]) return PayloadUtils.createSymbol('BinaryExpression', { operator: ops[op], left: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }), right: inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }) });
        return PayloadUtils.createSymbol('Literal', { value: 'Logic' });
    });

    // LG-03: Logic Split
    NodeRegistry.register('LG-03', (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance();
        const condition = PayloadUtils.toBoolean(inputs['in_a'], math);
        const data = inputs['in_b'] || PayloadUtils.createScalar(0);
        return {
            type: DataType.Object,
            value: { out_a: condition ? data : null, out_b: !condition ? data : null },
            symbol: null,
            meta: { handleMeta: { out_a: data.meta, out_b: data.meta } }
        };
    });

    // LG-02: Switch
    NodeRegistry.register('LG-02', (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance();
        const condition = PayloadUtils.toBoolean(inputs['in_a'], math);
        return (condition ? inputs['in_b'] : inputs['in_c']) || PayloadUtils.createError('No Input');
    }, (node, inputs) => {
        return PayloadUtils.createSymbol('ConditionalExpression', {
            test: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: false }),
            consequent: inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
            alternate: inputs['in_c'] || PayloadUtils.createSymbol('Literal', { value: 0 })
        });
    });


    // IN-05: Button
    NodeRegistry.register('IN-05', (node) => {
        const data = (node.data || {}) as any;
        return PayloadUtils.createBoolean(!!PayloadUtils.unwrap(data.value));
    }, (node) => PayloadUtils.createSymbol('Literal', { value: !!PayloadUtils.unwrap((node.data || {}).value) }));
}

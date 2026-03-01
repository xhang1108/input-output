import { InputOutputEngine } from '../InputOutputEngine';
import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NodeRegistry } from '../NodeRegistry';

export function registerLogicNodes() {
    // MA-05: Logic Gate (AND, OR, NOT, XOR, NAND, NOR, XNOR)
    NodeRegistry.register('MA-05', (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance() as any;
        const data = (node.data || {}) as any;
        const op = data.op || 'AND';
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
            let result: boolean;
            switch (op) {
                case 'GT': result = math.larger(valA, valB); break;
                case 'LT': result = math.smaller(valA, valB); break;
                case 'GTE': result = math.largerEq(valA, valB); break;
                case 'LTE': result = math.smallerEq(valA, valB); break;
                case 'NEQ': result = !math.equal(valA, valB); break;
                case 'EQ': result = math.equal(valA, valB); break;
                case 'NOT': result = !toBool(valA); break;
                case 'AND': result = toBool(valA) && toBool(valB); break;
                case 'OR': result = toBool(valA) || toBool(valB); break;
                case 'XOR': result = (toBool(valA) !== toBool(valB)); break;
                default: result = false;
            }
            return PayloadUtils.createBoolean(result);
        } catch (e: any) { return PayloadUtils.createError(`${op} Failed: ${e.message}`); }
    }, (node, inputs) => {
        const op = ((node.data || {}) as any).op || 'AND';
        const ops: any = { EQ: '==', GT: '>', LT: '<', GTE: '>=', LTE: '<=', NEQ: '!=', AND: '&&', OR: '||' };
        if (op === 'NOT') return PayloadUtils.createSymbol('UnaryExpression', { operator: '!', argument: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: false }) });
        if (ops[op]) return PayloadUtils.createSymbol('BinaryExpression', { operator: ops[op], left: inputs['in_a'] || PayloadUtils.createSymbol('Literal', { value: 0 }), right: inputs['in_b'] || PayloadUtils.createSymbol('Literal', { value: 0 }) });
        return PayloadUtils.createSymbol('Literal', { value: 'Logic' });
    });

    // MA-13: Logic Split
    NodeRegistry.register('MA-13', (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance();
        const condition = PayloadUtils.toBoolean(inputs['condition'], math);
        const data = inputs['data'] || PayloadUtils.createScalar(0);
        return {
            type: DataType.Object,
            value: { out_true: condition ? data : null, out_false: !condition ? data : null },
            symbol: null,
            meta: { handleMeta: { out_true: data.meta, out_false: data.meta } }
        };
    });

    // MA-04: Switch
    NodeRegistry.register('MA-04', (node, inputs) => {
        const math = InputOutputEngine.getInstance().getMathInstance();
        const condition = PayloadUtils.toBoolean(inputs['condition'], math);
        return (condition ? inputs['in_true'] : inputs['in_false']) || PayloadUtils.createError('No Input');
    }, (node, inputs) => {
        return PayloadUtils.createSymbol('ConditionalExpression', {
            test: inputs['condition'] || PayloadUtils.createSymbol('Literal', { value: false }),
            consequent: inputs['in_true'] || PayloadUtils.createSymbol('Literal', { value: 0 }),
            alternate: inputs['in_false'] || PayloadUtils.createSymbol('Literal', { value: 0 })
        });
    });

    // MA-08: Toggle
    NodeRegistry.register('MA-08', (node) => {
        const data = (node.data || {}) as any;
        return PayloadUtils.createBoolean(!!PayloadUtils.unwrap(data.value));
    }, (node) => PayloadUtils.createSymbol('Literal', { value: !!PayloadUtils.unwrap((node.data || {}).value) }));

    // MA-09: Button
    NodeRegistry.register('MA-09', (node) => {
        const data = (node.data || {}) as any;
        return PayloadUtils.createBoolean(!!PayloadUtils.unwrap(data.value));
    }, (node) => PayloadUtils.createSymbol('Literal', { value: !!PayloadUtils.unwrap((node.data || {}).value) }));
}

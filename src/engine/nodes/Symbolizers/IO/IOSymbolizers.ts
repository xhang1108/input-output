import { PayloadUtils } from '../../../../utils/PayloadUtils';
import { NodeSymbolizer } from '../../../NodeRegistry';
import { Brain } from '../../../Brain';

export const IOSymbolizers: Record<string, NodeSymbolizer> = {
    'IO-01': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const name = data.label as string;
        const value = PayloadUtils.unwrap(node.value);
        return name
            ? PayloadUtils.createSymbol('Identifier', { name, value: value as string | number | boolean | undefined })
            : PayloadUtils.createSymbol('Literal', { value: value as string | number | boolean | undefined });
    },
    'IO-04': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const sym = PayloadUtils.createSymbol('Literal', { value: String(data.value || '') });
        if (node.id) sym.sourceId = node.id;
        return sym;
    },
    'IO-11': (node, inputs) => {
        return inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createSymbol('Literal', { value: 0 });
    },
    'IO-08': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const label = data.label as string;
        if (label) return PayloadUtils.createSymbol('Identifier', { name: label });
        return PayloadUtils.createSymbol('Identifier', { name: 'Matrix' });
    },
    'IO-18': (node) => {
        const val = node.value || { value: '#ffffff' };
        const raw = PayloadUtils.unwrap(val) as any;
        return PayloadUtils.createSymbol('Literal', { value: raw?.hex || String(raw) });
    },
    'IO-16': (node, inputs) => {
        return inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 'Matrix' });
    },
    'IO-05': (node, inputs) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const inputSymbol = inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 });
        const targetUnit = data.unit as string;
        return { ...inputSymbol, unit: targetUnit };
    },
    'IO-02': (node) => {
        return PayloadUtils.createSymbol('Literal', { value: PayloadUtils.unwrap(node.value) as string | number | boolean | undefined });
    },
    'IO-06': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'random',
            args: [
                PayloadUtils.createSymbol('Literal', { value: Number(data.min ?? 0) }),
                PayloadUtils.createSymbol('Literal', { value: Number(data.max ?? 1) })
            ]
        });
    },
    'IO-21': (node) => {
        let total = 0;
        const accumulateValue = (currentNodeId: string): void => {
            const brainNodeMap = Brain.getInstance().getNodesMap();
            const currentNode = brainNodeMap.get(currentNodeId);
            const nodeData = (currentNode?.data || (currentNodeId === node.id ? node.data : {})) as Record<string, unknown>;
            if (nodeData.prevAbacusId) accumulateValue(nodeData.prevAbacusId as string);
            const digits = (nodeData.digits as number[]) || [0, 0, 0, 0, 0, 0, 0];
            for (let i = 0; i < digits.length; i++) {
                total = total * 10 + digits[i];
            }
        };
        accumulateValue(node.id!);
        return PayloadUtils.createSymbol('Literal', { value: total });
    }
};

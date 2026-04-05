import { NodeSymbolizer } from '@/engine/NodeRegistry';
import { Brain } from '@/engine/Brain';
import { NodeLogic } from '@/engine/types';
import { PayloadUtils } from '@/utils/PayloadUtils';

export const IOSymbolizers: Record<string, NodeSymbolizer> = {
    'IN-01': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const rawVal = data.value ?? data.val;
        const unwrapped = rawVal !== undefined ? PayloadUtils.unwrap(rawVal) : PayloadUtils.unwrap(node.value);
        const value = (unwrapped !== undefined && unwrapped !== null) ? unwrapped : 0;
        
        // Per user request: Label is just a display name, not a variable.
        // Symbols for source nodes should always be the Literal value.
        return PayloadUtils.createSymbol('Literal', { value: value as string | number | boolean | undefined });
    },
    'IN-04': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const rawVal = data.value ?? data.val;
        const unwrapped = rawVal !== undefined ? PayloadUtils.unwrap(rawVal) : PayloadUtils.unwrap(node.value);
        const strVal = (unwrapped !== undefined && unwrapped !== null) ? String(unwrapped) : '';
        const sym = PayloadUtils.createSymbol('Literal', { value: strVal });
        if (node.id) sym.sourceId = node.id;
        return sym;
    },
    'OT-01': (node, inputs) => {
        return inputs['in_a'] || inputs['in'] || Object.values(inputs)[0] || PayloadUtils.createSymbol('Literal', { value: 0 });
    },
    'IN-07': (node) => {
        // Standardized name is 'Array' across the engine.
        return PayloadUtils.createSymbol('Identifier', { name: 'Array' });
    },
    'IN-03': (node) => {
        const val = node.value || { value: '#ffffff' };
        const raw = PayloadUtils.unwrap(val) as any;
        const hex = raw?.hex || String(raw);
        return PayloadUtils.createSymbol('Literal', { value: hex.replace('#', '') });
    },
    'TR-01': (node, inputs) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const inputSymbol = inputs['in_a'] || inputs['in'] || PayloadUtils.createSymbol('Literal', { value: 0 });
        const targetUnit = data.unit as string;
        return { ...inputSymbol, unit: targetUnit };
    },
    'IN-02': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        const rawVal = data.value ?? data.val;
        const unwrapped = rawVal !== undefined ? PayloadUtils.unwrap(rawVal) : PayloadUtils.unwrap(node.value);
        const value = (unwrapped !== undefined && unwrapped !== null) ? unwrapped : 0;
        return PayloadUtils.createSymbol('Literal', { value: value as string | number | boolean | undefined });
    },
    'IN-10': (node) => {
        const data = (node.data || {}) as Record<string, unknown>;
        return PayloadUtils.createSymbol('FunctionCall', {
            name: 'random',
            args: [
                PayloadUtils.createSymbol('Literal', { value: Number(data.min ?? 0) }),
                PayloadUtils.createSymbol('Literal', { value: Number(data.max ?? 1) })
            ]
        });
    },
    'IN-08': (node: NodeLogic, inputs: Record<string, any>, brain?: Brain) => {
        let total = 0;
        const accumulateValue = (currentNodeId: string): void => {
            // If brain is not provided (standalone test/utility), we fall back to singleton if exists
            const activeBrain = brain || (Brain as any).getInstance();
            const brainNodeMap = activeBrain.getNodesMap();
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


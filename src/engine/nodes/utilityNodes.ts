import { DataType } from '../../types/payload';
import { PayloadUtils } from '../../utils/PayloadUtils';
import { NodeRegistry } from '../NodeRegistry';

export function registerUtilityNodes() {
    // UI-01: Text Annotation (No-op)
    NodeRegistry.register('UI-01', (node, inputs) => {
        return { type: DataType.Object, value: {}, symbol: null, meta: {} };
    });

    // UI-03: Reroute (Identity)
    NodeRegistry.register('UI-03', (node, inputs) => {
        return inputs['in'] ? PayloadUtils.clone(inputs['in']) : PayloadUtils.createScalar(0);
    }, (node, inputs) => {
        return inputs['in'] || null;
    });

    // UI-99: Debug Node
    NodeRegistry.register('UI-99', (node, inputs) => {
        return inputs['in'] || PayloadUtils.createScalar(0);
    }, (node, inputs) => {
        return inputs['in'] || null;
    });

    // SY-05: Expert Node (Handled in Advanced as it uses Nerdamer, but could be here too)

    // UI-02: Frame (No-op structural node)
    NodeRegistry.register('frame', (node) => {
        return node.value || { type: DataType.Object, value: {}, symbol: null, meta: {} };
    });

    // baseNode: Fallback structural node
    NodeRegistry.register('baseNode', (node) => {
        return node.value || { type: DataType.Object, value: {}, symbol: null, meta: {} };
    });
}

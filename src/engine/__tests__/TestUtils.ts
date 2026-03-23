import { NodeLogic } from '../types';
import { Edge } from '@xyflow/react';
import { NodePayload } from '../../types/payload';

/**
 * Creates a mock node for testing purposes.
 */
export function createMockNode(id: string, type: string, data: any = {}, value: any = undefined): NodeLogic {
    return {
        id,
        type,
        data: { ...data },
        value: value as NodePayload,
        position: { x: 0, y: 0 },
        selected: false,
        isInDirtyChain: false
    };
}

/**
 * Creates a mock edge for testing purposes.
 */
export function createMockEdge(id: string, source: string, target: string, sourceHandle: string = 'out', targetHandle: string = 'in'): Edge {
    return {
        id,
        source,
        target,
        sourceHandle,
        targetHandle
    };
}

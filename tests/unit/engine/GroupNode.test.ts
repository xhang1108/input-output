import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { Brain } from '@/engine/Brain';
import { DataType } from '@/types/payload';
import { PayloadUtils } from '@/utils/PayloadUtils';
import type { GroupNodeData, SubGraph } from '@/types/groupNode';
import type { NodeLogic } from '@/engine/types/engineTypes';
import { hydrateGroupPorts } from '@/utils/groupPorts';
import { interpretGroup, GroupCycleError, GroupNestedError } from '@/engine/group/interpretGroup';

beforeAll(() => {
    NodeRegistry.initializeNodes();
});

function groupNodeOf(data: GroupNodeData, id = 'g1'): NodeLogic {
    return {
        id,
        type: 'group',
        position: { x: 0, y: 0 },
        selected: false,
        isInDirtyChain: false,
        data: data as unknown as Record<string, unknown>,
    } as unknown as NodeLogic;
}

// Mixed-type subGraph: IN-01 consts + MA-01 ADD (boundary-fed) + MA-02 POW +
// LG-01 AND. bias port carries a D10 defaultValue when the outer edge is absent.
function mixedData(biasDefault = 100): GroupNodeData {
    return {
        label: 'Mixed',
        subGraph: {
            nodes: [
                { id: 'n1', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 2 } },
                { id: 'm1', type: 'MA-01', position: { x: 200, y: 0 }, data: { mode: 'ADD' } },
                { id: 'p1', type: 'MA-02', position: { x: 400, y: 0 }, data: { mode: 'POW' } },
                { id: 'c1', type: 'IN-01', position: { x: 0, y: 200 }, data: { value: 1 } },
                { id: 'c2', type: 'IN-01', position: { x: 0, y: 300 }, data: { value: 1 } },
                { id: 'and1', type: 'LG-01', position: { x: 200, y: 250 }, data: { mode: 'AND' } },
            ],
            edges: [
                { id: 'e1', source: 'n1', sourceHandle: 'out_a', target: 'm1', targetHandle: 'in_a' },
                { id: 'e2', source: 'm1', sourceHandle: 'out_a', target: 'p1', targetHandle: 'in_a' },
                { id: 'e3', source: 'n1', sourceHandle: 'out_a', target: 'p1', targetHandle: 'in_b' },
                { id: 'e4', source: 'c1', sourceHandle: 'out_a', target: 'and1', targetHandle: 'in_a' },
                { id: 'e5', source: 'c2', sourceHandle: 'out_a', target: 'and1', targetHandle: 'in_b' },
            ],
        },
        boundary: {
            inputs: [
                { portId: 'in_bias', innerNodeId: 'm1', innerHandle: 'in_b', dataType: 'scalar', label: 'Bias', defaultValue: biasDefault },
            ],
            outputs: [
                { portId: 'out_pow', innerNodeId: 'p1', innerHandle: 'out_a', dataType: 'scalar', label: 'Pow' },
                { portId: 'out_and', innerNodeId: 'and1', innerHandle: 'out_a', dataType: 'boolean', label: 'And' },
            ],
        },
    };
}

describe('Group P1 reference (interpretGroup)', () => {
    it('evaluates a mixed-type subGraph with boundary default (2+100)^2=10404, AND(1,1)=true', async () => {
        const result = await interpretGroup(groupNodeOf(mixedData()), {});
        expect(result.type).toBe(DataType.Object);
        const value = result.value as Record<string, any>;
        expect(PayloadUtils.unwrap(value['out_pow'])).toBeCloseTo(10404);
        expect(PayloadUtils.unwrap(value['out_and'])).toBe(true);
    });

    it('outer input overrides the boundary defaultValue (2+10)^2=144', async () => {
        const result = await interpretGroup(groupNodeOf(mixedData()), {
            in_bias: PayloadUtils.createScalar(10),
        });
        const value = result.value as Record<string, any>;
        expect(PayloadUtils.unwrap(value['out_pow'])).toBeCloseTo(144);
    });

    it('stateful nodes are single-shot and frozen: Timer snapshot 42, Random in range', async () => {
        const subGraph: SubGraph = {
            nodes: [
                { id: 't', type: 'IN-11', position: { x: 0, y: 0 }, data: { currentValue: 42 } },
                { id: 'r', type: 'IN-10', position: { x: 0, y: 100 }, data: { mode: 'Uniform', min: 0, max: 1 } },
            ],
            edges: [],
        };
        const data: GroupNodeData = {
            label: 'Stateful',
            subGraph,
            boundary: {
                inputs: [],
                outputs: [
                    { portId: 'out_t', innerNodeId: 't', innerHandle: 'out_a', dataType: 'scalar' },
                    { portId: 'out_r', innerNodeId: 'r', innerHandle: 'out_a', dataType: 'array' },
                ],
            },
        };
        const result = await interpretGroup(groupNodeOf(data), {});
        const value = result.value as Record<string, any>;
        expect(PayloadUtils.unwrap(value['out_t'])).toBe(42);
        const roll = PayloadUtils.unwrap(value['out_r']);
        expect(Array.isArray(roll)).toBe(true);
        expect((roll as number[]).length).toBe(1);
        expect((roll as number[])[0]).toBeGreaterThanOrEqual(0);
        expect((roll as number[])[0]).toBeLessThan(1);
    });
});

describe('Group D2 nesting rejection', () => {
    it.each([
        ['frame', 'inner-frame'],
        ['group', 'inner-group'],
    ])('rejects inner %s node (%s)', async (type, id) => {
        const data = mixedData();
        data.subGraph.nodes.push({ id, type, position: { x: 0, y: 0 }, data: {} });
        await expect(interpretGroup(groupNodeOf(data), {})).rejects.toThrow(GroupNestedError);
    });

    it('propagates loudly through the registered group evaluator (Brain.computeNode converts throws to Error payloads)', async () => {
        const data = mixedData();
        data.subGraph.nodes.push({ id: 'inner-frame', type: 'frame', position: { x: 0, y: 0 }, data: {} });
        await expect(NodeRegistry.evaluate(groupNodeOf(data), {})).rejects.toThrow(GroupNestedError);
    });
});

describe('Group cycle detection', () => {
    it('rejects a cyclic subGraph', async () => {
        const data: GroupNodeData = {
            label: 'Cyclic',
            subGraph: {
                nodes: [
                    { id: 'a', type: 'MA-01', position: { x: 0, y: 0 }, data: { mode: 'ADD' } },
                    { id: 'b', type: 'MA-01', position: { x: 200, y: 0 }, data: { mode: 'ADD' } },
                ],
                edges: [
                    { id: 'e1', source: 'a', sourceHandle: 'out_a', target: 'b', targetHandle: 'in_a' },
                    { id: 'e2', source: 'b', sourceHandle: 'out_a', target: 'a', targetHandle: 'in_a' },
                ],
            },
            boundary: {
                inputs: [],
                outputs: [{ portId: 'out', innerNodeId: 'a', innerHandle: 'out_a', dataType: 'scalar' }],
            },
        };
        await expect(interpretGroup(groupNodeOf(data), {})).rejects.toThrow(GroupCycleError);
    });
});

describe('hydrateGroupPorts boundary 1:1', () => {
    it('derives one handle per boundary port with matching id/type/dataType', () => {
        const handles = hydrateGroupPorts({
            inputs: [{ portId: 'in_bias', innerNodeId: 'm1', innerHandle: 'in_b', dataType: 'scalar', label: 'Bias' }],
            outputs: [{ portId: 'out_pow', innerNodeId: 'p1', innerHandle: 'out_a', dataType: 'unit', label: 'Pow' }],
        });
        expect(handles).toEqual([
            { id: 'in_bias', type: 'target', variant: 'single', dataType: 'scalar', label: 'Bias' },
            { id: 'out_pow', type: 'source', variant: 'single', dataType: 'unit', label: 'Pow' },
        ]);
    });
});

describe('Group reload + end-to-end Brain evaluation', () => {
    let brain: Brain;

    beforeEach(async () => {
        brain = Brain.getInstance();
        await brain.injectNodes({ nodes: [], edges: [] }, true);
    });

    afterEach(() => {
        brain.dispose();
    });

    it('rebuilds data.handles from boundary on injectNodes (reload path)', async () => {
        // Inner const 3 + boundary-fed ADD; outer Number 5 → 3+5=8.
        const data: GroupNodeData = {
            label: 'Adder',
            subGraph: {
                nodes: [
                    { id: 'c', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 3 } },
                    { id: 'add', type: 'MA-01', position: { x: 200, y: 0 }, data: { mode: 'ADD' } },
                ],
                edges: [{ id: 'e1', source: 'c', sourceHandle: 'out_a', target: 'add', targetHandle: 'in_a' }],
            },
            boundary: {
                inputs: [{ portId: 'in_main', innerNodeId: 'add', innerHandle: 'in_b', dataType: 'scalar' }],
                outputs: [{ portId: 'out_sum', innerNodeId: 'add', innerHandle: 'out_a', dataType: 'scalar' }],
            },
        };
        await brain.injectNodes(
            {
                nodes: [
                    { id: 'ext', type: 'IN-01', position: { x: -200, y: 0 }, data: { value: 5 } },
                    { id: 'g1', type: 'group', position: { x: 200, y: 0 }, data: data as unknown as Record<string, unknown> },
                ],
                edges: [{ id: 'e1', source: 'ext', sourceHandle: 'out_a', target: 'g1', targetHandle: 'in_main' }],
            },
            true
        );

        // Handles rebuilt 1:1 from boundary even though nothing was persisted.
        const stored = brain.getNode('g1')!;
        const handles = (stored.data as any).handles;
        expect(handles.map((h: any) => h.id).sort()).toEqual(['in_main', 'out_sum']);
        expect(handles.find((h: any) => h.id === 'in_main').type).toBe('target');
        expect(handles.find((h: any) => h.id === 'out_sum').type).toBe('source');

        // End-to-end: group evaluates as one node through the main graph.
        const sum = await brain.getValue('g1', 'out_sum');
        expect(PayloadUtils.unwrap(sum)).toBeCloseTo(8);
    });

    it('D2 violation surfaces as an Error payload at Brain level (computeNode catch)', async () => {
        const data: GroupNodeData = {
            label: 'Nested',
            subGraph: {
                nodes: [
                    { id: 'c', type: 'IN-01', position: { x: 0, y: 0 }, data: { value: 3 } },
                    { id: 'inner-frame', type: 'frame', position: { x: 0, y: 0 }, data: {} },
                ],
                edges: [],
            },
            boundary: {
                inputs: [],
                outputs: [{ portId: 'out', innerNodeId: 'c', innerHandle: 'out_a', dataType: 'scalar' }],
            },
        };
        await brain.injectNodes(
            {
                nodes: [{ id: 'g2', type: 'group', position: { x: 0, y: 0 }, data: data as unknown as Record<string, unknown> }],
                edges: [],
            },
            true
        );
        const result = await brain.getValue('g2', 'out');
        expect(result.type).toBe(DataType.Error);
    });
});

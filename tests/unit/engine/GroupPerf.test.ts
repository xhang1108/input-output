/** Group hot-path perf tests (GROUP_NODE_PLAN P4 follow-up).
 *
 * Each optimization carries a DETERMINISTIC assertion (cache-hit counter,
 * symbol absence) plus a timing log. Timings are indicative only — the
 * counters are the gates. Loose absolute bounds (<15ms) catch pathological
 * regressions without flaking.
 */
import { describe, it, expect } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { initializeNodes } from '@/engine/nodes/nodeIndex';
import { interpretGroup } from '@/engine/group/interpretGroup';
import { __testStats, clearPlanCacheStats } from '@/engine/group/planCache';
import { PayloadUtils } from '@/utils/PayloadUtils';
import type { NodeLogic } from '@/engine/types/engineTypes';
import type { GroupNodeData } from '@/types/groupNode';

initializeNodes();

const N = 200;

function buildChainGroup() {
    const nodes: any[] = [];
    const edges: any[] = [];
    for (let i = 0; i < N; i++) {
        nodes.push({ id: `m${i}`, type: 'MA-01', position: { x: 0, y: 0 }, data: { mode: 'ADD' } });
        if (i > 0) {
            edges.push({ id: `e${i}a`, source: `m${i - 1}`, sourceHandle: 'out_a', target: `m${i}`, targetHandle: 'in_a' });
            edges.push({ id: `e${i}b`, source: `m${i - 1}`, sourceHandle: 'out_a', target: `m${i}`, targetHandle: 'in_b' });
        }
    }
    const boundary: GroupNodeData['boundary'] = {
        inputs: [
            { portId: 'p0', innerNodeId: 'm0', innerHandle: 'in_a', dataType: 'scalar' },
            { portId: 'p1', innerNodeId: 'm0', innerHandle: 'in_b', dataType: 'scalar' },
        ],
        outputs: [{ portId: 'o', innerNodeId: `m${N - 1}`, innerHandle: 'out_a', dataType: 'scalar' }],
    };
    const node = {
        id: 'g', type: 'group', position: { x: 0, y: 0 }, selected: false, isInDirtyChain: false,
        data: { label: 'perf', subGraph: { nodes, edges }, boundary },
    } as unknown as NodeLogic;
    const outer = { p0: PayloadUtils.createScalar(1), p1: PayloadUtils.createScalar(1) } as any;
    return { node, outer };
}

async function median(fn: () => Promise<unknown>, reps = 15): Promise<number> {
    const ts: number[] = [];
    for (let i = 0; i < reps; i++) {
        const t = performance.now();
        await fn();
        ts.push(performance.now() - t);
    }
    ts.sort((a, b) => a - b);
    return ts[Math.floor(ts.length / 2)];
}

describe('Group hot-path perf', () => {
    it('plan cache: one build across repeated interpreter runs', async () => {
        const { node, outer } = buildChainGroup();
        clearPlanCacheStats();
        await interpretGroup(node, outer); // warmup
        const med = await median(() => interpretGroup(node, outer));
        console.log(`[perf] interpreter median=${med.toFixed(3)}ms planBuilds=${__testStats.planBuilds}`);
        expect(__testStats.planBuilds).toBe(1);
        expect(med).toBeLessThan(15);
    });

    it('skipSymbol: inner evaluation keeps value, drops symbol', async () => {
        const inner = {
            id: 'm', type: 'MA-01', position: { x: 0, y: 0 }, selected: false, isInDirtyChain: false,
            data: { mode: 'ADD' },
        } as unknown as NodeLogic;
        const inputs = { in_a: PayloadUtils.createScalar(2), in_b: PayloadUtils.createScalar(3) } as any;
        const full = await NodeRegistry.evaluate(inner, inputs);
        const lite = await NodeRegistry.evaluate(inner, inputs, { skipSymbol: true });
        expect(PayloadUtils.unwrap(lite)).toBe(PayloadUtils.unwrap(full));
        expect(full.symbol).not.toBeNull();
        expect(lite.symbol).toBeNull();
    });

    it('compiled path: warm cache hit, correct value', async () => {
        const { node, outer } = buildChainGroup();
        clearPlanCacheStats();
        const first = await NodeRegistry.evaluate(node, outer); // warmup incl. compile
        expect((node as any)._groupOptimized).toBe(true);
        const med = await median(async () => { await NodeRegistry.evaluate(node, outer); });
        console.log(`[perf] compiled median=${med.toFixed(3)}ms planBuilds=${__testStats.planBuilds}`);
        expect(__testStats.planBuilds).toBe(1);
        expect(med).toBeLessThan(15);
        expect((first as any)?.value?.o?.value).toBeDefined();
    });
});

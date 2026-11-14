/** Group D4 pure-scalar fast path (GROUP_NODE_PLAN §5.3 follow-up, §8.4).
 *
 * Gates:
 * - MA-01..MA-05: 100 random inputs each, triple equivalence
 *   (fast vs full vs interpreter) with the shared expectEquivalent
 *   (type/value/unit/handleMeta). Any mismatch kicks the type out of
 *   PURE_SCALAR_TYPES instead of weakening the test.
 * - DIV0 / SQRT(-1) / even-root-of-negative / overflow trigger the
 *   fast->full fallback and match the full path (Error semantics preserved).
 * - 200-chain: pureScalar===true, fast median logged, loose bound <15ms.
 * - Kick-out list documents every rejected shape.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { DataType, type NodePayload } from '@/types/payload';
import { PayloadUtils } from '@/utils/PayloadUtils';
import { InputOutputEngine } from '@/engine/InputOutputEngine';
import type { GroupNodeData } from '@/types/groupNode';
import type { NodeLogic } from '@/engine/types/engineTypes';
import { interpretGroup } from '@/engine/group/interpretGroup';
import {
    ALLOWLIST_VERSION,
    PURE_SCALAR_TYPES,
    buildScopeParams,
    compileGroup,
    isPureScalarGroup,
    payloadsObject,
} from '@/engine/group/compileGroup';
import { GroupCodeCache } from '@/engine/group/groupCodeCache';

beforeAll(() => {
    NodeRegistry.initializeNodes();
});

// Deterministic PRNG per type so failures reproduce.
function rng(seed: number) {
    let t = seed >>> 0;
    return () => {
        t += 0x6d2b79f5;
        let z = t;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
}

const pick = <T,>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)];

function gnode(
    label: string,
    nodes: { id: string; type: string; data?: Record<string, unknown> }[],
    edges: { id: string; source: string; sourceHandle: string; target: string; targetHandle: string }[],
    inputs: GroupNodeData['boundary']['inputs'],
    outputs: GroupNodeData['boundary']['outputs'],
): NodeLogic {
    return {
        id: 'g-test',
        type: 'group',
        position: { x: 0, y: 0 },
        selected: false,
        isInDirtyChain: false,
        data: {
            label,
            subGraph: {
                nodes: nodes.map((n) => ({ ...n, position: { x: 0, y: 0 }, data: n.data ?? {} })),
                edges,
            },
            boundary: { inputs, outputs },
        } as unknown as Record<string, unknown>,
    } as unknown as NodeLogic;
}

function scalar(v: number, unit?: string): NodePayload {
    return PayloadUtils.createScalar(v, unit);
}

function norm(v: unknown): unknown {
    if (v === null || v === undefined) return v;
    if (typeof v === 'object') {
        const o = v as Record<string, unknown>;
        if ('mathjs' in o) {
            if (o.mathjs === 'BigNumber') return Number(o.value);
            if (o.mathjs === 'Fraction') return Number(o.n) / Number(o.d);
            if (o.mathjs === 'Complex') return { re: Number(o.re), im: Number(o.im) };
            if (o.mathjs === 'Matrix') return (o.data as unknown[]).map(norm);
        }
        if (Array.isArray(v)) return (v as unknown[]).map(norm);
        return v;
    }
    return v;
}

function close(a: unknown, b: unknown): boolean {
    const x = norm(a);
    const y = norm(b);
    if (typeof x === 'number' && typeof y === 'number') {
        if (Number.isNaN(x) && Number.isNaN(y)) return true;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return x === y;
        const d = Math.abs(x - y);
        return d <= 1e-8 || d <= 1e-8 * Math.max(Math.abs(x), Math.abs(y));
    }
    if (Array.isArray(x) && Array.isArray(y)) {
        return x.length === y.length && x.every((v, i) => close(v, (y as unknown[])[i]));
    }
    if (x && y && typeof x === 'object' && typeof y === 'object') {
        const kx = Object.keys(x as object).sort();
        const ky = Object.keys(y as object).sort();
        if (kx.join(',') !== ky.join(',')) return false;
        return kx.every((k) =>
            close((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k]),
        );
    }
    return x === y;
}

/** Compiled-vs-interpreter equivalence on the final group payload. */
function expectEquivalent(a: NodePayload, b: NodePayload): void {
    expect(b.type).toBe(a.type);
    if (a.type === DataType.Error) {
        expect((b.meta as { error?: string }).error).toBe((a.meta as { error?: string }).error);
        return;
    }
    const va = a.value as Record<string, unknown>;
    const vb = b.value as Record<string, unknown>;
    expect(Object.keys(vb).sort()).toEqual(Object.keys(va).sort());
    for (const k of Object.keys(va)) {
        const pa = va[k] as NodePayload;
        const pb = vb[k] as NodePayload;
        expect(pb.type, `port ${k} type`).toBe(pa.type);
        expect(close(pb.value, pa.value), `port ${k} value ${JSON.stringify(norm(pb.value))} vs ${JSON.stringify(norm(pa.value))}`).toBe(true);
        expect((pb.meta as { unit?: string }).unit, `port ${k} unit`).toBe(
            (pa.meta as { unit?: string }).unit,
        );
    }
    const ha = ((a.meta as { handleMeta?: Record<string, { unit?: string }> }).handleMeta ?? {});
    const hb = ((b.meta as { handleMeta?: Record<string, { unit?: string }> }).handleMeta ?? {});
    for (const k of Object.keys(ha)) {
        expect(hb[k]?.unit, `port ${k} handleMeta.unit`).toBe(ha[k]?.unit);
    }
}

const IN = (portId: string, innerNodeId: string, innerHandle: string, extra = {}) => ({
    portId,
    innerNodeId,
    innerHandle,
    dataType: 'scalar' as const,
    ...extra,
});
const OUT = (portId: string, innerNodeId: string, innerHandle: string, extra = {}) => ({
    portId,
    innerNodeId,
    innerHandle,
    dataType: 'scalar' as const,
    ...extra,
});

const mathOf = () => InputOutputEngine.getInstance().getMathInstance();

async function triple(node: NodeLogic, outer: Record<string, NodePayload>): Promise<'fast' | 'fallback'> {
    const data = node.data as unknown as GroupNodeData;
    const interp = await interpretGroup(node, outer);
    const compiled = compileGroup(data.subGraph, data.boundary, 64);
    expect(compiled.pureScalar).toBe(true);
    expect(compiled.fastFn).toBeDefined();
    const params = buildScopeParams(data.subGraph, data.boundary);
    const fullOut = payloadsObject(compiled.fn(outer, params, mathOf()), data.boundary);
    expectEquivalent(interp, fullOut);
    let fastRaw: Record<string, NodePayload> | null = null;
    let threw = false;
    try {
        fastRaw = compiled.fastFn!(outer, params, mathOf());
    } catch {
        threw = true;
    }
    if (!threw && fastRaw) {
        const fastOut = payloadsObject(fastRaw, data.boundary);
        expectEquivalent(interp, fastOut);
        expectEquivalent(fullOut, fastOut);
        return 'fast';
    }
    // Fallback: fast declined (null/throw); full must still equal interpreter.
    return 'fallback';
}

describe('Group D4 pure-scalar triple equivalence (100 inputs per type)', () => {
    it('MA-01 Basic Math', async () => {
        const r = rng(1101);
        const modes = ['ADD', 'SUB', 'MUL', 'DIV', 'POW', 'SQRT', 'ABS', 'NEG', 'SIGN', 'CBRT', 'FACT'];
        let fast = 0;
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, modes);
            const node = gnode(
                'ma1', [{ id: 'm', type: 'MA-01', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            let a = (r() - 0.5) * 10;
            let b = (r() - 0.5) * 10;
            if (mode === 'DIV' && b === 0) b = 1;
            if (mode === 'POW' && a < 0) a = Math.abs(a);
            if (mode === 'SQRT' && a < 0) a = Math.abs(a);
            if ((await triple(node, { a: scalar(a), b: scalar(b) })) === 'fast') fast++;
        }
        console.log(`[pure-scalar] MA-01 fast=${fast}/100`);
    });

    it('MA-02 Advanced Math', async () => {
        const r = rng(1102);
        const modes = ['POW', 'SQRT', 'ABS', 'NEG', 'SIGN'];
        let fast = 0;
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, modes);
            const node = gnode(
                'ma2', [{ id: 'm', type: 'MA-02', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            let a = (r() - 0.5) * 8;
            if ((mode === 'POW' || mode === 'SQRT') && a < 0) a = Math.abs(a);
            if (await triple(node, { a: scalar(a), b: scalar((r() - 0.5) * 4) }) === 'fast') fast++;
        }
        console.log(`[pure-scalar] MA-02 fast=${fast}/100`);
    });

    it('MA-03 Logarithm', async () => {
        const r = rng(1103);
        let fast = 0;
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, ['LN', 'LOG10', 'LOGN']);
            const node = gnode(
                'ma3', [{ id: 'm', type: 'MA-03', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            if (await triple(node, {
                a: scalar(0.1 + r() * 20),
                b: scalar(2 + Math.floor(r() * 9)),
            }) === 'fast') fast++;
        }
        console.log(`[pure-scalar] MA-03 fast=${fast}/100`);
    });

    it('MA-04 Trigonometry', async () => {
        const r = rng(1104);
        const modes = ['SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ATAN2', 'SINH', 'COSH'];
        let fast = 0;
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, modes);
            const angleMode = pick(r, ['RAD', 'DEG']);
            const node = gnode(
                'ma4', [{ id: 'm', type: 'MA-04', data: { mode, angleMode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            const trig = angleMode === 'DEG' ? (r() - 0.5) * 360 : (r() - 0.5) * 6.28;
            const v = ['ASIN', 'ACOS'].includes(mode) ? (r() - 0.5) * 1.8 : trig;
            if (await triple(node, { a: scalar(v), b: scalar((r() - 0.5) * 4) }) === 'fast') fast++;
        }
        console.log(`[pure-scalar] MA-04 fast=${fast}/100`);
    });

    it('MA-05 Round', async () => {
        const r = rng(1105);
        let fast = 0;
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, ['ROUND', 'FLOOR', 'CEIL', 'TRUNC']);
            const precision = Math.floor(r() * 4);
            const node = gnode(
                'ma5', [{ id: 'm', type: 'MA-05', data: { mode, precision } }],
                [],
                [IN('a', 'm', 'in_a')],
                [OUT('o', 'm', 'out_a')],
            );
            if (await triple(node, { a: scalar((r() - 0.5) * 200) }) === 'fast') fast++;
        }
        console.log(`[pure-scalar] MA-05 fast=${fast}/100`);
    });

    it('multi-node pure chain with constants', async () => {
        const r = rng(1199);
        let fast = 0;
        for (let i = 0; i < 100; i++) {
            const node = gnode(
                'chain',
                [
                    { id: 'c', type: 'IN-01', data: { value: 2 } },
                    { id: 'k', type: 'IN-06', data: { val: 'pi', precision: 5 } },
                    { id: 'm1', type: 'MA-01', data: { mode: 'ADD' } },
                    { id: 'm2', type: 'MA-01', data: { mode: 'MUL' } },
                    { id: 'm3', type: 'MA-04', data: { mode: 'SIN', angleMode: 'RAD' } },
                    { id: 'm4', type: 'MA-05', data: { mode: 'ROUND', precision: 3 } },
                    { id: 'm5', type: 'MA-01', data: { mode: 'ABS' } },
                    { id: 'm6', type: 'MA-03', data: { mode: 'LN' } },
                ],
                [
                    { id: 'e1', source: 'c', sourceHandle: 'out_a', target: 'm1', targetHandle: 'in_a' },
                    { id: 'e2', source: 'm1', sourceHandle: 'out_a', target: 'm2', targetHandle: 'in_a' },
                    { id: 'e3', source: 'k', sourceHandle: 'out_a', target: 'm2', targetHandle: 'in_b' },
                    { id: 'e4', source: 'm2', sourceHandle: 'out_a', target: 'm3', targetHandle: 'in_a' },
                    { id: 'e5', source: 'm3', sourceHandle: 'out_a', target: 'm4', targetHandle: 'in_a' },
                    { id: 'e6', source: 'm4', sourceHandle: 'out_a', target: 'm5', targetHandle: 'in_a' },
                    { id: 'e7', source: 'm5', sourceHandle: 'out_a', target: 'm6', targetHandle: 'in_a' },
                ],
                [{ ...IN('bias', 'm1', 'in_b'), defaultValue: 100 }],
                [OUT('o', 'm6', 'out_a')],
            );
            const outer: Record<string, NodePayload> = {};
            if (r() < 0.5) outer.bias = scalar(1 + r() * 5);
            // ABS keeps the LN input non-negative; LN(0)=-Infinity still
            // exercises the fallback branch with full-path equality.
            if (await triple(node, outer) === 'fast') fast++;
        }
        console.log(`[pure-scalar] chain fast=${fast}/100`);
    });
});

describe('Group D4 fallback preserves full-path semantics', () => {
    async function viaEvaluator(node: NodeLogic, outer: Record<string, NodePayload>) {
        return (await NodeRegistry.evaluate(node, outer)) as NodePayload;
    }

    function fullOf(node: NodeLogic, outer: Record<string, NodePayload>): NodePayload {
        const data = node.data as unknown as GroupNodeData;
        const compiled = compileGroup(data.subGraph, data.boundary, 64);
        return payloadsObject(
            compiled.fn(outer, buildScopeParams(data.subGraph, data.boundary), mathOf()),
            data.boundary,
        );
    }

    function fastRawOf(node: NodeLogic, outer: Record<string, NodePayload>): Record<string, NodePayload> | null | 'threw' {
        const data = node.data as unknown as GroupNodeData;
        const compiled = compileGroup(data.subGraph, data.boundary, 64);
        expect(compiled.pureScalar).toBe(true);
        try {
            return compiled.fastFn!(outer, buildScopeParams(data.subGraph, data.boundary), mathOf());
        } catch {
            return 'threw';
        }
    }

    it('DIV0 falls back and matches the full path', async () => {
        const node = gnode(
            'div0', [{ id: 'm', type: 'MA-01', data: { mode: 'DIV' } }],
            [],
            [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
            [OUT('o', 'm', 'out_a')],
        );
        const outer = { a: scalar(1), b: scalar(0) };
        expect(fastRawOf(node, outer)).toBeNull();
        const evaluated = await viaEvaluator(node, outer);
        expect((node as unknown as Record<string, unknown>)._groupOptimized).toBe(true);
        expectEquivalent(fullOf(node, outer), evaluated);
        expectEquivalent(await interpretGroup(node, outer), evaluated);
    });

    it('SQRT(-1) falls back and matches the full path', async () => {
        const node = gnode(
            'sqrtneg', [{ id: 'm', type: 'MA-01', data: { mode: 'SQRT' } }],
            [],
            [IN('a', 'm', 'in_a')],
            [OUT('o', 'm', 'out_a')],
        );
        const outer = { a: scalar(-1) };
        expect(fastRawOf(node, outer)).toBeNull();
        const evaluated = await viaEvaluator(node, outer);
        expectEquivalent(fullOf(node, outer), evaluated);
        expectEquivalent(await interpretGroup(node, outer), evaluated);
    });

    it('even root of negative throws in fast and preserves the Error payload', async () => {
        const node = gnode(
            'nthneg', [{ id: 'm', type: 'MA-01', data: { mode: 'SQRT' } }],
            [],
            [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
            [OUT('o', 'm', 'out_a')],
        );
        const outer = { a: scalar(-4), b: scalar(2) };
        expect(fastRawOf(node, outer)).toBe('threw');
        const evaluated = await viaEvaluator(node, outer);
        // Group results are object payloads keyed by port; the Error lives
        // on the port (full-path semantics preserved through the fallback).
        expect((evaluated.value as Record<string, NodePayload>).o.type).toBe(DataType.Error);
        expectEquivalent(fullOf(node, outer), evaluated);
    });

    it('overflow falls back and matches the full path', async () => {
        const node = gnode(
            'overflow', [{ id: 'm', type: 'MA-01', data: { mode: 'MUL' } }],
            [],
            [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
            [OUT('o', 'm', 'out_a')],
        );
        const outer = { a: scalar(1e308), b: scalar(10) };
        // Number math overflows to Infinity while BigNumber stays finite:
        // fast must decline so the full path decides.
        expect(fastRawOf(node, outer)).toBeNull();
        const evaluated = await viaEvaluator(node, outer);
        expectEquivalent(fullOf(node, outer), evaluated);
        expectEquivalent(await interpretGroup(node, outer), evaluated);
    });

    it('unit-carrying input bypasses fast but stays correct', async () => {
        const node = gnode(
            'unitin', [{ id: 'm', type: 'MA-01', data: { mode: 'ADD' } }],
            [],
            [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
            [OUT('o', 'm', 'out_a')],
        );
        const outer = { a: scalar(1.5, 'm'), b: scalar(2) };
        const evaluated = await viaEvaluator(node, outer);
        expectEquivalent(fullOf(node, outer), evaluated);
        expectEquivalent(await interpretGroup(node, outer), evaluated);
    });

    it('GroupCodeCache entry passes through pureScalar + fastFn', async () => {
        GroupCodeCache.clear();
        const node = gnode(
            'cache', [{ id: 'm', type: 'MA-01', data: { mode: 'ADD' } }],
            [],
            [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
            [OUT('o', 'm', 'out_a')],
        );
        await NodeRegistry.evaluate(node, { a: scalar(1), b: scalar(2) });
        const data = node.data as unknown as GroupNodeData;
        const { computeStructHash } = await import('@/engine/group/compileGroup');
        const key = GroupCodeCache.key(computeStructHash(data.subGraph, data.boundary), 64, ALLOWLIST_VERSION);
        const entry = GroupCodeCache.get(key);
        expect(entry).toBeDefined();
        expect(entry?.pureScalar).toBe(true);
        expect(entry?.fastFn).toBeDefined();
    });
});

describe('Group D4 kick-out list', () => {
    const single = (type: string, data: Record<string, unknown> = {}, extraPort = {}) =>
        gnode(
            'k', [{ id: 'm', type, data }],
            [],
            [IN('a', 'm', 'in_a')],
            [{ ...OUT('o', 'm', 'out_a'), ...extraPort }],
        );

    it('MA-01..MA-05 and unit-free constants are pure', () => {
        for (const t of PURE_SCALAR_TYPES) {
            const n = single(t, t === 'MA-04' ? { mode: 'SIN', angleMode: 'RAD' } : { mode: 'ADD' });
            expect(isPureScalarGroup(
                (n.data as unknown as GroupNodeData).subGraph,
                (n.data as unknown as GroupNodeData).boundary,
            ).ok, t).toBe(true);
        }
        for (const [type, data] of [['IN-01', { value: 3 }], ['IN-06', { val: 'pi' }]] as const) {
            const n = single(type, data as Record<string, unknown>);
            expect(isPureScalarGroup(
                (n.data as unknown as GroupNodeData).subGraph,
                (n.data as unknown as GroupNodeData).boundary,
            ).ok, type).toBe(true);
        }
    });

    it('non-scalar types are kicked out', () => {
        const kicked = ['MA-06', 'MA-07', 'MA-08', 'TR-01', 'TR-02', 'TR-06', 'LG-01', 'LG-02', 'LG-03', 'IN-10', 'IN-11'];
        for (const t of kicked) {
            const n = single(t, t === 'TR-01' ? { unit: 'm' } : {});
            const check = isPureScalarGroup(
                (n.data as unknown as GroupNodeData).subGraph,
                (n.data as unknown as GroupNodeData).boundary,
            );
            expect(check.ok, `${t}: ${check.reasons.join(';')}`).toBe(false);
        }
    });

    it('unit data, muted, fan-in, non-scalar boundary, nesting are kicked out', () => {
        const cases: Array<[string, NodeLogic]> = [
            ['in-01 with unit', single('IN-01', { value: 3, unit: 'm' })],
            ['in-01 string value', single('IN-01', { value: '3' })],
            ['muted', single('MA-01', { mode: 'ADD', muted: true })],
            ['non-scalar output', single('MA-01', { mode: 'ADD' }, { dataType: 'string' })],
            ['nested group', gnode(
                'n', [{ id: 'g', type: 'group', data: {} }],
                [],
                [IN('a', 'g', 'in_a')],
                [OUT('o', 'g', 'out_a')],
            )],
            ['fan-in', gnode(
                'f',
                [
                    { id: 'c1', type: 'IN-01', data: { value: 1 } },
                    { id: 'c2', type: 'IN-01', data: { value: 2 } },
                    { id: 'm', type: 'MA-01', data: { mode: 'ADD' } },
                ],
                [
                    { id: 'e1', source: 'c1', sourceHandle: 'out_a', target: 'm', targetHandle: 'in_a' },
                    { id: 'e2', source: 'c2', sourceHandle: 'out_a', target: 'm', targetHandle: 'in_a' },
                ],
                [],
                [OUT('o', 'm', 'out_a')],
            )],
        ];
        for (const [name, n] of cases) {
            const data = n.data as unknown as GroupNodeData;
            const check = isPureScalarGroup(data.subGraph, data.boundary);
            expect(check.ok, `${name}: ${check.reasons.join(';')}`).toBe(false);
        }
    });
});

describe('Group D4 200-chain perf', () => {
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

    it('fast path wins on the 200-chain, stays correct, stays under 15ms', async () => {
        GroupCodeCache.clear();
        const { node, outer } = buildChainGroup();
        const data = node.data as unknown as GroupNodeData;
        const compiled = compileGroup(data.subGraph, data.boundary, 64);
        expect(compiled.pureScalar).toBe(true);
        expect(compiled.fastFn).toBeDefined();

        const params = buildScopeParams(data.subGraph, data.boundary);
        const math = mathOf();
        const expected = await interpretGroup(node, outer);
        expectEquivalent(expected, payloadsObject(compiled.fn(outer, params, math), data.boundary));
        const fastRaw = compiled.fastFn!(outer, params, math);
        expect(fastRaw).not.toBeNull();
        expectEquivalent(expected, payloadsObject(fastRaw!, data.boundary));

        // Warmup (compile + cache), then measure each path.
        await NodeRegistry.evaluate(node, outer);
        expect((node as any)._groupOptimized).toBe(true);
        const fastMed = await median(async () => { compiled.fastFn!(outer, params, math); });
        const fullMed = await median(async () => { compiled.fn(outer, params, math); });
        const interpMed = await median(() => interpretGroup(node, outer));
        const evalMed = await median(async () => { await NodeRegistry.evaluate(node, outer); });
        console.log(`[pure-scalar] 200-chain median fast=${fastMed.toFixed(3)}ms full=${fullMed.toFixed(3)}ms interp=${interpMed.toFixed(3)}ms evaluate=${evalMed.toFixed(3)}ms pureScalar=${compiled.pureScalar}`);
        expect(fastMed).toBeLessThan(15);
        expect(evalMed).toBeLessThan(15);
    });
});

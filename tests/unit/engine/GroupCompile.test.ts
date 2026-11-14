import { describe, it, expect, beforeAll } from 'vitest';
import { NodeRegistry } from '@/engine/NodeRegistry';
import { DataType, type NodePayload } from '@/types/payload';
import { PayloadUtils } from '@/utils/PayloadUtils';
import type { GroupNodeData } from '@/types/groupNode';
import type { NodeLogic } from '@/engine/types/engineTypes';
import { interpretGroup } from '@/engine/group/interpretGroup';
import {
    ALLOWLIST_VERSION,
    GROUP_ALLOWLIST,
    buildScopeParams,
    canCompileGroup,
    compileGroup,
    computeStructHash,
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
    // meta allowlist: unit only is compared above; handleMeta units likewise.
    const ha = ((a.meta as { handleMeta?: Record<string, { unit?: string }> }).handleMeta ?? {});
    const hb = ((b.meta as { handleMeta?: Record<string, { unit?: string }> }).handleMeta ?? {});
    for (const k of Object.keys(ha)) {
        expect(hb[k]?.unit, `port ${k} handleMeta.unit`).toBe(ha[k]?.unit);
    }
}

async function checkPair(node: NodeLogic, outer: Record<string, NodePayload>): Promise<void> {
    const expected = await interpretGroup(node, outer);
    const actual = (await NodeRegistry.evaluate(node, outer)) as NodePayload;
    expect((node as unknown as Record<string, unknown>)._groupOptimized).toBe(true);
    expectEquivalent(expected, actual);
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

describe('Group P2 equivalence (100 random inputs per allowlist type)', () => {
    it('MA-01 Basic Math', async () => {
        const r = rng(101);
        const modes = ['ADD', 'SUB', 'MUL', 'DIV', 'POW', 'SQRT', 'ABS', 'NEG', 'SIGN', 'CBRT', 'FACT'];
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, modes);
            const node = gnode(
                'ma1', [{ id: 'm', type: 'MA-01', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            await checkPair(node, {
                a: scalar((r() - 0.5) * 10),
                b: scalar((r() - 0.5) * 10),
            });
        }
    });

    it('MA-02 Advanced Math', async () => {
        const r = rng(102);
        const modes = ['POW', 'SQRT', 'ABS', 'NEG', 'SIGN'];
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, modes);
            const node = gnode(
                'ma2', [{ id: 'm', type: 'MA-02', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            await checkPair(node, {
                a: scalar((r() - 0.5) * 8),
                b: scalar((r() - 0.5) * 4),
            });
        }
    });

    it('MA-03 Logarithm', async () => {
        const r = rng(103);
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, ['LN', 'LOG10', 'LOGN']);
            const node = gnode(
                'ma3', [{ id: 'm', type: 'MA-03', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            await checkPair(node, {
                a: scalar(0.1 + r() * 20),
                b: scalar(2 + Math.floor(r() * 9)),
            });
        }
    });

    it('MA-04 Trigonometry', async () => {
        const r = rng(104);
        const modes = ['SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN', 'ATAN2', 'SINH', 'COSH'];
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
            // Keep inverse-trig inputs inside [-1, 1] so trials exercise values, not just errors.
            const v = ['ASIN', 'ACOS'].includes(mode) ? (r() - 0.5) * 1.8 : trig;
            await checkPair(node, { a: scalar(v), b: scalar((r() - 0.5) * 4) });
        }
    });

    it('MA-05 Round', async () => {
        const r = rng(105);
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, ['ROUND', 'FLOOR', 'CEIL', 'TRUNC']);
            const precision = Math.floor(r() * 4);
            const node = gnode(
                'ma5', [{ id: 'm', type: 'MA-05', data: { mode, precision } }],
                [],
                [IN('a', 'm', 'in_a')],
                [OUT('o', 'm', 'out_a')],
            );
            await checkPair(node, { a: scalar((r() - 0.5) * 200) });
        }
    });

    it('MA-06 Fraction', async () => {
        const r = rng(106);
        for (let i = 0; i < 100; i++) {
            const mixed = r() < 0.5;
            const node = gnode(
                'ma6', [{ id: 'm', type: 'MA-06', data: { mixed } }],
                [],
                [IN('a', 'm', 'in_a')],
                [
                    OUT('i', 'm', 'out_a'),
                    OUT('n', 'm', 'out_b'),
                    OUT('d', 'm', 'out_c'),
                    { ...OUT('t', 'm', 'out_d'), dataType: 'string' as const },
                ],
            );
            const v = r() < 0.2 ? Math.floor((r() - 0.5) * 20) : (r() - 0.5) * 20;
            await checkPair(node, { a: scalar(v) });
        }
    });

    it('MA-07 Number Theory', async () => {
        const r = rng(107);
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, ['GCD', 'LCM', 'MOD', 'ISPRIME']);
            const node = gnode(
                'ma7', [{ id: 'm', type: 'MA-07', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            const ints = (n: number, lo: number, hi: number) =>
                PayloadUtils.createArray(
                    Array.from({ length: n }, () => lo + Math.floor(r() * (hi - lo + 1))),
                );
            if (mode === 'MOD') {
                await checkPair(node, {
                    a: scalar(Math.floor(r() * 50)),
                    b: scalar(Math.floor(r() * 12)),
                });
            } else if (mode === 'ISPRIME') {
                await checkPair(node, { a: ints(1 + Math.floor(r() * 5), 1, 40) });
            } else {
                await checkPair(node, {
                    a: ints(1 + Math.floor(r() * 3), 1, 60),
                    b: ints(1 + Math.floor(r() * 3), 1, 60),
                });
            }
        }
    });

    it('MA-08 Combinatorics', async () => {
        const r = rng(108);
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, ['nCr', 'nPr', 'FACTORIAL']);
            const node = gnode(
                'ma8', [{ id: 'm', type: 'MA-08', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [OUT('o', 'm', 'out_a')],
            );
            const n = Math.floor(r() * 11);
            const k = Math.floor(r() * (n + 1));
            await checkPair(node, { a: scalar(n), b: scalar(k) });
        }
    });

    it('TR-01 Unit', async () => {
        const r = rng(201);
        for (let i = 0; i < 100; i++) {
            const unit = pick(r, ['m', 'cm', 'km', 'REMOVE']);
            const node = gnode(
                'tr1', [{ id: 'm', type: 'TR-01', data: { unit } }],
                [],
                [IN('a', 'm', 'in_a')],
                [OUT('o', 'm', 'out_a')],
            );
            const withSource = r() < 0.6;
            await checkPair(node, {
                a: withSource ? scalar(0.5 + r() * 100, 'm') : scalar(0.5 + r() * 100),
            });
        }
    });

    it('TR-02 Base Converter', async () => {
        const r = rng(202);
        for (let i = 0; i < 100; i++) {
            const toBase = pick(r, [2, 8, 10, 16]);
            const node = gnode(
                'tr2', [{ id: 'm', type: 'TR-02', data: { toBase } }],
                [],
                [IN('a', 'm', 'in_a')],
                [{ ...OUT('o', 'm', 'out_a'), dataType: 'string' as const }],
            );
            const n = Math.floor(r() * 256);
            const outer =
                r() < 0.5
                    ? scalar(n)
                    : (() => {
                          const hex = n.toString(16).toUpperCase();
                          const p = PayloadUtils.createScalar(hex);
                          return { ...p, meta: { ...p.meta, unit: 'hex' } };
                      })();
            await checkPair(node, { a: outer });
        }
    });

    it('TR-06 Statistics', async () => {
        const r = rng(206);
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, ['Mean', 'Max', 'Min', 'StdDev', 'Median', 'Variance', 'Sum']);
            const node = gnode(
                'tr6', [{ id: 'm', type: 'TR-06', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a')],
                [OUT('o', 'm', 'out_a')],
            );
            const arr = PayloadUtils.createArray(
                Array.from({ length: 1 + Math.floor(r() * 7) }, () => (r() - 0.5) * 20),
            );
            await checkPair(node, { a: arr });
        }
    });

    it('LG-01 Logic Gate', async () => {
        const r = rng(301);
        const modes = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR', 'EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE'];
        for (let i = 0; i < 100; i++) {
            const mode = pick(r, modes);
            const node = gnode(
                'lg1', [{ id: 'm', type: 'LG-01', data: { mode } }],
                [],
                [IN('a', 'm', 'in_a'), IN('b', 'm', 'in_b')],
                [{ ...OUT('o', 'm', 'out_a'), dataType: 'boolean' as const }],
            );
            const bit = () => (r() < 0.5 ? 0 : 1);
            await checkPair(node, {
                a: r() < 0.5 ? PayloadUtils.createBoolean(r() < 0.5) : scalar(bit()),
                b: r() < 0.5 ? PayloadUtils.createBoolean(r() < 0.5) : scalar((r() - 0.5) * 6),
            });
        }
    });

    it('LG-02 Switch', async () => {
        const r = rng(302);
        for (let i = 0; i < 100; i++) {
            const node = gnode(
                'lg2', [{ id: 'm', type: 'LG-02', data: {} }],
                [],
                [IN('s', 'm', 'in_a'), IN('t', 'm', 'in_b'), IN('f', 'm', 'in_c')],
                [OUT('o', 'm', 'out_a')],
            );
            const outer: Record<string, NodePayload> = {
                s: PayloadUtils.createBoolean(r() < 0.5),
                t: scalar((r() - 0.5) * 10),
            };
            if (r() < 0.9) outer.f = scalar((r() - 0.5) * 10);
            await checkPair(node, outer);
        }
    });

    it('LG-03 Split', async () => {
        const r = rng(303);
        for (let i = 0; i < 100; i++) {
            const node = gnode(
                'lg3', [{ id: 'm', type: 'LG-03', data: {} }],
                [],
                [IN('s', 'm', 'in_a'), IN('d', 'm', 'in_b')],
                [OUT('t', 'm', 'out_a'), OUT('f', 'm', 'out_b')],
            );
            const outer: Record<string, NodePayload> = {
                s: PayloadUtils.createBoolean(r() < 0.5),
            };
            if (r() < 0.9) outer.d = scalar((r() - 0.5) * 10);
            await checkPair(node, outer);
        }
    });

    it('multi-node chain composes (MA-01 ADD -> MA-02 POW -> LG-01 AND)', async () => {
        const r = rng(999);
        for (let i = 0; i < 100; i++) {
            const node = gnode(
                'chain',
                [
                    { id: 'n1', type: 'IN-01', data: { value: 2 } },
                    { id: 'm1', type: 'MA-01', data: { mode: 'ADD' } },
                    { id: 'p1', type: 'MA-02', data: { mode: 'POW' } },
                    { id: 'c1', type: 'IN-01', data: { value: 1 } },
                    { id: 'c2', type: 'IN-01', data: { value: 1 } },
                    { id: 'and1', type: 'LG-01', data: { mode: 'AND' } },
                ],
                [
                    { id: 'e1', source: 'n1', sourceHandle: 'out_a', target: 'm1', targetHandle: 'in_a' },
                    { id: 'e2', source: 'm1', sourceHandle: 'out_a', target: 'p1', targetHandle: 'in_a' },
                    { id: 'e3', source: 'n1', sourceHandle: 'out_a', target: 'p1', targetHandle: 'in_b' },
                    { id: 'e4', source: 'c1', sourceHandle: 'out_a', target: 'and1', targetHandle: 'in_a' },
                    { id: 'e5', source: 'c2', sourceHandle: 'out_a', target: 'and1', targetHandle: 'in_b' },
                ],
                [{ ...IN('bias', 'm1', 'in_b'), defaultValue: 100 }],
                [
                    OUT('pow', 'p1', 'out_a'),
                    { ...OUT('and', 'and1', 'out_a'), dataType: 'boolean' as const },
                ],
            );
            const outer: Record<string, NodePayload> = {};
            if (r() < 0.5) outer.bias = scalar(Math.floor(r() * 20));
            await checkPair(node, outer);
        }
    });
});

describe('Group P2 cache semantics', () => {
    const chain = (): NodeLogic =>
        gnode(
            'adder',
            [
                { id: 'c', type: 'IN-01', data: { value: 3 } },
                { id: 'add', type: 'MA-01', data: { mode: 'ADD' } },
            ],
            [{ id: 'e1', source: 'c', sourceHandle: 'out_a', target: 'add', targetHandle: 'in_a' }],
            [IN('main', 'add', 'in_b')],
            [OUT('sum', 'add', 'out_a')],
        );

    it('allowlist covers the D11 v1 set', () => {
        expect(GROUP_ALLOWLIST.slice().sort()).toEqual(
            ['LG-01', 'LG-02', 'LG-03', 'MA-01', 'MA-02', 'MA-03', 'MA-04', 'MA-05', 'MA-06', 'MA-07', 'MA-08', 'TR-01', 'TR-02', 'TR-06'].sort(),
        );
    });

    it('value-only edits keep structHash and reuse the cached fn', async () => {
        GroupCodeCache.clear();
        const before = chain();
        const data = before.data as unknown as GroupNodeData;
        const h1 = computeStructHash(data.subGraph, data.boundary);
        await NodeRegistry.evaluate(before, { main: scalar(5) });
        const key = GroupCodeCache.key(h1, 64, ALLOWLIST_VERSION);
        const first = GroupCodeCache.get(key);
        expect(first).toBeDefined();

        // Change only the constant value + boundary default: hash stable, same fn.
        const after = chain();
        const d2 = after.data as unknown as GroupNodeData;
        (d2.subGraph.nodes[0].data as Record<string, unknown>).value = 7;
        d2.boundary.inputs[0].defaultValue = 9;
        expect(computeStructHash(d2.subGraph, d2.boundary)).toBe(h1);
        expect(buildScopeParams(d2.subGraph, d2.boundary)[`c__value`]).toBe(7);
        await NodeRegistry.evaluate(after, {});
        expect(GroupCodeCache.get(key)?.fn).toBe(first?.fn);
        expect(GroupCodeCache.size()).toBe(1);
        const out = (await NodeRegistry.evaluate(after, {})) as NodePayload;
        expect(PayloadUtils.unwrap((out.value as Record<string, NodePayload>).sum)).toBeCloseTo(16);
    });

    it('precision-only edits keep structHash (walk scope)', () => {
        const a = chain();
        const da = a.data as unknown as GroupNodeData;
        const h1 = computeStructHash(da.subGraph, da.boundary);
        (da.subGraph.nodes[1].data as Record<string, unknown>).precision = 3;
        expect(computeStructHash(da.subGraph, da.boundary)).toBe(h1);
    });

    it('mode/topology/formula edits change structHash and recompile', async () => {
        GroupCodeCache.clear();
        const a = chain();
        const da = a.data as unknown as GroupNodeData;
        const h1 = computeStructHash(da.subGraph, da.boundary);
        await NodeRegistry.evaluate(a, { main: scalar(1) });
        const f1 = GroupCodeCache.get(GroupCodeCache.key(h1, 64, ALLOWLIST_VERSION))?.fn;
        expect(f1).toBeDefined();

        // Mode change (MA-01 ADD -> MUL) must recompile.
        const b = chain();
        const db = b.data as unknown as GroupNodeData;
        (db.subGraph.nodes[1].data as Record<string, unknown>).mode = 'MUL';
        const h2 = computeStructHash(db.subGraph, db.boundary);
        expect(h2).not.toBe(h1);
        await NodeRegistry.evaluate(b, { main: scalar(4) });
        expect(GroupCodeCache.get(GroupCodeCache.key(h2, 64, ALLOWLIST_VERSION))?.fn).toBeDefined();
        expect(GroupCodeCache.get(GroupCodeCache.key(h2, 64, ALLOWLIST_VERSION))?.fn).not.toBe(f1);

        // MA-02 formula-string change must recompile (generic structural rule).
        const c = chain();
        const dc = c.data as unknown as GroupNodeData;
        dc.subGraph.nodes[1] = { id: 'adv', type: 'MA-02', position: { x: 0, y: 0 }, data: { mode: 'POW' } };
        dc.subGraph.edges = [];
        dc.boundary.inputs = [{ portId: 'main', innerNodeId: 'adv', innerHandle: 'in_a', dataType: 'scalar' }];
        dc.boundary.outputs = [{ portId: 'sum', innerNodeId: 'adv', innerHandle: 'out_a', dataType: 'scalar' }];
        const h3 = computeStructHash(dc.subGraph, dc.boundary);
        (dc.subGraph.nodes[0].data as Record<string, unknown>).formula = 'x^2';
        const h4 = computeStructHash(dc.subGraph, dc.boundary);
        expect(h4).not.toBe(h3);

        // Topology change (drop the edge) must recompile.
        const d = chain();
        const dd = d.data as unknown as GroupNodeData;
        dd.subGraph.edges = [];
        expect(computeStructHash(dd.subGraph, dd.boundary)).not.toBe(h1);
    });

    it('non-allowlist groups fall back to interpretGroup and flag unoptimized', async () => {
        const node = gnode(
            'random',
            [{ id: 'r', type: 'IN-10', data: { mode: 'Uniform', min: 0, max: 1 } }],
            [],
            [],
            [{ ...OUT('o', 'r', 'out_a'), dataType: 'array' as const }],
        );
        const data = node.data as unknown as GroupNodeData;
        expect(canCompileGroup(data.subGraph, data.boundary).ok).toBe(false);
        const out = (await NodeRegistry.evaluate(node, {})) as NodePayload;
        expect((node as unknown as Record<string, unknown>)._groupOptimized).toBe(false);
        expect(out.type).toBe(DataType.Object);
        const roll = PayloadUtils.unwrap((out.value as Record<string, NodePayload>).o);
        expect(Array.isArray(roll)).toBe(true);
    });

    it('compileGroup output is a re-runnable (inputs,params,math) fn string', async () => {
        const node = chain();
        const data = node.data as unknown as GroupNodeData;
        const compiled = compileGroup(data.subGraph, data.boundary, 64);
        expect(compiled.code).toContain('(inputs,params,math)');
        expect(typeof compiled.fn).toBe('function');
        expect(compiled.structHash).toBe(computeStructHash(data.subGraph, data.boundary));
        expect(compiled.allowlistVersion).toBe(ALLOWLIST_VERSION);
    });
});

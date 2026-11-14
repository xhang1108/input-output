/**
 * Deterministic 500-node / 500-edge stress fixture for A/B performance work.
 *
 * Contract:
 *  - Pure: no Math.random, no Date, no module state mutation. Same output every call.
 *  - Shapes match what `Brain.injectNodes` accepts: `{ name, version, nodes, edges }`
 *    with plain React Flow nodes/edges (no serializer, no compression).
 *  - Edge set is a DAG built from explicit layers and pre-validated against the
 *    engine rules: one edge per non-capsule target handle, unique
 *    source|sourceHandle|target|targetHandle combos, no self-loops.
 *  - Node array is ranked `frame (0) -> roots (1) -> children (2)`, matching the
 *    ordering React Flow requires (see `useBrainUpdates` rank sort).
 */
import {
    NODE_DEFINITIONS,
    type HandleConfig,
    type NodeDefinition,
} from '@/types/nodeDefinitions';

export const STRESS_FIXTURE_NAME = 'stress-500';
export const STRESS_FIXTURE_VERSION = 1;
export const STRESS_NODE_COUNT = 500;
export const STRESS_EDGE_COUNT = 500;

export interface StressNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    parentId?: string;
    width: number;
    height: number;
    data: { label: string };
}

export interface StressEdge {
    id: string;
    source: string;
    target: string;
    sourceHandle: string;
    targetHandle: string;
    type: 'magnetic';
    data: { pathType: 'bezier' };
}

export interface StressFixture {
    name: string;
    version: number;
    nodes: StressNode[];
    edges: StressEdge[];
}

/** Children per frame; each frame gets 8-12 children (single level). */
const FRAME_CHILD_COUNTS = [8, 10, 12] as const;

const FRAME_XS = [0, 1150, 2300] as const;
const FRAME_PAD = 20;
const FRAME_CHILD_COLS = 4;
const FRAME_CHILD_COL_W = 240;
const FRAME_CHILD_ROW_H = 150;

const ROOT_ORIGIN = { x: 0, y: 900 } as const;
const ROOT_COLS = 12;
const ROOT_CELL_W = 340;
const ROOT_CELL_H = 200;
const ROOT_JITTER = 6;

/**
 * Root composition. `layer` drives edge direction only (always low -> high),
 * which keeps the graph acyclic by construction.
 *
 * 40 + 200 + 16 + 14 + 6 + 100 + 55 + 4 + 16 + 16 = 467 roots,
 * plus 3 frames + 30 children = 500 nodes.
 */
const ROOT_GROUPS: ReadonlyArray<{ type: string; count: number; layer: number }> = [
    // Layer 0: pure sources (source handles only)
    { type: 'IN-01', count: 40, layer: 0 },
    // Layer 1: scalar math sinks/sources
    { type: 'MA-01', count: 200, layer: 1 },
    // Layer 2: capsule-variant definitions + more math
    { type: 'DT-01', count: 30, layer: 2 }, // capsule target in_a
    { type: 'UT-03', count: 6, layer: 2 },  // capsule target in_a
    { type: 'MA-05', count: 100, layer: 2 },
    // Layer 3: outputs / sinks
    { type: 'TR-01', count: 55, layer: 3 },
    { type: 'OT-03', count: 4, layer: 3 },  // capsule target in_a, no source
    { type: 'OT-01', count: 16, layer: 3 },
    { type: 'OT-04', count: 16, layer: 3 },
];

/** Child types per frame: one source, a mixed chain, one sink. */
const FRAME_CHILD_MIDDLE_TYPES = ['MA-01', 'MA-05', 'TR-01'] as const;

const definitionsById = new Map<string, NodeDefinition>(
    NODE_DEFINITIONS.map((definition) => [definition.id, definition])
);

function getDefinition(type: string): NodeDefinition {
    const definition = definitionsById.get(type);
    if (!definition) {
        throw new Error(`[stressFixture] unknown node definition "${type}"`);
    }
    return definition;
}

/**
 * Node box size. Definitions carry layout hints (`minWidth`/`minHeight`) and
 * occasionally explicit `defaultData.width`/`height`; use the largest of those
 * so the fixture never renders smaller than the real node.
 */
function sizeOf(definition: NodeDefinition): { width: number; height: number } {
    const defaultData = (definition.defaultData ?? {}) as Record<string, unknown>;
    const defaultWidth = typeof defaultData.width === 'number' ? defaultData.width : undefined;
    const defaultHeight = typeof defaultData.height === 'number' ? defaultData.height : undefined;

    return {
        width: Math.max(definition.minWidth ?? 0, defaultWidth ?? 220),
        height: Math.max(definition.minHeight ?? 0, defaultHeight ?? 120),
    };
}

/** Mulberry32: tiny deterministic PRNG (fixed seed, no platform entropy). */
function createRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function handleDataType(handle: HandleConfig | undefined): string {
    return handle?.dataType ?? 'scalar';
}

/** 'any' is a wildcard on either side; otherwise exact data-type match. */
function dataTypesCompatible(source: HandleConfig, target: HandleConfig): boolean {
    const s = handleDataType(source);
    const t = handleDataType(target);
    return s === t || s === 'any' || t === 'any';
}

function firstHandle(definition: NodeDefinition, type: 'source' | 'target'): HandleConfig | undefined {
    return definition.handles.find((handle) => handle.type === type);
}

function frameChildTypes(count: number): string[] {
    if (count < 3) throw new Error('[stressFixture] frame needs at least 3 children');
    const types = ['IN-01'];
    for (let i = 0; i < count - 2; i++) {
        types.push(FRAME_CHILD_MIDDLE_TYPES[i % FRAME_CHILD_MIDDLE_TYPES.length]);
    }
    types.push('OT-01');
    return types;
}

interface RootPlan {
    node: StressNode;
    definition: NodeDefinition;
    layer: number;
}

export function buildStressFixture(): StressFixture {
    // Deterministic seed; every draw below happens in a fixed order.
    const rng = createRng(0x5eed_1e55);
    const nodes: StressNode[] = [];
    const nodeId = (): string => `sn-${String(nodes.length).padStart(4, '0')}`;

    // ── 1. Frames (rank 0) ────────────────────────────────────────────────
    const frames: Array<{ node: StressNode; childCount: number }> = [];
    FRAME_CHILD_COUNTS.forEach((childCount, frameIndex) => {
        const rows = Math.ceil(childCount / FRAME_CHILD_COLS);
        const node: StressNode = {
            id: nodeId(),
            type: 'frame',
            position: { x: FRAME_XS[frameIndex], y: 0 },
            width: FRAME_PAD * 2 + FRAME_CHILD_COLS * FRAME_CHILD_COL_W,
            height: FRAME_PAD * 2 + rows * FRAME_CHILD_ROW_H,
            data: { label: `Frame ${frameIndex + 1}` },
        };
        nodes.push(node);
        frames.push({ node, childCount });
    });

    // ── 2. Roots (rank 1) ─────────────────────────────────────────────────
    const roots: RootPlan[] = [];
    for (const group of ROOT_GROUPS) {
        const definition = getDefinition(group.type);
        const size = sizeOf(definition);

        for (let i = 0; i < group.count; i++) {
            const index = roots.length;
            const col = index % ROOT_COLS;
            const row = Math.floor(index / ROOT_COLS);
            const jitterX = Math.round((rng() * 2 - 1) * ROOT_JITTER);
            const jitterY = Math.round((rng() * 2 - 1) * ROOT_JITTER);

            const node: StressNode = {
                id: nodeId(),
                type: group.type,
                position: {
                    x: ROOT_ORIGIN.x + col * ROOT_CELL_W + jitterX,
                    y: ROOT_ORIGIN.y + row * ROOT_CELL_H + jitterY,
                },
                width: size.width,
                height: size.height,
                data: { label: definition.label },
            };
            nodes.push(node);
            roots.push({ node, definition, layer: group.layer });
        }
    }

    // ── 3. Frame children (rank 2), parent-local positions ────────────────
    const childrenByFrame: Array<{ frameId: string; children: StressNode[] }> = [];
    for (const frame of frames) {
        const children: StressNode[] = [];
        frameChildTypes(frame.childCount).forEach((type, index) => {
            const definition = getDefinition(type);
            const size = sizeOf(definition);
            const col = index % FRAME_CHILD_COLS;
            const row = Math.floor(index / FRAME_CHILD_COLS);

            const node: StressNode = {
                id: nodeId(),
                type,
                position: {
                    x: FRAME_PAD + col * FRAME_CHILD_COL_W,
                    y: FRAME_PAD + row * FRAME_CHILD_ROW_H,
                },
                parentId: frame.node.id,
                width: size.width,
                height: size.height,
                data: { label: definition.label },
            };
            nodes.push(node);
            children.push(node);
        });
        childrenByFrame.push({ frameId: frame.node.id, children });
    }

    // ── 4. Edges ──────────────────────────────────────────────────────────
    const rawEdges: Array<Omit<StressEdge, 'id'>> = [];
    const usedCombos = new Set<string>();

    const addEdge = (
        source: string,
        target: string,
        sourceHandle: string,
        targetHandle: string
    ): void => {
        const combo = `${source}|${sourceHandle}|${target}|${targetHandle}`;
        if (usedCombos.has(combo)) {
            throw new Error(`[stressFixture] duplicate edge combo ${combo}`);
        }
        usedCombos.add(combo);
        rawEdges.push({
            source,
            target,
            sourceHandle,
            targetHandle,
            type: 'magnetic',
            data: { pathType: 'bezier' },
        });
    };

    // 4a. Frame-internal chains (one edge per consecutive pair; guards the
    //     nested/parented render path without crossing frames).
    for (const { children } of childrenByFrame) {
        for (let i = 0; i < children.length - 1; i++) {
            addEdge(children[i].id, children[i + 1].id, 'out_a', 'in_a');
        }
    }

    // 4b. Root edges: every root on layer >= 1 gets one incoming edge from a
    //     lower layer. Cyclic selection (stride 1) guarantees the layer-0
    //     source pool is fully exercised.
    const sourceRoots = roots.filter((plan) => firstHandle(plan.definition, 'source'));
    const poolCache = new Map<number, RootPlan[]>();
    const poolFor = (layer: number): RootPlan[] => {
        let pool = poolCache.get(layer);
        if (!pool) {
            pool = sourceRoots.filter((plan) => plan.layer < layer);
            poolCache.set(layer, pool);
        }
        return pool;
    };

    const offsets = new Map<number, number>();
    const startOffsetFor = (layer: number, poolLength: number): number => {
        let offset = offsets.get(layer);
        if (offset === undefined) {
            offset = Math.floor(rng() * Math.max(1, poolLength));
            offsets.set(layer, offset);
        }
        return offset;
    };

    const cursors = new Map<number, number>();
    const nextInPool = (layer: number, targetHandle: HandleConfig): RootPlan => {
        const all = poolFor(layer);
        if (all.length === 0) {
            throw new Error(`[stressFixture] no source node below layer ${layer}`);
        }
        const compatible = all.filter((plan) =>
            dataTypesCompatible(firstHandle(plan.definition, 'source')!, targetHandle)
        );
        const pool = compatible.length > 0 ? compatible : all;

        const cursor = cursors.get(layer) ?? 0;
        const index = (startOffsetFor(layer, pool.length) + cursor) % pool.length;
        cursors.set(layer, cursor + 1);
        return pool[index];
    };

    for (const plan of roots) {
        if (plan.layer === 0) continue;
        const targetHandle = firstHandle(plan.definition, 'target');
        if (!targetHandle) {
            throw new Error(`[stressFixture] "${plan.definition.id}" has no target handle`);
        }
        const sourcePlan = nextInPool(plan.layer, targetHandle);
        const sourceHandle = firstHandle(sourcePlan.definition, 'source')!;
        addEdge(sourcePlan.node.id, plan.node.id, sourceHandle.id, targetHandle.id);
    }

    // 4c. Capsule coverage: capsule slots accept many edges, so give each
    //     capsule node 1-2 extra fan-in edges (46 extras -> 500 total).
    const capsuleTargets = roots.filter((plan) => {
        const targetHandle = firstHandle(plan.definition, 'target');
        return plan.layer >= 1 && targetHandle?.variant === 'capsule';
    });
    const extraPlan = new Map<string, number>();
    capsuleTargets.forEach((plan, index) => {
        extraPlan.set(plan.node.id, 1 + (index < 6 ? 1 : 0));
    });
    const extraCursors = new Map<string, number>();

    for (const plan of capsuleTargets) {
        const targetHandle = firstHandle(plan.definition, 'target')!;
        const pool = poolFor(plan.layer);
        const extras = extraPlan.get(plan.node.id) ?? 0;

        for (let e = 0; e < extras; e++) {
            const seedKey = `${plan.node.id}|${e}`;
            let cursor = extraCursors.get(seedKey);
            if (cursor === undefined) {
                cursor = Math.floor(rng() * Math.max(1, pool.length));
            }

            let chosen: RootPlan | undefined;
            for (let attempt = 0; attempt < pool.length; attempt++) {
                const candidate = pool[(cursor + attempt) % pool.length];
                const sourceHandle = firstHandle(candidate.definition, 'source')!;
                const combo = `${candidate.node.id}|${sourceHandle.id}|${plan.node.id}|${targetHandle.id}`;
                if (!usedCombos.has(combo)) {
                    chosen = candidate;
                    extraCursors.set(seedKey, (cursor + attempt + 1) % pool.length);
                    break;
                }
            }

            if (!chosen) {
                throw new Error(`[stressFixture] capsule node ${plan.node.id} has no free source`);
            }
            addEdge(
                chosen.node.id,
                plan.node.id,
                firstHandle(chosen.definition, 'source')!.id,
                targetHandle.id
            );
        }
    }

    const edges: StressEdge[] = rawEdges.map((edge, index) => ({
        id: `se-${String(index).padStart(4, '0')}`,
        ...edge,
    }));

    if (nodes.length !== STRESS_NODE_COUNT) {
        throw new Error(`[stressFixture] expected ${STRESS_NODE_COUNT} nodes, got ${nodes.length}`);
    }
    if (edges.length !== STRESS_EDGE_COUNT) {
        throw new Error(`[stressFixture] expected ${STRESS_EDGE_COUNT} edges, got ${edges.length}`);
    }

    return {
        name: STRESS_FIXTURE_NAME,
        version: STRESS_FIXTURE_VERSION,
        nodes,
        edges,
    };
}

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NODE_DEFINITIONS, type HandleConfig, type NodeDefinition } from '@/types/nodeDefinitions';
import {
    HANDLE_MIN_CAPSULE_HEIGHT,
    calculateCapsuleHeight,
    getHandleVariant,
} from '@/utils/handleUtils';

import {
    STRESS_EDGE_COUNT,
    STRESS_FIXTURE_NAME,
    STRESS_NODE_COUNT,
    STRESS_FIXTURE_VERSION,
    buildStressFixture,
} from './stressFixture';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_PATH = path.resolve(HERE, '../../fixtures/stress/stress-500.json');

const definitionById = new Map<string, NodeDefinition>(
    NODE_DEFINITIONS.map((definition) => [definition.id, definition])
);

const fixture = buildStressFixture();

const nodeById = new Map(fixture.nodes.map((node) => [node.id, node]));
const isFrame = (id: string): boolean => nodeById.get(id)?.type === 'frame';

function definitionOf(nodeId: string): NodeDefinition {
    const node = nodeById.get(nodeId);
    if (!node) throw new Error(`missing node ${nodeId}`);
    const definition = definitionById.get(node.type);
    if (!definition) throw new Error(`missing definition for type ${node.type}`);
    return definition;
}

function handle(definition: NodeDefinition, handleId: string): HandleConfig | undefined {
    return definition.handles.find((candidate) => candidate.id === handleId);
}

function overlap(
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
): boolean {
    return (
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
    );
}

describe('stressFixture.shape', () => {
    it('is named and versioned', () => {
        expect(fixture.name).toBe(STRESS_FIXTURE_NAME);
        expect(fixture.name).toBe('stress-500');
        expect(fixture.version).toBe(STRESS_FIXTURE_VERSION);
        expect(fixture.version).toBe(1);
    });

    it('has exactly 500 nodes and 500 edges', () => {
        expect(fixture.nodes).toHaveLength(STRESS_NODE_COUNT);
        expect(fixture.edges).toHaveLength(STRESS_EDGE_COUNT);
        expect(STRESS_NODE_COUNT).toBe(500);
        expect(STRESS_EDGE_COUNT).toBe(500);
    });

    it('uses the sn-#### / se-#### id scheme', () => {
        fixture.nodes.forEach((node, index) => {
            expect(node.id).toBe(`sn-${String(index).padStart(4, '0')}`);
        });
        fixture.edges.forEach((edge, index) => {
            expect(edge.id).toBe(`se-${String(index).padStart(4, '0')}`);
        });
    });

    it('has unique node ids and unique edge ids', () => {
        expect(new Set(fixture.nodes.map((node) => node.id)).size).toBe(fixture.nodes.length);
        expect(new Set(fixture.edges.map((edge) => edge.id)).size).toBe(fixture.edges.length);
    });

    it('is deterministic across builds', () => {
        expect(buildStressFixture()).toEqual(fixture);
    });

    it('JSON round-trips without loss', () => {
        const json = JSON.stringify(fixture);
        expect(JSON.parse(json)).toEqual(fixture);
    });
});

describe('stressFixture.nodes', () => {
    it('every node type exists in NODE_DEFINITIONS', () => {
        for (const node of fixture.nodes) {
            expect(definitionById.has(node.type)).toBe(true);
        }
    });

    it('every node carries id, type, position, data.label and a positive box', () => {
        for (const node of fixture.nodes) {
            expect(node.id).toBeTruthy();
            expect(node.type).toBeTruthy();
            expect(Number.isFinite(node.position.x)).toBe(true);
            expect(Number.isFinite(node.position.y)).toBe(true);
            expect(typeof node.data.label).toBe('string');
            expect(node.data.label.length).toBeGreaterThan(0);
            expect(Number.isFinite(node.width)).toBe(true);
            expect(Number.isFinite(node.height)).toBe(true);
            expect(node.width).toBeGreaterThan(0);
            expect(node.height).toBeGreaterThan(0);
        }
    });

    it('never renders below the definition size hints', () => {
        for (const node of fixture.nodes) {
            const definition = definitionOf(node.id);
            expect(node.width).toBeGreaterThanOrEqual(definition.minWidth ?? 0);
            expect(node.height).toBeGreaterThanOrEqual(definition.minHeight ?? 0);
        }
    });

    it('ranks frames before roots and roots before children', () => {
        const rank = (type: string, parentId?: string): number => {
            if (type === 'frame') return 0;
            return parentId ? 2 : 1;
        };

        const ranks = fixture.nodes.map((node) => rank(node.type, node.parentId));
        const sorted = [...ranks].sort((a, b) => a - b);
        expect(ranks).toEqual(sorted);
    });

    it('places every root without overlap', () => {
        const roots = fixture.nodes
            .filter((node) => node.type !== 'frame' && !node.parentId)
            .map((node) => ({
                id: node.id,
                x: node.position.x,
                y: node.position.y,
                width: node.width,
                height: node.height,
            }));
        expect(roots.length).toBeGreaterThan(400);

        // Sweep on x so the whole check stays near-linear instead of O(n^2).
        const sorted = [...roots].sort((a, b) => a.x - b.x || a.y - b.y);
        const collisions: string[] = [];
        for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
                if (sorted[j].x >= sorted[i].x + sorted[i].width) break;
                if (overlap(sorted[i], sorted[j])) {
                    collisions.push(`${sorted[i].id} overlaps ${sorted[j].id}`);
                }
            }
        }
        expect(collisions).toEqual([]);
    });

    it('keeps the root grid below the frame band', () => {
        const frames = fixture.nodes.filter((node) => node.type === 'frame');
        const roots = fixture.nodes.filter((node) => node.type !== 'frame' && !node.parentId);
        const frameBottom = Math.max(...frames.map((node) => node.position.y + node.height));
        const rootTop = Math.min(...roots.map((node) => node.position.y));
        expect(rootTop).toBeGreaterThan(frameBottom);
    });
});

describe('stressFixture.frames', () => {
    const frames = fixture.nodes.filter((node) => node.type === 'frame');

    it('has exactly 3 frame nodes at fixed positions', () => {
        expect(frames).toHaveLength(3);
        expect(frames.map((node) => node.position)).toEqual([
            { x: 0, y: 0 },
            { x: 1150, y: 0 },
            { x: 2300, y: 0 },
        ]);
        for (const frame of frames) {
            expect(frame.parentId).toBeUndefined();
        }
    });

    it('gives every frame 8-12 resolvable children, single level', () => {
        const frameIds = new Set(frames.map((node) => node.id));

        for (const frame of frames) {
            const children = fixture.nodes.filter((node) => node.parentId === frame.id);
            expect(children.length).toBeGreaterThanOrEqual(8);
            expect(children.length).toBeLessThanOrEqual(12);
            expect(children.some((child) => child.type === 'frame')).toBe(false);
        }

        const children = fixture.nodes.filter((node) => node.parentId !== undefined);
        expect(children).toHaveLength(
            frames.reduce(
                (total, frame) => total + fixture.nodes.filter((node) => node.parentId === frame.id).length,
                0
            )
        );

        for (const child of children) {
            expect(child.parentId).toBeDefined();
            expect(frameIds.has(child.parentId!)).toBe(true);
            // Single level: a child never hosts its own children.
            expect(fixture.nodes.some((node) => node.parentId === child.id)).toBe(false);
        }
    });

    it('keeps every child fully inside its frame (parent-local coordinates)', () => {
        for (const child of fixture.nodes.filter((node) => node.parentId !== undefined)) {
            const frame = nodeById.get(child.parentId!);
            expect(frame).toBeDefined();
            expect(child.position.x).toBeGreaterThanOrEqual(0);
            expect(child.position.y).toBeGreaterThanOrEqual(0);
            expect(child.position.x + child.width).toBeLessThanOrEqual(frame!.width);
            expect(child.position.y + child.height).toBeLessThanOrEqual(frame!.height);
        }
    });
});

describe('stressFixture.capsuleCoverage', () => {
    const capsuleNodeIds = fixture.nodes.filter((node) => {
        if (node.type === 'frame') return false;
        return definitionOf(node.id).handles.some(
            (candidate) =>
                candidate.type === 'target' &&
                getHandleVariant({ type: node.type }, candidate.id) === 'capsule'
        );
    });

    it('has at least 20 non-frame nodes with a capsule target definition', () => {
        expect(capsuleNodeIds.length).toBeGreaterThanOrEqual(20);
    });

    it('routes real edges into capsule slots', () => {
        const capsuleEdges = fixture.edges.filter((edge) => {
            const definition = definitionOf(edge.target);
            const targetHandle = handle(definition, edge.targetHandle);
            if (!targetHandle) return false;
            return (
                getHandleVariant({ type: nodeById.get(edge.target)!.type }, edge.targetHandle) ===
                'capsule'
            );
        });

        expect(capsuleEdges.length).toBeGreaterThanOrEqual(20);

        const slotCounts = new Map<string, number>();
        for (const edge of capsuleEdges) {
            const key = `${edge.target}|${edge.targetHandle}`;
            slotCounts.set(key, (slotCounts.get(key) ?? 0) + 1);
        }

        for (const count of slotCounts.values()) {
            const height = calculateCapsuleHeight(count);
            expect(height).toBe(Math.max(HANDLE_MIN_CAPSULE_HEIGHT, count * 14 + 12));
            expect(height).toBeGreaterThanOrEqual(HANDLE_MIN_CAPSULE_HEIGHT);
        }
    });

    it('covers more than one capsule definition', () => {
        const capsuleTypes = new Set(
            capsuleNodeIds.map((node) => node.type)
        );
        expect(capsuleTypes.size).toBeGreaterThanOrEqual(3);
        expect([...capsuleTypes].sort()).toEqual(['DT-01', 'OT-03', 'UT-03']);
    });
});

describe('stressFixture.edges', () => {
    it('uses the magnetic bezier edge shape Brain injects', () => {
        for (const edge of fixture.edges) {
            expect(edge.type).toBe('magnetic');
            expect(edge.data).toEqual({ pathType: 'bezier' });
            expect(Object.keys(edge)).toEqual([
                'id',
                'source',
                'target',
                'sourceHandle',
                'targetHandle',
                'type',
                'data',
            ]);
        }
    });

    it('points every endpoint at an existing node', () => {
        for (const edge of fixture.edges) {
            expect(nodeById.has(edge.source), `missing source ${edge.source}`).toBe(true);
            expect(nodeById.has(edge.target), `missing target ${edge.target}`).toBe(true);
        }
    });

    it('uses real handle ids with the right direction', () => {
        for (const edge of fixture.edges) {
            const sourceHandle = handle(definitionOf(edge.source), edge.sourceHandle);
            const targetHandle = handle(definitionOf(edge.target), edge.targetHandle);

            expect(sourceHandle, `${edge.id} source handle`).toBeDefined();
            expect(targetHandle, `${edge.id} target handle`).toBeDefined();
            expect(sourceHandle!.type).toBe('source');
            expect(targetHandle!.type).toBe('target');
        }
    });

    it('has no self-loops', () => {
        for (const edge of fixture.edges) {
            expect(edge.source).not.toBe(edge.target);
        }
    });

    it('has no duplicate source+target+handle combos', () => {
        const combos = fixture.edges.map(
            (edge) => `${edge.source}|${edge.sourceHandle}|${edge.target}|${edge.targetHandle}`
        );
        expect(new Set(combos).size).toBe(combos.length);
    });

    it('keeps non-capsule target handles single-connection (engine rule)', () => {
        const seen = new Set<string>();
        for (const edge of fixture.edges) {
            const variant = getHandleVariant(
                { type: nodeById.get(edge.target)!.type },
                edge.targetHandle
            );
            const key = `${edge.target}|${edge.targetHandle}`;
            if (variant === 'capsule') continue;
            expect(seen.has(key), `handle ${key} reused`).toBe(false);
            seen.add(key);
        }
    });

    it('gives every non-frame node at least one edge', () => {
        const connected = new Set<string>();
        for (const edge of fixture.edges) {
            connected.add(edge.source);
            connected.add(edge.target);
        }

        const orphans = fixture.nodes
            .filter((node) => !isFrame(node.id))
            .filter((node) => !connected.has(node.id))
            .map((node) => node.id);

        expect(orphans).toEqual([]);
    });

    it('is acyclic', () => {
        const outgoing = new Map<string, string[]>();
        for (const edge of fixture.edges) {
            const list = outgoing.get(edge.source) ?? [];
            list.push(edge.target);
            outgoing.set(edge.source, list);
        }

        const state = new Map<string, 'visiting' | 'done'>();
        const visit = (nodeId: string): boolean => {
            const current = state.get(nodeId);
            if (current === 'visiting') return false;
            if (current === 'done') return true;
            state.set(nodeId, 'visiting');
            for (const next of outgoing.get(nodeId) ?? []) {
                if (!visit(next)) return false;
            }
            state.set(nodeId, 'done');
            return true;
        };

        for (const node of fixture.nodes) {
            expect(visit(node.id), `cycle reachable from ${node.id}`).toBe(true);
        }
    });
});

describe('stressFixture.artifact', () => {
    it('matches the committed JSON artifact when present', () => {
        if (!existsSync(ARTIFACT_PATH)) {
            // The write test (STRESS_WRITE=1) owns creation of the artifact.
            return;
        }
        const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf8'));
        expect(artifact).toEqual(fixture);
    });
});

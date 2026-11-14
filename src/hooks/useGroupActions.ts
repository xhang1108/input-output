'use client';

import { useCallback, useState } from 'react';
import { addEdge, useReactFlow } from '@xyflow/react';
import type { Connection, Edge, Node } from '@xyflow/react';
import deepEqual from 'fast-deep-equal';
import { useBrain } from '../context/BrainContext';
import { useHistoryStore } from '../store/useHistoryStore';
import type { Transaction } from '../engine/types/engineTypes';
import { generateEdgeId, generateNodeId } from '../utils/idGenerator';
import { hydrateGroupPorts } from '../utils/groupPorts';
import { PayloadUtils } from '../utils/PayloadUtils';
import { NODE_DEFINITIONS } from '../types/nodeDefinitions';
import type { HandleDataType } from '../types/nodeDefinitions';
import type { BoundaryPort, GroupNodeData, LeanEdge, LeanNode, SubGraph } from '../types/groupNode';
import { applyFullSync } from './useBrainUpdates';

// GROUP_NODE_PLAN §5.4 / §5.5 / §7 D6+D7+D10.
// Blender-style group/ungroup + scope-mode drill editor. Engine is untouched:
// everything here is Brain transactions (BATCH) + React Flow view swaps.
// Shortcuts (Ctrl+G / Ctrl+Shift+G / Tab) live in constants/shortcuts.ts (P0);
// this file owns the topology rewiring, the drill draft, and the composite
// exit commit whose inverse restores the previous snapshot in one Ctrl+Z.

// D2: nesting ban — a group/subGraph must never contain frame/group.
const FORBIDDEN_INNER_TYPES = new Set(['frame', 'group']);
// D10: only Slider nodes upgrade to input ports on group.
const SLIDER_TYPE = 'IN-02';
const SLIDER_PORT_PREFIX = 'in_slider_';
// Scope-mode portal nodes reuse the stock 'baseNode' renderer (no new
// nodeTypes registration): they are recognised by this data flag + id prefix.
const PORTAL_FLAG = '__groupPortal';
const PORTAL_ID_PREFIX = '__gp_';
const portalInId = (groupId: string) => `${PORTAL_ID_PREFIX}in_${groupId}`;
const portalOutId = (groupId: string) => `${PORTAL_ID_PREFIX}out_${groupId}`;

/** Minimal structural view of a canvas node (RF Node compatible). */
export interface LiteNode {
    id: string;
    type?: string | null;
    position: { x: number; y: number };
    data?: Record<string, unknown>;
    width?: number;
    height?: number;
    parentId?: string | null;
    selected?: boolean;
}

/** Minimal structural view of a canvas edge (RF Edge compatible). */
export interface LiteEdge {
    id: string;
    source: string;
    sourceHandle?: string | null;
    target: string;
    targetHandle?: string | null;
    type?: string;
    data?: unknown;
}

export interface GroupBuildResult {
    forward: Transaction[];
    inverse: Transaction[];
    group: { id: string; position: { x: number; y: number }; data: GroupNodeData & { handles: unknown[] } };
    error?: undefined;
}

export interface GroupBuildFailure {
    error: string;
    forward?: undefined;
    inverse?: undefined;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value ?? null)) as T;

/** UI-transient data keys that must never enter a persisted subGraph. */
const TRANSIENT_DATA_KEYS = new Set(['isEditing', 'isTyping', 'isPending', 'selected']);

function stripTransient(data: Record<string, unknown> | undefined): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data ?? {})) {
        if (!TRANSIENT_DATA_KEYS.has(key)) out[key] = value;
    }
    return out;
}

function nodeLabel(node: LiteNode | undefined, fallback: string): string {
    const label = node?.data?.label;
    return typeof label === 'string' && label.length > 0 ? label : fallback;
}

function handleDataType(
    nodesById: Map<string, LiteNode>,
    nodeId: string,
    handleId: string
): HandleDataType {
    const node = nodesById.get(nodeId);
    const dynamic = (node?.data?.handles as Array<{ id: string; dataType?: HandleDataType }> | undefined)
        ?.find((h) => h.id === handleId)?.dataType;
    if (dynamic) return dynamic;
    const def = NODE_DEFINITIONS.find((d) => d.id === node?.type);
    return (def?.handles.find((h) => h.id === handleId)?.dataType ?? 'scalar') as HandleDataType;
}

function uniquePortId(base: string, used: Set<string>, innerId: string, innerHandle: string): string {
    if (!used.has(base)) {
        used.add(base);
        return base;
    }
    let candidate = `${base}__${innerId}__${innerHandle}`;
    let n = 2;
    while (used.has(candidate)) candidate = `${base}__${innerId}__${innerHandle}__${n++}`;
    used.add(candidate);
    return candidate;
}

function sliderNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asGroupData(data: unknown): GroupNodeData | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Partial<GroupNodeData>;
    if (!d.subGraph || !d.boundary) return null;
    return d as GroupNodeData;
}

export function isPortalNode(node: { id: string; data?: unknown }): boolean {
    if (node.id.startsWith(PORTAL_ID_PREFIX)) return true;
    const data = node.data as Record<string, unknown> | undefined;
    return typeof data?.[PORTAL_FLAG] === 'string';
}

// ─── Pure builders (exported for unit tests) ────────────────────────────────

export function buildGroupTransactions(args: {
    nodes: LiteNode[];
    edges: LiteEdge[];
    selectedIds: string[];
    groupId: string;
}): GroupBuildResult | GroupBuildFailure {
    const { nodes, edges, selectedIds, groupId } = args;
    const selected = nodes.filter((n) => selectedIds.includes(n.id));

    const forbidden = selected.filter((n) => n.type && FORBIDDEN_INNER_TYPES.has(n.type));
    if (forbidden.length > 0) {
        return { error: `Group blocked: selection contains ${forbidden.map((n) => n.type).join(', ')} (D2: no nested frame/group)` };
    }
    if (selected.some(isPortalNode)) {
        return { error: 'Group blocked: selection contains group portals' };
    }
    const candidates = selected.filter((n) => !isPortalNode(n));
    if (candidates.length === 0) {
        return { error: 'Group blocked: select nodes to group' };
    }

    const internal = new Set(candidates.map((n) => n.id));
    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    // Frames emptied by this grouping must go too — otherwise the orphaned
    // frame renders as a gray box behind the new group node (parentId is not
    // carried onto the group). Partially emptied frames stay untouched.
    // Inverse re-adds removed frames parent-first (before the node ADDs).
    const emptiedFrames = nodes.filter((n) => {
        if (n.type !== 'frame') return false;
        const children = nodes.filter((c) => c.parentId === n.id);
        return children.length > 0 && children.every((c) => internal.has(c.id));
    });

    // Stray empty frames (zero children, left over from earlier F experiments)
    // that geometrically overlap the selection also read as a gray box behind
    // the new group. Remove only overlapped ones — distant empties and frames
    // that still contain other nodes are left alone.
    const FRAME_FALLBACK_W = 200;
    const FRAME_FALLBACK_H = 120;
    const PAD = 24;
    let selMinX = Infinity, selMinY = Infinity, selMaxX = -Infinity, selMaxY = -Infinity;
    for (const c of candidates) {
        selMinX = Math.min(selMinX, c.position.x);
        selMinY = Math.min(selMinY, c.position.y);
        selMaxX = Math.max(selMaxX, c.position.x);
        selMaxY = Math.max(selMaxY, c.position.y);
    }
    const overlaps = (f: LiteNode): boolean => {
        const fw = f.width ?? FRAME_FALLBACK_W;
        const fh = f.height ?? FRAME_FALLBACK_H;
        return (
            f.position.x - PAD < selMaxX &&
            f.position.x + fw + PAD > selMinX &&
            f.position.y - PAD < selMaxY &&
            f.position.y + fh + PAD > selMinY
        );
    };
    const strayEmptyFrames = nodes.filter(
        (n) => n.type === 'frame' && nodes.every((c) => c.parentId !== n.id) && overlaps(n)
    );
    const framesToRemove = [...emptiedFrames, ...strayEmptyFrames.filter((f) => !emptiedFrames.includes(f))];

    // D10: a Slider upgrades to an input port only when it is fully internal
    // (no edge to an outside node) and has no incoming edges at all. Sliders
    // wired to the outside stay ordinary inner nodes so no edge is ever lost.
    const upgradedSliders = new Set<string>();
    for (const node of candidates) {
        if (node.type !== SLIDER_TYPE) continue;
        const incident = edges.filter((e) => e.source === node.id || e.target === node.id);
        const hasExternal = incident.some((e) => !internal.has(e.source) || !internal.has(e.target));
        const hasIncoming = incident.some((e) => e.target === node.id);
        if (!hasExternal && !hasIncoming) upgradedSliders.add(node.id);
    }

    const subNodes = candidates.filter((n) => !upgradedSliders.has(n.id));
    const subIds = new Set(subNodes.map((n) => n.id));

    const innerEdges = edges.filter((e) => subIds.has(e.source) && subIds.has(e.target));
    // Slider feed edges vanish from the subGraph: the inner handle is fed by
    // the port default (or a later outer wire) instead.
    const sliderFeedEdges = edges.filter((e) => upgradedSliders.has(e.source) && subIds.has(e.target));
    const crossingIn = edges.filter((e) => subIds.has(e.target) && !internal.has(e.source));
    const crossingOut = edges.filter((e) => subIds.has(e.source) && !internal.has(e.target));

    const usedPortIds = new Set<string>();
    const inputs: BoundaryPort[] = [];
    const outputs: BoundaryPort[] = [];
    const inPortByEdge = new Map<string, string>();
    const outPortByEdge = new Map<string, string>();

    for (const e of crossingIn) {
        const sourceHandle = e.sourceHandle || 'out';
        const targetHandle = e.targetHandle || 'in';
        const portId = uniquePortId(`in_${e.source}__${sourceHandle}`, usedPortIds, e.target, targetHandle);
        inputs.push({
            portId,
            innerNodeId: e.target,
            innerHandle: targetHandle,
            dataType: handleDataType(nodesById, e.source, sourceHandle),
            label: nodeLabel(nodesById.get(e.source), sourceHandle),
        });
        inPortByEdge.set(e.id, portId);
    }
    for (const e of crossingOut) {
        const sourceHandle = e.sourceHandle || 'out';
        const targetHandle = e.targetHandle || 'in';
        const portId = uniquePortId(`out_${e.target}__${targetHandle}`, usedPortIds, e.source, sourceHandle);
        outputs.push({
            portId,
            innerNodeId: e.source,
            innerHandle: sourceHandle,
            dataType: handleDataType(nodesById, e.source, sourceHandle),
            label: nodeLabel(nodesById.get(e.source), sourceHandle),
        });
        outPortByEdge.set(e.id, portId);
    }
    // D10 slider ports: one port per fed inner handle; the Slider node leaves
    // the canvas and its value/min/max/step live on the port.
    for (const e of sliderFeedEdges) {
        const slider = nodesById.get(e.source)!;
        const data = (slider.data ?? {}) as Record<string, unknown>;
        const sourceHandle = e.sourceHandle || 'out_a';
        const targetHandle = e.targetHandle || 'in';
        const portId = uniquePortId(
            `${SLIDER_PORT_PREFIX}${e.source}__${sourceHandle}`,
            usedPortIds,
            e.target,
            targetHandle
        );
        const constraints: { min?: number; max?: number; step?: number } = {};
        const min = sliderNumber(data.min);
        const max = sliderNumber(data.max);
        const step = sliderNumber(data.step);
        if (min !== undefined) constraints.min = min;
        if (max !== undefined) constraints.max = max;
        if (step !== undefined) constraints.step = step;
        inputs.push({
            portId,
            innerNodeId: e.target,
            innerHandle: targetHandle,
            dataType: handleDataType(nodesById, e.source, sourceHandle),
            label: nodeLabel(slider, 'Slider'),
            defaultValue: PayloadUtils.unwrap(data.value) as number | string | boolean,
            ...(Object.keys(constraints).length > 0 ? { constraints } : {}),
        });
        inPortByEdge.set(e.id, portId);
    }

    const removedEdges = edges.filter((e) => internal.has(e.source) || internal.has(e.target));

    const subGraph: SubGraph = {
        nodes: subNodes.map((n) => ({
            id: n.id,
            type: n.type || 'baseNode',
            position: { ...n.position },
            data: cloneJson(stripTransient(n.data)),
        })),
        edges: innerEdges.map((e) => ({
            id: e.id,
            source: e.source,
            sourceHandle: e.sourceHandle || '',
            target: e.target,
            targetHandle: e.targetHandle || '',
        })),
    };

    const cx = subNodes.reduce((sum, n) => sum + n.position.x, 0) / Math.max(1, subNodes.length);
    const cy = subNodes.reduce((sum, n) => sum + n.position.y, 0) / Math.max(1, subNodes.length);
    const position = { x: Math.round(cx), y: Math.round(cy) };

    const boundary = { inputs, outputs };
    const data = {
        label: 'Group',
        subGraph,
        boundary,
        handles: hydrateGroupPorts(boundary),
    } as GroupNodeData & { handles: unknown[] };

    const newEdges: LiteEdge[] = [
        ...crossingIn.map((e) => ({
            id: generateEdgeId(),
            source: e.source,
            sourceHandle: e.sourceHandle,
            target: groupId,
            targetHandle: inPortByEdge.get(e.id)!,
            type: 'magnetic',
            data: { pathType: 'bezier' },
        })),
        ...crossingOut.map((e) => ({
            id: generateEdgeId(),
            source: groupId,
            sourceHandle: outPortByEdge.get(e.id)!,
            target: e.target,
            targetHandle: e.targetHandle,
            type: 'magnetic',
            data: { pathType: 'bezier' },
        })),
    ];

    const forward: Transaction[] = [
        ...candidates.map((n) => ({ type: 'REMOVE_NODE' as const, payload: n.id })),
        ...framesToRemove.map((f) => ({ type: 'REMOVE_NODE' as const, payload: f.id })),
        { type: 'ADD_NODE' as const, payload: { id: groupId, type: 'group', position, data } },
        ...newEdges.map((e) => ({ type: 'CONNECT' as const, payload: { ...e } })),
    ];
    const inverse: Transaction[] = [
        ...newEdges.map((e) => ({ type: 'DISCONNECT' as const, payload: e.id })),
        { type: 'REMOVE_NODE' as const, payload: groupId },
        ...framesToRemove.map((f) => ({
            type: 'ADD_NODE' as const,
            payload: {
                id: f.id,
                type: 'frame',
                position: { ...f.position },
                data: cloneJson(f.data ?? {}),
                width: f.width,
                height: f.height,
                selected: false,
            },
        })),
        ...candidates.map((n) => ({
            type: 'ADD_NODE' as const,
            payload: {
                id: n.id,
                type: n.type || 'baseNode',
                position: { ...n.position },
                data: cloneJson(n.data ?? {}),
                parentId: n.parentId ?? undefined,
                width: n.width,
                height: n.height,
                selected: true,
            },
        })),
        ...removedEdges.map((e) => ({ type: 'CONNECT' as const, payload: cloneJson(e) })),
    ];

    return { forward, inverse, group: { id: groupId, position, data } };
}

function parseSliderPort(portId: string): { sliderId: string; sourceHandle: string } | null {
    if (!portId.startsWith(SLIDER_PORT_PREFIX)) return null;
    const rest = portId.slice(SLIDER_PORT_PREFIX.length);
    const sep = rest.indexOf('__');
    if (sep <= 0) return null;
    return { sliderId: rest.slice(0, sep), sourceHandle: rest.slice(sep + 2).split('__')[0] || 'out_a' };
}

export function buildUngroupTransactions(args: {
    groupId: string;
    groupPosition: { x: number; y: number };
    groupData: GroupNodeData;
    mainEdges: LiteEdge[];
}): { forward: Transaction[]; inverse: Transaction[]; restored: number; dropped: number } {
    const { groupId, groupPosition, groupData, mainEdges } = args;
    const boundary = groupData.boundary ?? { inputs: [], outputs: [] };
    const subGraph = groupData.subGraph ?? { nodes: [], edges: [] };
    const touching = mainEdges.filter((e) => e.source === groupId || e.target === groupId);

    const inputsByPort = new Map(boundary.inputs.map((p) => [p.portId, p]));
    const outputsByPort = new Map(boundary.outputs.map((p) => [p.portId, p]));

    const restored: LiteEdge[] = [];
    let dropped = 0;
    // Slider ports fed by an outer wire behave like ordinary input ports;
    // only wire-free slider ports recreate the Slider node (D10). Wire-free
    // ports have no main edge, so they need their own pass over the boundary.
    const sliderRecreate = new Map<string, BoundaryPort[]>();
    const mainPortIds = new Set<string>();
    for (const e of touching) {
        mainPortIds.add(e.target === groupId ? e.targetHandle || '' : e.sourceHandle || '');
    }
    for (const port of boundary.inputs) {
        const slider = parseSliderPort(port.portId);
        if (slider && port.defaultValue !== undefined && !mainPortIds.has(port.portId)) {
            const list = sliderRecreate.get(slider.sliderId) ?? [];
            list.push(port);
            sliderRecreate.set(slider.sliderId, list);
        }
    }
    for (const e of touching) {
        if (e.target === groupId) {
            const port = inputsByPort.get(e.targetHandle || '');
            if (!port) { dropped += 1; continue; }
            restored.push({
                id: e.id,
                source: e.source,
                sourceHandle: e.sourceHandle,
                target: port.innerNodeId,
                targetHandle: port.innerHandle,
                type: 'magnetic',
                data: { pathType: 'bezier' },
            });
        } else {
            const port = outputsByPort.get(e.sourceHandle || '');
            if (!port) { dropped += 1; continue; }
            restored.push({
                id: e.id,
                source: port.innerNodeId,
                sourceHandle: port.innerHandle,
                target: e.target,
                targetHandle: e.targetHandle,
                type: 'magnetic',
                data: { pathType: 'bezier' },
            });
        }
    }
    // Wire-free slider ports (no outer edge ever attached): one Slider node
    // per originating slider id, fanning out to its inner targets.
    const sliderNodes: Array<{ id: string; position: { x: number; y: number }; data: Record<string, unknown> }> = [];
    const sliderFeeds: LiteEdge[] = [];
    const innerById = new Map(subGraph.nodes.map((n) => [n.id, n]));
    for (const [sliderId, ports] of sliderRecreate) {
        const targets = ports.map((p) => innerById.get(p.innerNodeId)).filter(Boolean) as LeanNode[];
        const avgX = targets.length > 0
            ? targets.reduce((s, n) => s + n.position.x, 0) / targets.length
            : groupPosition.x;
        const avgY = targets.length > 0
            ? targets.reduce((s, n) => s + n.position.y, 0) / targets.length
            : groupPosition.y;
        const first = ports[0];
        const constraints = first.constraints ?? {};
        sliderNodes.push({
            id: sliderId,
            position: { x: Math.round(avgX - 260), y: Math.round(avgY) },
            data: {
                label: first.label ?? 'Slider',
                type: 'slider',
                value: first.defaultValue ?? 0,
                ...(constraints.min !== undefined ? { min: constraints.min } : {}),
                ...(constraints.max !== undefined ? { max: constraints.max } : {}),
                ...(constraints.step !== undefined ? { step: constraints.step } : {}),
            },
        });
        for (const port of ports) {
            const parsed = parseSliderPort(port.portId)!;
            sliderFeeds.push({
                id: generateEdgeId(),
                source: sliderId,
                sourceHandle: parsed.sourceHandle,
                target: port.innerNodeId,
                targetHandle: port.innerHandle,
                type: 'magnetic',
                data: { pathType: 'bezier' },
            });
        }
    }

    const forward: Transaction[] = [
        ...touching.map((e) => ({ type: 'DISCONNECT' as const, payload: e.id })),
        { type: 'REMOVE_NODE' as const, payload: groupId },
        ...subGraph.nodes.map((n) => ({
            type: 'ADD_NODE' as const,
            payload: { id: n.id, type: n.type, position: { ...n.position }, data: cloneJson(n.data ?? {}) },
        })),
        ...sliderNodes.map((n) => ({
            type: 'ADD_NODE' as const,
            payload: { id: n.id, type: SLIDER_TYPE, position: { ...n.position }, data: cloneJson(n.data) },
        })),
        ...subGraph.edges.map((e) => ({ type: 'CONNECT' as const, payload: cloneJson(e) })),
        ...restored.map((e) => ({ type: 'CONNECT' as const, payload: { ...e } })),
        ...sliderFeeds.map((e) => ({ type: 'CONNECT' as const, payload: { ...e } })),
    ];
    const createdNodeIds = [...subGraph.nodes.map((n) => n.id), ...sliderNodes.map((n) => n.id)];
    const createdEdgeIds = [...subGraph.edges.map((e) => e.id), ...restored.map((e) => e.id), ...sliderFeeds.map((e) => e.id)];
    const inverse: Transaction[] = [
        ...createdEdgeIds.map((id) => ({ type: 'DISCONNECT' as const, payload: id })),
        ...createdNodeIds.map((id) => ({ type: 'REMOVE_NODE' as const, payload: id })),
        {
            type: 'ADD_NODE' as const,
            payload: {
                id: groupId,
                type: 'group',
                position: { ...groupPosition },
                data: { ...cloneJson(groupData), handles: hydrateGroupPorts(boundary) },
            },
        },
        ...touching.map((e) => ({ type: 'CONNECT' as const, payload: cloneJson(e) })),
    ];

    return { forward, inverse, restored: restored.length, dropped };
}

export function buildCommitTransactions(args: {
    groupId: string;
    original: { subGraph: SubGraph; boundary: GroupNodeData['boundary']; compiled?: GroupNodeData['compiled'] };
    next: { subGraph: SubGraph; boundary: GroupNodeData['boundary']; compiled?: GroupNodeData['compiled'] };
    mainEdges: LiteEdge[];
}): { forward: Transaction[]; inverse: Transaction[]; changed: boolean; disconnectCount: number } {
    const { groupId, original, next, mainEdges } = args;
    const nextInputs = new Set(next.boundary.inputs.map((p) => p.portId));
    const nextOutputs = new Set(next.boundary.outputs.map((p) => p.portId));
    const stale = mainEdges.filter(
        (e) =>
            (e.target === groupId && !nextInputs.has(e.targetHandle || '')) ||
            (e.source === groupId && !nextOutputs.has(e.sourceHandle || ''))
    );
    const changed =
        stale.length > 0 ||
        !deepEqual(original.subGraph, next.subGraph) ||
        !deepEqual(original.boundary, next.boundary);

    const forward: Transaction[] = [
        {
            type: 'UPDATE_NODE_DATA' as const,
            payload: {
                id: groupId,
                data: {
                    subGraph: cloneJson(next.subGraph),
                    boundary: cloneJson(next.boundary),
                    handles: hydrateGroupPorts(next.boundary),
                },
            },
        },
        ...stale.map((e) => ({ type: 'DISCONNECT' as const, payload: e.id })),
    ];
    // F1 diff-inverse: forward stays a full replace, but the inverse only
    // carries the node delta against the committed state — deleted/modified
    // nodes restore their previous full text via `put`, added nodes drop by
    // id via `remove`, boundary/compiled restore the previous version.
    // `edges` rides along only when the edge set changed. Applied through
    // the existing BATCH executor (PATCH_SUBGRAPH in TransactionManager).
    const origById = new Map(original.subGraph.nodes.map((n) => [n.id, n]));
    const nextById = new Map(next.subGraph.nodes.map((n) => [n.id, n]));
    const put: LeanNode[] = [];
    const remove: string[] = [];
    for (const [id, prev] of origById) {
        const curr = nextById.get(id);
        if (!curr || !deepEqual(prev, curr)) put.push(cloneJson(prev));
    }
    for (const id of nextById.keys()) {
        if (!origById.has(id)) remove.push(id);
    }
    const inversePatch: Record<string, unknown> = {
        id: groupId,
        put,
        remove,
        boundary: cloneJson(original.boundary),
    };
    if (original.compiled !== undefined) inversePatch.compiled = cloneJson(original.compiled);
    if (!deepEqual(original.subGraph.edges, next.subGraph.edges)) {
        inversePatch.edges = cloneJson(original.subGraph.edges);
    }
    const inverse: Transaction[] = [
        { type: 'PATCH_SUBGRAPH' as const, payload: inversePatch },
        ...stale.map((e) => ({ type: 'CONNECT' as const, payload: cloneJson(e) })),
    ];
    return { forward, inverse, changed, disconnectCount: stale.length };
}

/** Recompute the boundary from scope-view portal wiring (commit path). */
export function deriveBoundaryFromPortalEdges(args: {
    portalInId: string;
    portalOutId: string;
    portalEdges: LiteEdge[];
    meta: GroupNodeData['boundary'];
}): GroupNodeData['boundary'] {
    const { portalInId, portalOutId, portalEdges, meta } = args;
    const metaByPort = new Map([
        ...meta.inputs.map((p) => [p.portId, p] as const),
        ...meta.outputs.map((p) => [p.portId, p] as const),
    ]);
    const used = new Set<string>();
    const inputs: BoundaryPort[] = [];
    const outputs: BoundaryPort[] = [];
    for (const e of portalEdges) {
        const isIn = e.source === portalInId;
        const isOut = e.target === portalOutId;
        if (!isIn && !isOut) continue;
        const portId = (isIn ? e.sourceHandle : e.targetHandle) || '';
        if (!portId) continue;
        const innerNodeId = isIn ? e.target : e.source;
        const innerHandle = (isIn ? e.targetHandle : e.sourceHandle) || '';
        if (!innerNodeId || !innerHandle || innerNodeId === portalInId || innerNodeId === portalOutId) continue;
        const base = metaByPort.get(portId);
        const pid = uniquePortId(portId, used, innerNodeId, innerHandle);
        const port: BoundaryPort = {
            portId: pid,
            innerNodeId,
            innerHandle,
            dataType: base?.dataType ?? 'scalar',
            ...(base?.label !== undefined ? { label: base.label } : {}),
            ...(base?.defaultValue !== undefined ? { defaultValue: base.defaultValue } : {}),
            ...(base?.constraints !== undefined ? { constraints: { ...base.constraints } } : {}),
        };
        if (isIn) inputs.push(port);
        else outputs.push(port);
    }
    return { inputs, outputs };
}

// ─── Drill scope state ──────────────────────────────────────────────────────

// Module-level drill flag (event-time reads only, never rendered).
// The palette lives in Body while drill state lives in FlowCanvas's
// useGroupActions, so the spawn path (useNodeSpawner) checks this instead of
// prop-drilling React state. Set/cleared exactly where setDrill runs.
let activeScopeDrillId: string | null = null;

/** Scope-mode group id, or null on the main canvas. */
export function getActiveScopeDrillId(): string | null {
    return activeScopeDrillId;
}

/** True while drilled into a group (palette must route into the draft). */
export function isScopeDrillActive(): boolean {
    return activeScopeDrillId !== null;
}

export interface DrillState {
    groupId: string;
    label: string;
    original: { subGraph: SubGraph; boundary: GroupNodeData['boundary'] };
}

// ─── Scope spawn (F2) ───────────────────────────────────────────────────────

export interface ScopeDraftSpawnArgs {
    type: string;
    label: string;
    extraData?: unknown;
    position: { x: number; y: number };
}

/**
 * Pure scope-spawn builder (F2): same node assembly as useNodeSpawner
 * (definition label/defaultData/definitionId, generated id) but returns a
 * view-local draft node — no Brain transaction, no history. The exit commit
 * writes it back; undo of the commit removes it via the PATCH_SUBGRAPH
 * diff-inverse. Coordinates are scope-local (caller projects screen→flow
 * while the scope viewport is active). D2: frame/group are rejected so a
 * subGraph can never nest.
 */
export function buildScopeDraftNode(args: ScopeDraftSpawnArgs): Node | null {
    const { type, label, extraData, position } = args;
    if (!type || FORBIDDEN_INNER_TYPES.has(type)) return null;
    const newId = generateNodeId(type);
    const nodeDef = NODE_DEFINITIONS.find((d) => d.id === type);
    return {
        id: newId,
        type: type || 'baseNode',
        position: { ...position },
        selected: true,
        draggable: nodeDef?.draggable,
        data: {
            label,
            type: type === 'baseNode' ? undefined : type,
            ...(nodeDef?.defaultData || {}),
            ...((extraData as Record<string, unknown> | undefined) ?? {}),
            definitionId: type,
            ...(nodeDef?.label ? { label: nodeDef.label } : {}),
        },
    } as Node;
}

function buildScopeView(
    groupId: string,
    subGraph: SubGraph,
    boundary: GroupNodeData['boundary']
): { nodes: Node[]; edges: Edge[] } {
    const xs = subGraph.nodes.map((n) => n.position.x);
    const ys = subGraph.nodes.map((n) => n.position.y);
    const minX = xs.length > 0 ? Math.min(...xs) : 0;
    const maxX = xs.length > 0 ? Math.max(...xs) : 400;
    const midY = ys.length > 0 ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
    const inId = portalInId(groupId);
    const outId = portalOutId(groupId);
    const subIds = new Set(subGraph.nodes.map((n) => n.id));

    const nodes: Node[] = [
        ...subGraph.nodes.map(
            (n) =>
                ({
                    id: n.id,
                    type: n.type,
                    position: { ...n.position },
                    data: cloneJson(n.data ?? {}),
                    selected: false,
                }) as Node
        ),
        {
            id: inId,
            type: 'baseNode',
            position: { x: minX - 300, y: midY - 40 },
            data: {
                label: 'Group Input',
                [PORTAL_FLAG]: 'in',
                handles: boundary.inputs.map((p) => ({
                    id: p.portId,
                    type: 'source',
                    variant: 'single',
                    dataType: p.dataType ?? 'scalar',
                    label: p.label ?? p.portId,
                })),
            },
            selected: false,
        } as unknown as Node,
        {
            id: outId,
            type: 'baseNode',
            position: { x: maxX + 140, y: midY - 40 },
            data: {
                label: 'Group Output',
                [PORTAL_FLAG]: 'out',
                handles: boundary.outputs.map((p) => ({
                    id: p.portId,
                    type: 'target',
                    variant: 'single',
                    dataType: p.dataType ?? 'scalar',
                    label: p.label ?? p.portId,
                })),
            },
            selected: false,
        } as unknown as Node,
    ];

    const usedEdgeIds = new Set<string>();
    const portalEdge = (idBase: string, edge: Omit<Edge, 'id'>): Edge => {
        let id = idBase;
        let n = 2;
        while (usedEdgeIds.has(id)) id = `${idBase}__${n++}`;
        usedEdgeIds.add(id);
        return { ...edge, id } as Edge;
    };
    const edges: Edge[] = [
        ...subGraph.edges.map(
            (e) =>
                ({
                    id: e.id,
                    source: e.source,
                    sourceHandle: e.sourceHandle || null,
                    target: e.target,
                    targetHandle: e.targetHandle || null,
                    type: 'magnetic',
                    data: { pathType: 'bezier' },
                }) as Edge
        ),
    ];
    for (const p of boundary.inputs) {
        if (!subIds.has(p.innerNodeId)) continue;
        edges.push(
            portalEdge(`__gpe_${p.portId}`, {
                source: inId,
                sourceHandle: p.portId,
                target: p.innerNodeId,
                targetHandle: p.innerHandle,
                type: 'magnetic',
                data: { pathType: 'bezier' },
            } as Omit<Edge, 'id'>)
        );
    }
    for (const p of boundary.outputs) {
        if (!subIds.has(p.innerNodeId)) continue;
        edges.push(
            portalEdge(`__gpe_${p.portId}`, {
                source: p.innerNodeId,
                sourceHandle: p.innerHandle,
                target: outId,
                targetHandle: p.portId,
                type: 'magnetic',
                data: { pathType: 'bezier' },
            } as Omit<Edge, 'id'>)
        );
    }
    return { nodes, edges };
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useGroupActions(options: { isReadOnly?: boolean } = {}) {
    const { isReadOnly = false } = options;
    const { getNodes, getEdges, setNodes, setEdges, screenToFlowPosition } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore((s) => s.push);
    const [drill, setDrill] = useState<DrillState | null>(null);

    const groupSelected = useCallback((): boolean => {
        if (isReadOnly || drill) return false;
        const nodes = getNodes() as LiteNode[];
        const edges = getEdges() as LiteEdge[];
        const selectedIds = nodes.filter((n) => (n as Node).selected).map((n) => n.id);
        const groupId = generateNodeId('group');
        const built = buildGroupTransactions({ nodes, edges, selectedIds, groupId });
        if ('error' in built) return false;
        const result = brain.applyTransaction({ type: 'BATCH', payload: built.forward });
        if (!result.success) return false;
        pushHistory({
            id: `group_${Date.now()}`,
            description: `Group ${selectedIds.length} node(s)`,
            forward: built.forward,
            inverse: built.inverse,
        });
        return true;
    }, [isReadOnly, drill, getNodes, getEdges, brain, pushHistory]);

    const ungroupSelected = useCallback((): boolean => {
        if (isReadOnly || drill) return false;
        const nodes = getNodes();
        const targets = nodes.filter((n) => n.selected && n.type === 'group');
        if (targets.length === 0) return false;
        const mainEdges = getEdges() as LiteEdge[];
        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];
        let restored = 0;
        for (const target of targets) {
            const logic = brain.getNode(target.id);
            const data = asGroupData(logic?.data);
            if (!data) return false;
            const built = buildUngroupTransactions({
                groupId: target.id,
                groupPosition: { ...target.position },
                groupData: data,
                mainEdges,
            });
            forward.push(...built.forward);
            // Undo applies in reverse order across groups.
            inverse.unshift(...built.inverse);
            restored += built.restored;
        }
        void restored;
        const result = brain.applyTransaction({ type: 'BATCH', payload: forward });
        if (!result.success) return false;
        pushHistory({
            id: `ungroup_${Date.now()}`,
            description: `Ungroup ${targets.length} group(s)`,
            forward,
            inverse,
        });
        return true;
    }, [isReadOnly, drill, getNodes, getEdges, brain, pushHistory]);

    const enterGroup = useCallback(
        (groupId?: string): boolean => {
            if (isReadOnly || drill) return false;
            const nodes = getNodes();
            const id = groupId ?? nodes.find((n) => n.selected && n.type === 'group')?.id;
            if (!id) return false;
            const logic = brain.getNode(id);
            const data = asGroupData(logic?.data);
            if (!data) return false;
            const label = typeof logic?.data?.label === 'string' ? logic.data.label : 'Group';
            const original = cloneJson({ subGraph: data.subGraph, boundary: data.boundary });
            const view = buildScopeView(id, data.subGraph, data.boundary);
            setNodes(view.nodes as Node[]);
            setEdges(view.edges as Edge[]);
            setDrill({ groupId: id, label, original });
            activeScopeDrillId = id;
            return true;
        },
        [isReadOnly, drill, getNodes, brain, setNodes, setEdges]
    );

    const restoreMainView = useCallback(() => {
        // No Brain change on this path, so no graphChanged fires: rebuild the
        // main view from the Brain truth directly (same merger as the sync).
        const brainNodes = brain.getNodesMap();
        setNodes((current) => applyFullSync(current, brainNodes, { recentlyAddedNodes: new Map() }));
        setEdges([...brain.getEdges()]);
    }, [brain, setNodes, setEdges]);

    const exitGroup = useCallback(
        (commit = true): boolean => {
            if (!drill || isReadOnly) return false;
            if (!commit) {
                setDrill(null);
                activeScopeDrillId = null;
                restoreMainView();
                return true;
            }
            const viewNodes = getNodes();
            const viewEdges = getEdges();
            const scopeNodes = viewNodes.filter((n) => !isPortalNode(n));
            const inId = portalInId(drill.groupId);
            const outId = portalOutId(drill.groupId);
            const portalEdges = (viewEdges as LiteEdge[]).filter(
                (e) => e.source === inId || e.target === outId
            );
            const nextSubGraph: SubGraph = {
                nodes: scopeNodes.map((n) => ({
                    id: n.id,
                    type: n.type || 'baseNode',
                    position: { ...n.position },
                    data: cloneJson(stripTransient((n.data ?? {}) as Record<string, unknown>)),
                })),
                edges: (viewEdges as LiteEdge[])
                    .filter((e) => !isPortalNode({ id: e.source }) && !isPortalNode({ id: e.target }))
                    .map(
                        (e): LeanEdge => ({
                            id: e.id,
                            source: e.source,
                            sourceHandle: e.sourceHandle || '',
                            target: e.target,
                            targetHandle: e.targetHandle || '',
                        })
                    ),
            };
            const nextBoundary = deriveBoundaryFromPortalEdges({
                portalInId: inId,
                portalOutId: outId,
                portalEdges,
                meta: drill.original.boundary,
            });
            const built = buildCommitTransactions({
                groupId: drill.groupId,
                original: drill.original,
                next: { subGraph: nextSubGraph, boundary: nextBoundary },
                mainEdges: brain.getEdges() as LiteEdge[],
            });
            if (!built.changed) {
                setDrill(null);
                activeScopeDrillId = null;
                restoreMainView();
                return true;
            }
            const result = brain.applyTransaction({ type: 'BATCH', payload: built.forward });
            if (!result.success) return false;
            pushHistory({
                id: `group_edit_${Date.now()}`,
                description: `Edit Group ${drill.label}`,
                forward: built.forward,
                inverse: built.inverse,
            });
            // graphChanged from the commit restores the main view via the sync.
            setDrill(null);
            activeScopeDrillId = null;
            return true;
        },
        [drill, isReadOnly, getNodes, getEdges, brain, pushHistory, restoreMainView]
    );

    /**
     * F2 scope spawn (hook entry): append a draft node to the scope view.
     * View-local only — no Brain transaction, no history; the exit commit
     * writes it back and the PATCH_SUBGRAPH inverse removes it on undo.
     * `screenPos` is projected scope-local (the scope viewport is active).
     */
    const drillSpawnNode = useCallback(
        (
            type: string,
            label: string,
            extraData?: unknown,
            screenPos?: { x: number; y: number }
        ): Node | null => {
            if (!drill || isReadOnly) return null;
            const flowPos = screenPos
                ? screenToFlowPosition({ x: screenPos.x, y: screenPos.y })
                : { x: 0, y: 0 };
            const draft = buildScopeDraftNode({ type, label, extraData, position: flowPos });
            if (!draft) return null;
            setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), draft]);
            return draft;
        },
        [drill, isReadOnly, screenToFlowPosition, setNodes]
    );

    const drillDeleteSelected = useCallback((): boolean => {
        if (!drill) return false;
        const selected = getNodes().filter((n) => n.selected && !isPortalNode(n));
        if (selected.length === 0) return false;
        const ids = new Set(selected.map((n) => n.id));
        setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
        setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
        return true;
    }, [drill, getNodes, setNodes, setEdges]);

    const drillConnect = useCallback(
        (connection: Connection): Edge | null => {
            if (!drill) return null;
            if (!connection.source || !connection.target) return null;
            if (!connection.sourceHandle || !connection.targetHandle) return null;
            if (connection.source === connection.target) return null;
            const nodesById = new Map(getNodes().map((n) => [n.id, n]));
            if (!nodesById.has(connection.source) || !nodesById.has(connection.target)) return null;
            // Portal-to-portal wires carry no meaning; portals wire to inner nodes only.
            if (isPortalNode({ id: connection.source }) && isPortalNode({ id: connection.target })) return null;
            const edge: Edge = {
                id: generateEdgeId(),
                source: connection.source,
                sourceHandle: connection.sourceHandle,
                target: connection.target,
                targetHandle: connection.targetHandle,
                type: 'magnetic',
                data: { pathType: 'bezier' },
            };
            setEdges((eds) => addEdge(edge, eds));
            return edge;
        },
        [drill, getNodes, setEdges]
    );

    return { drill, groupSelected, ungroupSelected, enterGroup, exitGroup, drillSpawnNode, drillDeleteSelected, drillConnect };
}

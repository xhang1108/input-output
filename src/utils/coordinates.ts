/**
 * Coordinate contract for the graph.
 *
 * Single source of truth:
 * - `position` is always the node's TOP-LEFT in its parent's coordinate space.
 * - A root node (no `parentId`) stores world (flow) coordinates.
 * - A child stores parent-local coordinates.
 * - World coordinates are derived, never persisted.
 *
 * Do not re-implement this math in hooks/components. Use these helpers or
 * React Flow's `internals.positionAbsolute` (which follows the same rule).
 *
 * Scope: origins only. Width/height and frame bounds are not part of this
 * contract; callers that need boxes combine positions with measured sizes.
 */

export interface CoordinatePoint {
    x: number;
    y: number;
}

export interface CoordinateNode {
    id: string;
    position: CoordinatePoint;
    parentId?: string | null;
}

export type HierarchyIssueCode =
    | 'duplicate-id'
    | 'missing-parent'
    | 'self-parent'
    | 'cycle'
    | 'max-depth-exceeded';

export interface HierarchyIssue {
    code: HierarchyIssueCode;
    nodeId: string;
    message: string;
    parentId?: string;
}

export interface ValidateHierarchyOptions {
    /**
     * Maximum allowed depth. Roots are depth 0, direct children depth 1.
     * Frame mode uses `1` (single level). Omit for unlimited.
     */
    maxDepth?: number;
}

/**
 * Absolute (world) position of a node, following top-left semantics.
 *
 * Broken data is tolerated so UI code never hangs:
 * - unknown id -> {0,0}
 * - missing parent -> the node's local position is treated as absolute
 * - cycle -> stops before re-adding a node (partial sum of unique nodes)
 *
 * Use `validateHierarchy` to surface these problems.
 */
export function toAbsolute(
    nodes: ReadonlyMap<string, CoordinateNode>,
    id: string
): CoordinatePoint {
    let current = nodes.get(id);
    if (!current) return { x: 0, y: 0 };

    let x = 0;
    let y = 0;
    const seen = new Set<string>();

    while (current) {
        // Broken data guard: stop before adding the same node twice.
        if (seen.has(current.id)) break;
        seen.add(current.id);

        x += current.position.x;
        y += current.position.y;

        if (!current.parentId) break;
        current = nodes.get(current.parentId);
    }

    return { x, y };
}

/**
 * Converts a world position to the node's parent-local position
 * (the value stored in `node.position`). Roots, self-parented nodes and
 * nodes whose parent is missing return `absolute` unchanged.
 */
export function toParentLocal(
    nodes: ReadonlyMap<string, CoordinateNode>,
    id: string,
    absolute: CoordinatePoint
): CoordinatePoint {
    const node = nodes.get(id);
    if (
        !node ||
        !node.parentId ||
        node.parentId === id ||
        !nodes.has(node.parentId)
    ) {
        return { x: absolute.x, y: absolute.y };
    }

    const parentAbs = toAbsolute(nodes, node.parentId);
    return {
        x: absolute.x - parentAbs.x,
        y: absolute.y - parentAbs.y,
    };
}

/**
 * Local position for moving `id` under `newParentId` while keeping its world
 * position. Returns `undefined` when the reparent is invalid:
 * unknown node/parent, self-parent, or a parent that is the node's descendant.
 * `newParentId = null/undefined` detaches; the result is `absolute`.
 */
export function reparentPosition(
    nodes: ReadonlyMap<string, CoordinateNode>,
    id: string,
    newParentId: string | null | undefined,
    absolute: CoordinatePoint
): CoordinatePoint | undefined {
    if (!newParentId) {
        return { x: absolute.x, y: absolute.y };
    }

    if (
        newParentId === id ||
        !nodes.has(id) ||
        !nodes.has(newParentId) ||
        isDescendant(nodes, newParentId, id)
    ) {
        return undefined;
    }

    const parentAbs = toAbsolute(nodes, newParentId);
    return {
        x: absolute.x - parentAbs.x,
        y: absolute.y - parentAbs.y,
    };
}

/** Builds an id lookup for helpers that take a `ReadonlyMap`. */
export function indexNodes<T extends CoordinateNode>(
    nodes: readonly T[]
): Map<string, T> {
    return new Map(nodes.map(node => [node.id, node]));
}

/**
 * Depth in the hierarchy: root = 0, direct child = 1.
 * Returns -1 for unknown nodes, cycles, or a broken parent chain.
 */
export function depthOf(
    nodes: ReadonlyMap<string, CoordinateNode>,
    id: string
): number {
    let current = nodes.get(id);
    if (!current) return -1;

    let depth = 0;
    const seen = new Set<string>();

    while (current) {
        if (seen.has(current.id)) return -1;
        seen.add(current.id);

        if (!current.parentId) return depth;

        const parent = nodes.get(current.parentId);
        if (!parent) return -1;

        depth++;
        current = parent;
    }

    return -1;
}

/**
 * True when `nodeId` is a descendant of `ancestorId` (cycle-safe).
 * @param nodeId candidate descendant
 * @param ancestorId expected ancestor
 */
export function isDescendant(
    nodes: ReadonlyMap<string, CoordinateNode>,
    nodeId: string,
    ancestorId: string
): boolean {
    if (nodeId === ancestorId) return false;

    const seen = new Set<string>();
    let currentId = nodes.get(nodeId)?.parentId ?? undefined;

    while (currentId) {
        if (currentId === ancestorId) return true;
        if (seen.has(currentId)) return false;
        seen.add(currentId);
        currentId = nodes.get(currentId)?.parentId ?? undefined;
    }

    return false;
}

/**
 * Depth used only for ordering. Unlike `depthOf`, a missing parent is treated
 * as the top of that node's local subtree, so an orphan chain still stays
 * parent-first (orphan before its child).
 */
function orderingDepth(
    nodes: ReadonlyMap<string, CoordinateNode>,
    id: string
): number {
    let current = nodes.get(id);
    if (!current) return -1;

    let depth = 0;
    const seen = new Set<string>();

    while (current) {
        if (seen.has(current.id)) return -1;
        seen.add(current.id);

        if (!current.parentId) return depth;

        const parent = nodes.get(current.parentId);
        if (!parent) return depth;

        depth++;
        current = parent;
    }

    return -1;
}

/**
 * Stable parent-first ordering (roots first, then children by depth).
 * Invalid nodes (unknown / cycle) are placed last.
 */
export function sortParentFirst<T extends CoordinateNode>(nodes: readonly T[]): T[] {
    const lookup = new Map<string, CoordinateNode>();
    nodes.forEach(node => lookup.set(node.id, node));

    return nodes
        .map((node, index) => ({
            node,
            index,
            depth: orderingDepth(lookup, node.id),
        }))
        .sort((a, b) => {
            const depthA = a.depth < 0 ? Number.MAX_SAFE_INTEGER : a.depth;
            const depthB = b.depth < 0 ? Number.MAX_SAFE_INTEGER : b.depth;
            return depthA - depthB || a.index - b.index;
        })
        .map(entry => entry.node);
}

/**
 * Returns the selected nodes that have no selected ancestor.
 * Moving/scaling only these roots is enough: React Flow renders children
 * relative to their parent, so they follow without a second position write.
 */
export function getEffectiveRoots<T extends CoordinateNode>(
    nodes: readonly T[],
    selectedIds: ReadonlySet<string>
): T[] {
    const lookup = new Map(nodes.map(node => [node.id, node]));

    return nodes.filter(node => {
        if (!selectedIds.has(node.id)) return false;

        let current = node.parentId ? lookup.get(node.parentId) : undefined;
        const seen = new Set<string>();

        while (current) {
            if (current.id === node.id) break; // self-parent: treat as root
            if (selectedIds.has(current.id)) return false;
            if (seen.has(current.id)) break;
            seen.add(current.id);
            current = current.parentId ? lookup.get(current.parentId) : undefined;
        }

        return true;
    });
}

export interface HierarchySanitizeResult<T extends CoordinateNode> {
    /** Nodes in input order; repaired nodes have a world position and no parent. */
    nodes: T[];
    /** One issue per repaired node, in repair order. */
    issues: HierarchyIssue[];
}

/**
 * Repairs broken parent links so a hierarchy can be loaded safely.
 *
 * A node is detached (converted to its world position, `parentId` cleared) when
 * its link is a self-parent, an orphan (`parentId` not present), part of a
 * cycle, or deeper than `maxDepth`. Valid nodes are returned untouched.
 *
 * World positions come from `toAbsolute`, so this stays the single place that
 * implements the top-left parent+local math. Never throws.
 */
export function sanitizeHierarchy<T extends CoordinateNode>(
    nodes: readonly T[],
    options: ValidateHierarchyOptions = {}
): HierarchySanitizeResult<T> {
    const rawLookup = new Map<string, CoordinateNode>();
    for (const node of nodes) {
        if (!rawLookup.has(node.id)) rawLookup.set(node.id, node);
    }

    const issues: HierarchyIssue[] = [];
    const detached = new Set<string>();

    const detach = (
        node: CoordinateNode,
        issue: Omit<HierarchyIssue, 'nodeId'>
    ) => {
        if (detached.has(node.id)) return;
        detached.add(node.id);
        issues.push({ ...issue, nodeId: node.id });
    };

    for (const node of nodes) {
        if (!node.parentId) continue;

        if (node.parentId === node.id) {
            detach(node, {
                code: 'self-parent',
                parentId: node.parentId,
                message: `Node "${node.id}" is its own parent.`,
            });
        } else if (!rawLookup.has(node.parentId)) {
            detach(node, {
                code: 'missing-parent',
                parentId: node.parentId,
                message: `Node "${node.id}" references missing parent "${node.parentId}".`,
            });
        }
    }

    // Cycles: collect each unique loop, then detach every member. Detaching all
    // of them (rather than one edge) keeps the result cycle-free and flat.
    const cycles: string[][] = [];
    const reportedCycles = new Set<string>();

    for (const node of nodes) {
        if (!node.parentId || node.parentId === node.id) continue;

        const chain: string[] = [];
        const indexById = new Map<string, number>();
        let currentId: string | undefined = node.id;

        while (currentId) {
            const cycleStart = indexById.get(currentId);
            if (cycleStart !== undefined) {
                const cycle = chain.slice(cycleStart);
                const key = JSON.stringify([...cycle].sort());
                if (!reportedCycles.has(key)) {
                    reportedCycles.add(key);
                    cycles.push(cycle);
                }
                break;
            }

            indexById.set(currentId, chain.length);
            chain.push(currentId);
            currentId = rawLookup.get(currentId)?.parentId ?? undefined;
        }
    }

    for (const cycle of cycles) {
        const sorted = [...cycle].sort();
        const message = `Cycle detected: ${[...sorted, sorted[0]].join(' -> ')}.`;
        for (const id of cycle) {
            const node = rawLookup.get(id);
            if (node) {
                detach(node, {
                    code: 'cycle',
                    parentId: node.parentId ?? undefined,
                    message,
                });
            }
        }
    }

    if (options.maxDepth !== undefined) {
        const maxDepth = options.maxDepth;
        const resolved = new Map<string, CoordinateNode>();
        for (const node of nodes) {
            resolved.set(
                node.id,
                detached.has(node.id)
                    ? { id: node.id, position: node.position }
                    : node
            );
        }

        for (const node of nodes) {
            if (detached.has(node.id)) continue;

            const depth = depthOf(resolved, node.id);
            if (depth <= maxDepth) continue;

            detach(node, {
                code: 'max-depth-exceeded',
                parentId: node.parentId ?? undefined,
                message: `Node "${node.id}" has depth ${depth}, exceeding maxDepth ${maxDepth}.`,
            });
            resolved.set(node.id, { id: node.id, position: node.position });
        }
    }

    const repairedPositions = new Map<string, CoordinatePoint>();
    for (const id of detached) {
        repairedPositions.set(id, toAbsolute(rawLookup, id));
    }

    const repaired = nodes.map(node => {
        const absolute = repairedPositions.get(node.id);
        if (!absolute) return node;

        return {
            ...node,
            position: { x: absolute.x, y: absolute.y },
            parentId: undefined,
        } as T;
    });

    return { nodes: repaired, issues };
}

/**
 * Validates hierarchy invariants. Never throws; returns every issue found.
 */
export function validateHierarchy(
    nodes: readonly CoordinateNode[],
    options: ValidateHierarchyOptions = {}
): HierarchyIssue[] {
    const issues: HierarchyIssue[] = [];
    const lookup = new Map<string, CoordinateNode>();
    const duplicateIds = new Set<string>();

    for (const node of nodes) {
        if (lookup.has(node.id)) {
            duplicateIds.add(node.id);
        } else {
            lookup.set(node.id, node);
        }
    }

    duplicateIds.forEach(id => {
        issues.push({
            code: 'duplicate-id',
            nodeId: id,
            message: `Duplicate node id "${id}".`,
        });
    });

    for (const node of nodes) {
        if (!node.parentId) continue;

        if (node.parentId === node.id) {
            issues.push({
                code: 'self-parent',
                nodeId: node.id,
                parentId: node.parentId,
                message: `Node "${node.id}" is its own parent.`,
            });
            continue;
        }

        if (!lookup.has(node.parentId)) {
            issues.push({
                code: 'missing-parent',
                nodeId: node.id,
                parentId: node.parentId,
                message: `Node "${node.id}" references missing parent "${node.parentId}".`,
            });
        }
    }

    const reportedCycles = new Set<string>();

    for (const node of nodes) {
        // Self-parent is reported above; do not also report it as a cycle.
        if (!node.parentId || node.parentId === node.id) continue;

        const chain: string[] = [];
        const indexById = new Map<string, number>();
        let currentId: string | undefined = node.id;

        while (currentId) {
            if (indexById.has(currentId)) {
                const cycleStart = indexById.get(currentId)!;
                const cycle = chain.slice(cycleStart);
                const sorted = [...cycle].sort();
                const key = JSON.stringify(sorted);

                if (!reportedCycles.has(key)) {
                    reportedCycles.add(key);
                    issues.push({
                        code: 'cycle',
                        nodeId: sorted[0],
                        message: `Cycle detected: ${[...sorted, sorted[0]].join(' -> ')}.`,
                    });
                }
                break;
            }

            indexById.set(currentId, chain.length);
            chain.push(currentId);
            currentId = lookup.get(currentId)?.parentId ?? undefined;
        }
    }

    if (options.maxDepth !== undefined) {
        const maxDepth = options.maxDepth;
        for (const node of nodes) {
            const depth = depthOf(lookup, node.id);
            if (depth > maxDepth) {
                issues.push({
                    code: 'max-depth-exceeded',
                    nodeId: node.id,
                    message: `Node "${node.id}" has depth ${depth}, exceeding maxDepth ${maxDepth}.`,
                });
            }
        }
    }

    return issues;
}

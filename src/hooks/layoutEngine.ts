import { Node, Edge, Position } from '@xyflow/react';

let elkInstance: any = null;

export type LayoutAlgorithm = 'layered' | 'force' | 'tree' | 'radial';
export type LayoutDirection = 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';

interface LayoutConfig {
    algorithm?: LayoutAlgorithm;
    direction?: LayoutDirection;
    spacing?: number;
}

const getOptions = (cfg: LayoutConfig = {}) => {
    const direction = cfg.direction || 'RIGHT';
    const spacing = (cfg.spacing || 80).toString();

    // Base options
    const options: Record<string, string> = {
        'elk.direction': direction,
        'elk.spacing.nodeNode': spacing,
    };

    switch (cfg.algorithm) {
        case 'force':
            // "Force Layout" (Stress)
            options['elk.algorithm'] = 'org.eclipse.elk.stress';
            options['elk.stress.desiredEdgeLength'] = '200';
            break;

        case 'tree':
            // "Tree Layout" (Mr. Tree)
            options['elk.algorithm'] = 'org.eclipse.elk.mrtree';
            options['elk.spacing.edgeNode'] = '40';
            break;

        case 'radial':
            // "Radial Layout"
            options['elk.algorithm'] = 'org.eclipse.elk.radial';
            options['elk.radial.radius'] = '300';
            break;

        case 'layered':
        default:
            // Standard Flowchart
            options['elk.algorithm'] = 'layered';
            options['elk.layered.spacing.nodeNodeBetweenLayers'] = '100';
            options['elk.layered.nodePlacement.strategy'] = 'BRANDES_KOEPF';
            break;
    }

    return options;
};

/* -------------------------------------------------------------------------
 * Frame-aware layout policy (docs/frame-integration.md §3-D8 / §4-P2)
 *
 * Coordinate contract (src/utils/coordinates.ts):
 * - `position` is the node's top-left in its PARENT's space; roots are world.
 * - ELK writes `x/y` into whatever coordinate space it is given, so a node
 *   that ELK moves must be a root (world) or a child laid out *inside* its own
 *   frame (parent-local). Never mix the two spaces in one pass.
 *
 * Two passes are supported:
 * 1. World pass (`selectLayoutNodes`): every root, including frames. A frame
 *    is handed to ELK as one sized block, so layout moves the group as a
 *    whole and never splits it. Frame children are not part of this pass.
 * 2. Inside-frame pass (`planPartialLayout().childGroups`): when the selection
 *    contains only children, ELK receives those children in parent-local
 *    coordinates; the frame itself stays put and grows if needed.
 *
 * Layout never rewrites `parentId`; the merge step only touches `position`, so
 * sizes, `data`, `measured`, `origin` and `style` survive.
 *
 * Flat graphs (no `parentId` anywhere) produce the exact same ELK input as
 * before this policy existed.
 * ---------------------------------------------------------------------- */

/** True for frame container nodes. */
export function isFrameNode(node: Pick<Node, 'type'>): boolean {
    return node.type === 'frame';
}

export interface LayoutSelectionOptions {
    /** Restrict the pass to these ids (selection-scoped layout). */
    candidateIds?: ReadonlySet<string>;
}

/**
 * World-space layout participants: roots, frames included (as sized blocks).
 * Children are excluded because their `position` is parent-local; they are
 * handled by `planPartialLayout` in their own frame's coordinate space.
 */
export function selectLayoutNodes(nodes: Node[], options: LayoutSelectionOptions = {}): Node[] {
    const { candidateIds } = options;

    return nodes.filter(node => {
        if (node.parentId) return false;
        if (candidateIds && !candidateIds.has(node.id)) return false;
        return true;
    });
}

/** Edges whose both endpoints take part in the pass (others would make ELK fail). */
export function selectLayoutEdges(edges: Edge[], layoutNodes: Node[]): Edge[] {
    const ids = new Set(layoutNodes.map(node => node.id));
    return edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
}

export interface PartialLayoutPlan {
    /** Roots (frames as blocks) laid out in world space. */
    worldNodes: Node[];
    /** Selected children grouped by their frame, laid out in local space. */
    childGroups: Array<{ frameId: string; nodes: Node[] }>;
}

/**
 * Splits a selection into the two layout passes.
 * - Selected roots are laid out in world space.
 * - A selected frame means "lay out this group": all of its children are laid
 *   out inside it (the frame itself stays put and grows if needed).
 * - Selected children are grouped by parent frame and laid out inside it.
 */
export function planPartialLayout(nodes: Node[], selectedIds: ReadonlySet<string>): PartialLayoutPlan {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const worldNodes: Node[] = [];
    const framesToFill = new Set<string>();
    const childrenByFrame = new Map<string, Node[]>();

    for (const id of selectedIds) {
        const node = byId.get(id);
        if (!node) continue;

        if (node.parentId) {
            if (!byId.has(node.parentId)) continue;
            const group = childrenByFrame.get(node.parentId) ?? [];
            group.push(node);
            childrenByFrame.set(node.parentId, group);
            continue;
        }

        if (isFrameNode(node)) {
            framesToFill.add(node.id);
            continue;
        }

        worldNodes.push(node);
    }

    // Selecting a frame lays out its whole content, even when only the frame
    // itself is selected. Children move with the frame, so the frame stays put.
    for (const frameId of framesToFill) {
        const allChildren = nodes.filter(node => node.parentId === frameId);
        if (allChildren.length === 0) continue;
        const existing = childrenByFrame.get(frameId);
        if (!existing) {
            childrenByFrame.set(frameId, allChildren);
            continue;
        }
        const seen = new Set(existing.map(n => n.id));
        allChildren.forEach(child => {
            if (!seen.has(child.id)) existing.push(child);
        });
    }

    return {
        worldNodes,
        childGroups: Array.from(childrenByFrame, ([frameId, group]) => ({ frameId, nodes: group })),
    };
}

// Map XYFlow nodes to Elk nodes. Frames rely on explicit width/height; other
// nodes prefer the measured size that React Flow reported.
const toElkNode = (node: Node): any => {
    const dataWidth = (node.data as Record<string, unknown> | undefined)?.width;
    const dataHeight = (node.data as Record<string, unknown> | undefined)?.height;
    return {
        id: node.id,
        width: node.measured?.width ?? node.width ?? (typeof dataWidth === 'number' ? dataWidth : 150),
        height: node.measured?.height ?? node.height ?? (typeof dataHeight === 'number' ? dataHeight : 100),
    };
};

// Map XYFlow edges to Elk edges
const toElkEdge = (edge: Edge): any => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
});

/**
 * ELK graph for a node set. The caller decides the participants: either the
 * world-pass roots (`selectLayoutNodes`) or one frame's children (local space).
 * Exported so the policy can be asserted without booting ELK.
 */
export function buildElkGraph(
    nodes: Node[],
    edges: Edge[],
    config: LayoutConfig = {}
): { graph: any; layoutNodes: Node[]; layoutEdges: Edge[] } {
    const layoutEdges = selectLayoutEdges(edges, nodes);

    return {
        layoutNodes: nodes,
        layoutEdges,
        graph: {
            id: 'root',
            layoutOptions: getOptions(config),
            children: nodes.map(toElkNode),
            edges: layoutEdges.map(toElkEdge),
        },
    };
}

/**
 * Merge ELK results back into the caller's node array BY ID.
 *
 * Only `position` (and the flow handle directions ELK implies) is copied.
 * Every other field — `parentId`, `width`/`height`, `data`, `style`, `origin`,
 * `measured` — comes from the incoming node, so re-layout can never drop a
 * node or detach a child.
 */
export function mergeLayoutPositions(nodes: Node[], layoutedNodes: Node[]): Node[] {
    const layoutedById = new Map(layoutedNodes.map(node => [node.id, node]));

    return nodes.map(node => {
        const layouted = layoutedById.get(node.id);
        if (!layouted) return node;

        return {
            ...node,
            position: { x: layouted.position.x, y: layouted.position.y },
            // Layout results carry the implied handle directions; keep the
            // node's own values when a caller passes a bare position patch.
            ...(layouted.sourcePosition ? { sourcePosition: layouted.sourcePosition } : {}),
            ...(layouted.targetPosition ? { targetPosition: layouted.targetPosition } : {}),
        };
    });
}

export const getLayoutedElements = async (nodes: Node[], edges: Edge[], config: LayoutConfig = {}) => {
    const { graph, layoutNodes } = buildElkGraph(nodes, edges, config);

    // Nothing layout-able (e.g. only frames): keep every node exactly as-is.
    if (layoutNodes.length === 0) {
        return { nodes, edges };
    }

    if (!elkInstance) {
        const ELK = (await import('elkjs/lib/elk.bundled.js')).default;
        elkInstance = new ELK();
    }

    try {
        const layoutedGraph = await elkInstance.layout(graph);

        const layoutedNodes = nodes.map((node) => {
            const elkNode = layoutedGraph.children?.find((n: any) => n.id === node.id);
            if (!elkNode) return node;

            return {
                ...node,
                position: {
                    x: elkNode.x!,
                    y: elkNode.y!,
                },
                // We might want to set handles direction based on overall flow if we supported multi-direction
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
            };
        });

        return { nodes: layoutedNodes, edges };
    } catch (error) {
        console.error('Elk Layout Error:', error);
        return { nodes, edges };
    }
};

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
 * Frame-aware layout policy (docs/frame-integration.md §3-D8 / §4-P2, option A)
 *
 * Coordinate contract (src/utils/coordinates.ts):
 * - `position` is the node's top-left in its PARENT's space; roots are world.
 * - ELK writes `x/y` into whatever coordinate space it is given, so any node
 *   that ELK moves must be a root. Writing ELK world coordinates into a
 *   child's parent-local `position` would drift the child by the parent's
 *   offset — that is the bug this policy prevents.
 *
 * Therefore: only ROOT, NON-FRAME nodes are handed to ELK.
 * - A frame is never moved by layout (it stays where the user put it).
 * - Frames and their children are never torn apart.
 * - Layout never rewrites `parentId`; the merge step below only touches
 *   `position`, so sizes, `data`, `measured`, `origin` and `style` survive.
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
 * Nodes ELK is allowed to move: roots that are not frames.
 * Children (any `parentId`) are excluded because their `position` is
 * parent-local, and frame containers keep their user-chosen placement.
 */
export function selectLayoutNodes(nodes: Node[], options: LayoutSelectionOptions = {}): Node[] {
    const { candidateIds } = options;

    return nodes.filter(node => {
        if (isFrameNode(node)) return false;
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

// Map XYFlow nodes to Elk nodes
const toElkNode = (node: Node): any => ({
    id: node.id,
    width: node.measured?.width ?? 150,
    height: node.measured?.height ?? 100,
});

// Map XYFlow edges to Elk edges
const toElkEdge = (edge: Edge): any => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
});

/**
 * ELK graph for a node set, already frame-filtered.
 * Exported so the policy can be asserted without booting ELK.
 */
export function buildElkGraph(
    nodes: Node[],
    edges: Edge[],
    config: LayoutConfig = {}
): { graph: any; layoutNodes: Node[]; layoutEdges: Edge[] } {
    const layoutNodes = selectLayoutNodes(nodes);
    const layoutEdges = selectLayoutEdges(edges, layoutNodes);

    return {
        layoutNodes,
        layoutEdges,
        graph: {
            id: 'root',
            layoutOptions: getOptions(config),
            children: layoutNodes.map(toElkNode),
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
 * frame or detach a child. Unknown ids and frame nodes are returned untouched.
 */
export function mergeLayoutPositions(nodes: Node[], layoutedNodes: Node[]): Node[] {
    const layoutedById = new Map(layoutedNodes.map(node => [node.id, node]));

    return nodes.map(node => {
        // Defensive: even if a frame somehow reaches ELK output, never move it.
        if (isFrameNode(node)) return node;

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

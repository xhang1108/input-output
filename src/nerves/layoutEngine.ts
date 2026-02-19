import ELK, { ElkNode, ElkPrimitiveEdge } from 'elkjs/lib/elk.bundled';
import { Node, Edge, Position } from '@xyflow/react';

const elk = new ELK();

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

// Map XYFlow nodes to Elk nodes
const toElkNode = (node: Node): ElkNode => ({
    id: node.id,
    width: node.measured?.width ?? 150,
    height: node.measured?.height ?? 100,
});

// Map XYFlow edges to Elk edges
const toElkEdge = (edge: Edge): ElkPrimitiveEdge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
});

export const getLayoutedElements = async (nodes: Node[], edges: Edge[], config: LayoutConfig = {}) => {
    const graph: ElkNode = {
        id: 'root',
        layoutOptions: getOptions(config),
        children: nodes.map(toElkNode),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edges: edges.map(toElkEdge) as any,
    };

    try {
        const layoutedGraph = await elk.layout(graph);

        const layoutedNodes = nodes.map((node) => {
            const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
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

import ELK, { ElkNode, ElkPrimitiveEdge } from 'elkjs/lib/elk.bundled';
import { Node, Edge, Position } from '@xyflow/react';

const elk = new ELK();

const layoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100', // Layer spacing (Horizontal)
    'elk.spacing.nodeNode': '60', // Sibling spacing (Vertical)
    'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
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

export const getLayoutedElements = async (nodes: Node[], edges: Edge[]) => {
    const graph: ElkNode = {
        id: 'root',
        layoutOptions: layoutOptions,
        children: nodes.map(toElkNode),
        edges: edges.map(toElkEdge) as any, // Cast to any or ElkExtendedEdge to satisfy the interface mismatch
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

"use client";

import React, { useMemo, useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, edgeTypes } from '@/config/nodeTypeMap';
import { Brain } from '@/engine/Brain';

interface CircuitDemoProps {
    iogl: {
        nodes: any[];
        edges: any[];
    };
    label?: string;
    height?: number;
}

const CircuitDemoInner: React.FC<CircuitDemoProps> = ({ iogl, label, height = 300 }) => {
    // Generate a unique namespace prefix for this demo block to prevent ID collisions with main canvas
    const namespace = useMemo(() => `demo-${Math.random().toString(36).substr(2, 6)}-`, []);

    const initialNodesStr = JSON.stringify(iogl.nodes);

    const initialNodes: Node[] = useMemo(() => {
        const nodes = initialNodesStr ? JSON.parse(initialNodesStr) : [];
        return nodes.map((n: any) => ({
            ...n,
            id: `${namespace}${n.id}`,
            data: { ...n.data },
            draggable: false
        }));
    }, [initialNodesStr, namespace]);

    const initialEdgesStr = JSON.stringify(iogl.edges);

    const initialEdges: Edge[] = useMemo(() => {
        const edges = initialEdgesStr ? JSON.parse(initialEdgesStr) : [];
        return edges.map((e: any) => ({
            ...e,
            id: `${namespace}${e.id}`,
            source: `${namespace}${e.source}`,
            target: `${namespace}${e.target}`,
        }));
    }, [initialEdgesStr, namespace]);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

    // Register the entire circuit in the singleton brain
    useEffect(() => {
        const brain = Brain.getInstance();

        // Register Nodes
        initialNodes.forEach(n => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: {
                    id: n.id,
                    type: n.type,
                    position: n.position,
                    data: n.data
                }
            });
        });

        // Register Edges
        initialEdges.forEach(e => {
            brain.applyTransaction({
                type: 'CONNECT',
                payload: e
            });
        });

        const handleGraphChange = (payload?: unknown) => {
            const updates = payload instanceof Map ? payload as Map<string, unknown> : null;
            if (updates) {
                setNodes(nds => nds.map(n => {
                    if (updates.has(n.id)) {
                        return { ...n, data: { ...n.data, value: updates.get(n.id) } };
                    }
                    return n;
                }));
            } else {
                setNodes(nds => nds.map(n => {
                    const logicNode = brain.getNode(n.id);
                    if (logicNode) {
                        return { ...n, data: { ...n.data, ...logicNode.data, value: logicNode.value } };
                    }
                    return n;
                }));
            }
        };

        const cleanup = brain.on('graphChanged', handleGraphChange);

        return () => {
            cleanup();
            // Cleanup Edges
            initialEdges.forEach(e => {
                brain.applyTransaction({
                    type: 'DISCONNECT',
                    payload: e.id
                });
            });
            // Cleanup Nodes
            initialNodes.forEach(n => {
                brain.applyTransaction({
                    type: 'REMOVE_NODE',
                    payload: { id: n.id }
                });
            });
        };
    }, [initialNodes, initialEdges, setNodes]);

    return (
        <div className="relative my-6 w-full overflow-hidden" style={{ height: `${height}px` }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes as any}
                edgeTypes={edgeTypes as any}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                panOnDrag={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
                zoomOnDoubleClick={false}
                preventScrolling={false}
                nodesDraggable={false}
                autoPanOnConnect={false}
                panOnScroll={false}
                colorMode="dark"
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
            >
            </ReactFlow>
        </div>
    );
};

export const CircuitDemo: React.FC<CircuitDemoProps> = (props) => (
    <ReactFlowProvider>
        <CircuitDemoInner {...props} />
    </ReactFlowProvider>
);

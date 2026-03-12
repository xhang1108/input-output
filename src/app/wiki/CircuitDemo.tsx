"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, edgeTypes } from '@/config/nodeTypeMap';
import { useBrain, BrainProvider } from '@/context/BrainContext';
import { WikiDemoCanvas } from './WikiDemoCanvas';

interface CircuitDemoProps {
    iogl: {
        nodes: any[];
        edges: any[];
    };
    label?: string;
    height?: number;
}

const CircuitDemoInner: React.FC<CircuitDemoProps> = ({ iogl, label, height = 300 }) => {
    const brain = useBrain();
    // Generate a unique but stable namespace prefix for this demo block
    const namespace = useMemo(() => {
        const ioglStr = JSON.stringify(iogl);
        let hash = 0;
        for (let i = 0; i < ioglStr.length; i++) {
            const char = ioglStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `demo-${Math.abs(hash).toString(36).substr(0, 6)}-`;
    }, [iogl]);

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

    // Register the entire circuit in the session brain
    useEffect(() => {

        // Register Nodes with initial dimensions from definition (if available) or existing data
        initialNodes.forEach(n => {
            brain.applyTransaction({
                type: 'ADD_NODE',
                payload: {
                    id: n.id,
                    type: n.type,
                    position: n.position,
                    width: n.width,
                    height: n.height,
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
                        const brainW = logicNode.width ?? (logicNode.data?.width as number);
                        const brainH = logicNode.height ?? (logicNode.data?.height as number);
                        
                        return { 
                            ...n, 
                            width: brainW ?? n.width,
                            height: brainH ?? n.height,
                            data: { ...n.data, ...logicNode.data, value: logicNode.value } 
                        };
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

    const [canvasHeight, setCanvasHeight] = useState(height);
    
    // Expansion Logic: Capture dimension changes of ALL nodes in the circuit to grow the container
    useEffect(() => {
        let timer: NodeJS.Timeout;

        const checkExpansion = () => {
            if (nodes.length === 0) return;

            let minY = Infinity;
            let maxY = -Infinity;
            
            nodes.forEach(node => {
                const logicNode = brain.getNode(node.id);
                const nodeHeight = logicNode?.height ?? (node.height as number) ?? node.measured?.height ?? (node.data?.height as number) ?? 100;
                const top = node.position.y || 0;
                const bottom = top + nodeHeight;
                
                if (top < minY) minY = top;
                if (bottom > maxY) maxY = bottom;
            });

            if (maxY > minY) {
                const contentHeight = maxY - minY;
                const verticalPadding = 32;
                const newHeight = contentHeight + (2 * verticalPadding);
                
                if (Math.abs(newHeight - canvasHeight) > 2) {
                    setCanvasHeight(newHeight);
                }
            }
        };

        // Simplified periodic check during drag or stable updates
        timer = setTimeout(checkExpansion, 100);
        return () => clearTimeout(timer);
    }, [nodes, canvasHeight, height]);

    return (
        <WikiDemoCanvas height={canvasHeight}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes as any}
                edgeTypes={edgeTypes as any}
                minZoom={1}
                maxZoom={1}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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
        </WikiDemoCanvas>
    );
};

export const CircuitDemo: React.FC<CircuitDemoProps> = (props) => {
    const { iogl } = props;
    // Generate a unique but stable session ID for this circuit
    const sessionId = useMemo(() => {
        const ioglStr = JSON.stringify(iogl);
        let hash = 0;
        for (let i = 0; i < ioglStr.length; i++) {
            const char = ioglStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `circuit-session-${Math.abs(hash).toString(36)}`;
    }, [iogl]);

    return (
        <BrainProvider session={sessionId}>
            <ReactFlowProvider>
                <CircuitDemoInner {...props} />
            </ReactFlowProvider>
        </BrainProvider>
    );
};

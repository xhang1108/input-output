"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Node, Edge, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/config/nodeTypeMap';
import { NODE_DEFINITIONS } from '@/definitions/nodeDefinitions';
import { useBrain, BrainProvider } from '@/context/BrainContext';
import { WikiDemoCanvas } from './WikiDemoCanvas';

const VERTICAL_PADDING = 24;

interface NodeDemoProps {
    nodeType: string; // The ID from nodeTypes, e.g., 'MA-01'
    initialData?: any;
    label?: string;
    height?: number;
}

const NodeDemoInner: React.FC<NodeDemoProps> = ({ nodeType, initialData, label, height = 80 }) => {
    const brain = useBrain();
    // Generate a stable ID based on nodeType and initialData to ensure persistence across refreshes
    const id = useMemo(() => {
        const dataStr = JSON.stringify(initialData || {});
        let hash = 0;
        const fullStr = `${nodeType}-${dataStr}-${label || ''}`;
        for (let i = 0; i < fullStr.length; i++) {
            const char = fullStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `demo-${nodeType}-${Math.abs(hash).toString(36)}`;
    }, [nodeType, initialData, label]);

    const initialDataStr = JSON.stringify(initialData);

    const initialNodes: Node[] = useMemo(() => {
        const def = NODE_DEFINITIONS.find(d => d.id === nodeType);
        return [
            {
                id,
                type: nodeType,
                position: { x: 20, y: VERTICAL_PADDING },
                data: { ...(def?.defaultData || {}), ...(initialDataStr ? JSON.parse(initialDataStr) : {}), label: label || 'Demo' },
                draggable: false
            }
        ];
    }, [id, nodeType, initialDataStr, label]);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
    const [canvasHeight, setCanvasHeight] = useState(height);

    // Expansion Logic: Capture dimension changes to grow or shrink the container
    useEffect(() => {
        let timer: NodeJS.Timeout;

        const checkExpansion = () => {
            const node = nodes.find(n => n.id === id);
            if (!node) return;

            // Authority: Logic Node > Persisted Node > Measured Node
            const logicNode = brain.getNode(id);
            const nodeHeight = logicNode?.height ?? (node?.height as number) ?? node?.measured?.height ?? (node?.data?.height as number);
            
            if (nodeHeight) {
                const newHeight = nodeHeight + (2 * VERTICAL_PADDING);
                
                if (Math.abs(newHeight - canvasHeight) > 1) { 
                    setCanvasHeight(newHeight);
                }
            }
        };

        // Simplified: Just debounce the check. Removing the isResizing block 
        // allows the container to grow smoothly during a drag if it exceeds current bounds.
        timer = setTimeout(checkExpansion, 50);

        return () => clearTimeout(timer);
    }, [nodes, id, canvasHeight, height]);

    // Register the node in the session brain if it's interactive
    useEffect(() => {
        const definition = NODE_DEFINITIONS.find(d => d.id === nodeType);

        // Mock a basic node in the engine so evaluators work if they trigger
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id,
                type: nodeType,
                position: { x: 0, y: 0 },
                width: definition?.minWidth ?? 100,
                height: definition?.minHeight ?? 40,
                data: { ...(definition?.defaultData || {}), ...initialData, label: label || definition?.label || 'Demo' }
            }
        });

        const handleGraphChange = (payload?: unknown) => {
            const updates = payload instanceof Map ? payload as Map<string, unknown> : null;
            if (updates) {
                if (updates.has(id)) {
                    setNodes(nds => nds.map(n => {
                        if (n.id === id) {
                            return { ...n, data: { ...n.data, value: updates.get(id) } };
                        }
                        return n;
                    }));
                }
            } else {
                const logicNode = brain.getNode(id);
                if (logicNode) {
                    setNodes(nds => nds.map(n => {
                        if (n.id === id) {
                            // AUTHORITY: Brain dimensions MUST override React Flow state
                            // to prevent snap-back after a resize transaction completes.
                            const brainW = logicNode.width ?? (logicNode.data?.width as number);
                            const brainH = logicNode.height ?? (logicNode.data?.height as number);
                            
                            const updatedData = { ...n.data, ...logicNode.data, value: logicNode.value } as any;
                            return { 
                                ...n, 
                                width: brainW ?? n.width,
                                height: brainH ?? n.height,
                                data: updatedData
                            };
                        }
                        return n;
                    }));
                }
            }
        };

        const cleanup = brain.on('graphChanged', handleGraphChange);

        return () => {
            cleanup();
            // We don't strictly need REMOVE_NODE if the whole session is disposed,
            // but it's good practice for partial unmounts.
            brain.applyTransaction({
                type: 'REMOVE_NODE',
                payload: { id }
            });
        };
    }, [id, nodeType, initialDataStr, label, setNodes, brain]);

    const initialEdges: Edge[] = [];

    return (
        <WikiDemoCanvas height={canvasHeight}>
            <ReactFlow
                nodes={nodes}
                onNodesChange={onNodesChange}
                edges={initialEdges}
                nodeTypes={nodeTypes as any}
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
                noDragClassName="nodrag"
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
            >
            </ReactFlow>
        </WikiDemoCanvas>
    );
};

export const NodeDemo: React.FC<NodeDemoProps> = (props) => {
    const { nodeType, initialData, label } = props;
    // Generate the same stable ID for the session name as we do for the node
    const sessionId = useMemo(() => {
        const dataStr = JSON.stringify(initialData || {});
        const fullStr = `${nodeType}-${dataStr}-${label || ''}`;
        let hash = 0;
        for (let i = 0; i < fullStr.length; i++) {
            const char = fullStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `demo-session-${nodeType}-${Math.abs(hash).toString(36)}`;
    }, [nodeType, initialData, label]);

    return (
        <BrainProvider session={sessionId}>
            <ReactFlowProvider>
                <NodeDemoInner {...props} />
            </ReactFlowProvider>
        </BrainProvider>
    );
};

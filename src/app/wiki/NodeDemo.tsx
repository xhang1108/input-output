"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Node, Edge, useNodesState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/config/nodeTypeMap';
import { NODE_DEFINITIONS } from '@/definitions/nodeDefinitions';
import { Brain } from '@/engine/Brain';

interface NodeDemoProps {
    nodeType: string; // The ID from nodeTypes, e.g., 'MA-01'
    initialData?: any;
    label?: string;
    height?: number;
}

const NodeDemoInner: React.FC<NodeDemoProps> = ({ nodeType, initialData, label, height = 240 }) => {
    const id = useMemo(() => `demo-${nodeType}-${Math.random().toString(36).substr(2, 9)}`, [nodeType]);

    const initialDataStr = JSON.stringify(initialData);

    const initialNodes: Node[] = useMemo(() => {
        const def = NODE_DEFINITIONS.find(d => d.id === nodeType);
        return [
            {
                id,
                type: nodeType,
                position: { x: 10, y: 10 },
                data: { ...(def?.defaultData || {}), ...(initialDataStr ? JSON.parse(initialDataStr) : {}), label: label || 'Demo' },
                draggable: false
            }
        ];
    }, [id, nodeType, initialDataStr, label]);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);

    // Register the node in the singleton brain if it's interactive
    useEffect(() => {
        const brain = Brain.getInstance();
        const definition = NODE_DEFINITIONS.find(d => d.id === nodeType);

        // Mock a basic node in the engine so evaluators work if they trigger
        brain.applyTransaction({
            type: 'ADD_NODE',
            payload: {
                id,
                type: nodeType,
                position: { x: 0, y: 0 },
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
                            // Merge all updated data fields to ensure UI (dropdowns, etc) updates
                            return { ...n, data: { ...n.data, ...logicNode.data, value: logicNode.value } };
                        }
                        return n;
                    }));
                }
            }
        };

        const cleanup = brain.on('graphChanged', handleGraphChange);

        return () => {
            cleanup();
            brain.applyTransaction({
                type: 'REMOVE_NODE',
                payload: { id }
            });
        };
    }, [id, nodeType, initialDataStr, label, setNodes]);

    const initialEdges: Edge[] = [];

    return (
        <div className="relative my-6" style={{ height: `${height}px`, width: '100%', maxWidth: '400px' }}>
            <ReactFlow
                nodes={nodes}
                onNodesChange={onNodesChange}
                edges={initialEdges}
                nodeTypes={nodeTypes as any}
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
        </div>
    );
};

export const NodeDemo: React.FC<NodeDemoProps> = (props) => (
    <ReactFlowProvider>
        <NodeDemoInner {...props} />
    </ReactFlowProvider>
);

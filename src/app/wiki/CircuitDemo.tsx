"use client";

import React, { useMemo, useEffect, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Node, Edge, useNodesState, useEdgesState } from '@xyflow/react';
// P2-8: no per-component style.css import — src/app/globals.css:2 is the single source.
import { nodeTypes, edgeTypes } from '@/constants/nodeTypeMap';
import { useBrain, BrainProvider } from '@/context/BrainContext';
import { WikiDemoCanvas } from './WikiDemoCanvas';
import { PayloadUtils } from '@/utils/PayloadUtils';

interface CircuitDemoProps {
    iogl: {
        nodes: any[];
        edges: any[];
    };
    label?: string;
    height?: number;
}

const CircuitDemoInner: React.FC<CircuitDemoProps> = React.memo(({ iogl, label, height = 300 }) => {
    const brain = useBrain();
    const isIncomingUpdateRef = React.useRef(false);

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
        // Register Nodes
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
                const hasRelevantUpdate = Array.from(updates.keys()).some(k => k.startsWith(namespace));
                if (!hasRelevantUpdate) return;
            }

            isIncomingUpdateRef.current = true;
            setNodes(nds => {
                try {
                    return nds.map(n => {
                        const logicNode = brain.getNode(n.id);
                        if (logicNode) {
                            const brainW = logicNode.width ?? (logicNode.data?.width as number);
                            const brainH = logicNode.height ?? (logicNode.data?.height as number);
                            const isInput = n.id.includes('IN-');
                            const rawPayload = updates?.has(n.id) ? updates.get(n.id) : logicNode.value;
                            const finalValue = isInput ? (PayloadUtils as any).unwrap(rawPayload) : rawPayload;
                            
                            return { 
                                ...n, 
                                width: brainW ?? n.width,
                                height: brainH ?? n.height,
                                data: { ...n.data, ...logicNode.data, value: finalValue } 
                            };
                        }
                        return n;
                    });
                } finally {
                    setTimeout(() => { isIncomingUpdateRef.current = false; }, 50);
                }
            });
        };

        const cleanup = brain.on('graphChanged', handleGraphChange);

        return () => {
            cleanup();
            // PERSISTENCE: We no longer REMOVE_NODE or DISCONNECT on unmount.
            // Circuits stay alive in the shared Brain session, preserving state (like toggles) across scrolls.
        };
    }, [initialNodes, initialEdges, setNodes, brain, namespace]);

    // UI-to-Brain Sync Loop
    const lastSyncedDataRef = React.useRef<string>('{}');
    useEffect(() => {
        if (isIncomingUpdateRef.current) return;

        const currentNodes = nodes.filter(n => n.id.startsWith(namespace));
        const currentDataStr = JSON.stringify(currentNodes.map(n => ({
            id: n.id,
            data: n.data,
            width: n.width || n.measured?.width || n.data.width,
            height: n.height || n.measured?.height || n.data.height,
            position: n.position
        })));

        if (currentDataStr !== lastSyncedDataRef.current) {
            lastSyncedDataRef.current = currentDataStr;
            currentNodes.forEach(node => {
                brain.applyTransaction({
                    type: 'UPDATE_NODE_DATA',
                    payload: { 
                        id: node.id, 
                        data: { 
                            ...node.data,
                            width: node.width || node.measured?.width || node.data.width,
                            height: node.height || node.measured?.height || node.data.height
                        } 
                    }
                }, false);
            });
        }
    }, [nodes, namespace, brain]);

    const [canvasHeight, setCanvasHeight] = useState(height);
    
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
                const newHeight = (maxY - minY) + 64; 
                if (Math.abs(newHeight - canvasHeight) > 2) setCanvasHeight(newHeight);
            }
        };
        timer = setTimeout(checkExpansion, 100);
        return () => clearTimeout(timer);
    }, [nodes, canvasHeight, height, brain]);

    return (
        <WikiDemoCanvas height={canvasHeight}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
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
                style={{ background: 'transparent' }}
            >
            </ReactFlow>
        </WikiDemoCanvas>
    );
});

export const CircuitDemo: React.FC<CircuitDemoProps> = React.memo((props: CircuitDemoProps) => {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '200px' });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} style={{ minHeight: props.height || 300 }} className="relative">
            {isVisible ? (
                <ReactFlowProvider>
                    <CircuitDemoInner {...props} />
                </ReactFlowProvider>
            ) : (
                <div 
                    className="w-full flex items-center justify-center border border-zinc-500/5 rounded-xl bg-zinc-950/20" 
                    style={{ height: props.height || 300 }}
                >
                    <span className="text-[10px] text-zinc-800 font-mono tracking-widest uppercase animate-pulse">Initializing IO Circuit...</span>
                </div>
            )}
        </div>
    );
});

CircuitDemo.displayName = 'CircuitDemo';
CircuitDemoInner.displayName = 'CircuitDemoInner';


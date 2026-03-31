"use client";

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { ReactFlow, ReactFlowProvider, Node, Edge, useNodesState, useEdgesState, useStore, ReactFlowState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes, edgeTypes } from '@/config/nodeTypeMap';
import { NODE_DEFINITIONS } from '@/definitions/nodeDefinitions';
import { useBrain } from '@/context/BrainContext';
import { WikiDemoCanvas } from './WikiDemoCanvas';
import { PayloadUtils } from '@/utils/PayloadUtils';

interface IOPlaygroundProps {
    // Mode A: Single Node
    nodeType?: string;
    initialData?: any;
    label?: string;

    // Mode B: Full Circuit (IOGL)
    iogl?: {
        nodes: any[];
        edges: any[];
    };

    // Shared
    height?: number;
}

const VERTICAL_PADDING = 24;

const IOPlaygroundInner: React.FC<IOPlaygroundProps> = React.memo((props) => {
    const { nodeType, initialData, label, iogl, height = 160 } = props;
    const brain = useBrain();
    const isIncomingUpdateRef = useRef(false);

    // 1. STABLE IDENTITY GENERATION
    const namespace = useMemo(() => {
        const configStr = JSON.stringify({ nodeType, initialData, label, iogl });
        let hash = 0;
        for (let i = 0; i < configStr.length; i++) {
            const char = configStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `pg-${Math.abs(hash).toString(36).substr(0, 6)}-`;
    }, [nodeType, initialData, label, iogl]);

    // 2. DATA NORMALIZATION (Mode-Dependent)
    const [initialNodes, initialEdges] = useMemo(() => {
        if (iogl) {
            // Circuit Mode
            const nds = iogl.nodes.map((n: any) => ({
                ...n,
                id: `${namespace}${n.id}`,
                data: { ...n.data },
                draggable: false
            }));
            const eds = iogl.edges.map((e: any) => ({
                ...e,
                id: `${namespace}${e.id}`,
                source: `${namespace}${e.source}`,
                target: `${namespace}${e.target}`,
            }));
            return [nds, eds];
        } else if (nodeType) {
            // Single Node Mode
            const def = NODE_DEFINITIONS.find(d => d.id === nodeType);
            const rawData = {
                ...(def?.defaultData || {}),
                ...(initialData || {}),
                label: label || initialData?.label || def?.label
            };
            rawData.value = PayloadUtils.normalizeForDisplay(nodeType, rawData.value);

            const nId = `${namespace}main`;
            return [[
                {
                    id: nId,
                    type: nodeType,
                    position: { x: 20, y: VERTICAL_PADDING },
                    data: rawData,
                    draggable: false
                }
            ], []];
        }
        return [[], []];
    }, [namespace, nodeType, initialData, label, iogl]);

    const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
    const [canvasHeight, setCanvasHeight] = useState(height);

    // 3. BRAIN SYNCHRONIZATION (MOUNT & CHANGE)
    useEffect(() => {
        // [A] Initial Registration
        initialNodes.forEach(n => {
            const existing = brain.getNode(n.id);
            if (!existing) {
                const def = NODE_DEFINITIONS.find(d => d.id === (iogl ? n.type : nodeType));
                brain.applyTransaction({
                    type: 'ADD_NODE',
                    payload: {
                        id: n.id,
                        type: n.type,
                        position: n.position,
                        width: n.width || def?.minWidth || 100,
                        height: n.height || def?.minHeight || 40,
                        data: n.data
                    }
                }, true); // Silent registration
            }
        });

        if (iogl) {
            initialEdges.forEach(e => {
                brain.applyTransaction({ type: 'CONNECT', payload: e }, true);
            });
        }

        // [B] "Kickstart" for interactive nodes
        setTimeout(() => {
            initialNodes.forEach(n => {
                brain.applyTransaction({
                    type: 'UPDATE_NODE_DATA',
                    payload: { id: n.id, data: { _kick: Date.now() } }
                }, false); // Silent: false triggers eval propagation
            });
        }, 50);

        // [C] Engine-to-UI Sync
        const handleGraphChange = (payload?: unknown) => {
            const updates = payload instanceof Map ? payload : null;
            if (updates) {
                const hasRelevant = Array.from(updates.keys()).some(k => k.startsWith(namespace));
                if (!hasRelevant) return;
            }

            isIncomingUpdateRef.current = true;
            setNodes(nds => {
                let changed = false;
                const nextNodes = nds.map(n => {
                    const logicNode = brain.getNode(n.id);
                    if (logicNode) {
                        const brainW = logicNode.width ?? (logicNode.data?.width as number);
                        const brainH = logicNode.height ?? (logicNode.data?.height as number);
                        const rawPayload = updates?.has(n.id) ? updates.get(n.id) : logicNode.value;

                        const finalValue = PayloadUtils.normalizeForDisplay(n.type || '', rawPayload);
                        const updatedData = { ...n.data, ...logicNode.data, value: finalValue };

                        if (
                            n.width !== (brainW ?? n.width) ||
                            n.height !== (brainH ?? n.height) ||
                            JSON.stringify(n.data) !== JSON.stringify(updatedData)
                        ) {
                            changed = true;
                            return {
                                ...n,
                                width: brainW ?? n.width,
                                height: brainH ?? n.height,
                                data: updatedData
                            };
                        }
                    }
                    return n;
                });
                return changed ? nextNodes : nds;
            });
            setTimeout(() => { isIncomingUpdateRef.current = false; }, 50);
        };

        const cleanup = brain.on('graphChanged', handleGraphChange);
        return () => {
            cleanup();
        };
    }, [initialNodes, initialEdges, brain, namespace, iogl, nodeType]);

    // 4. UI-TO-BRAIN SYNC (BIDIRECTIONAL)
    const lastSyncedRef = useRef<string>('');
    useEffect(() => {
        if (isIncomingUpdateRef.current) return;

        const currentNodes = nodes.filter(n => n.id.startsWith(namespace));
        const dataStr = JSON.stringify(currentNodes.map(n => ({
            id: n.id,
            data: n.data,
            width: n.width || n.measured?.width || n.data.width,
            height: n.height || n.measured?.height || n.data.height
        })));

        if (dataStr !== lastSyncedRef.current) {
            lastSyncedRef.current = dataStr;
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
                }, true);
            });
        }
    }, [nodes, namespace, brain]);

    // 5. DYNAMIC SCALE ENGINE
    const nodeLookup = useStore((s: ReactFlowState) => s.nodeLookup);
    const nodeLookupRef = useRef(nodeLookup);
    useEffect(() => {
        nodeLookupRef.current = nodeLookup;
    }, [nodeLookup]);

    useEffect(() => {
        const checkExpansion = () => {
            const currentLookup = nodeLookupRef.current;
            if (currentLookup.size === 0) return;
            let minY = Infinity;
            let maxY = -Infinity;

            const nodes = Array.from(currentLookup.values());
            nodes.forEach((node: any) => {
                if (!node.id.startsWith(namespace)) return;
                const logicNode = brain.getNode(node.id);
                const nHeight = node.measured?.height
                    || logicNode?.height
                    || (node.height as number)
                    || (node.data?.height as number)
                    || 150;

                const top = node.position.y || 0;
                const bottom = top + nHeight;
                if (top < minY) minY = top;
                if (bottom > maxY) maxY = bottom;
            });

            if (maxY > minY) {
                const newHeight = Math.ceil((maxY - minY) + (VERTICAL_PADDING * 2) + 100);
                setCanvasHeight(newHeight);
            }
        };

        const timer = setInterval(checkExpansion, 30); // 30ms for 30fps smooth resize
        return () => clearInterval(timer);
    }, [brain, namespace]);

    return (
        <WikiDemoCanvas height={canvasHeight}>
            <div
                className="w-full h-full"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            >
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
                    noDragClassName="nodrag"
                    proOptions={{ hideAttribution: true }}
                    style={{ background: 'transparent' }}
                />
            </div>
        </WikiDemoCanvas>
    );
});

IOPlaygroundInner.displayName = 'IOPlaygroundInner';

export const IOPlayground: React.FC<IOPlaygroundProps> = React.memo((props) => {
    return (
        <div style={{ minHeight: props.height || 160 }} className="relative">
            <ReactFlowProvider>
                <IOPlaygroundInner {...props} />
            </ReactFlowProvider>
        </div>
    );
});

IOPlayground.displayName = 'IOPlayground';

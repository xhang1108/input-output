'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Node, Edge, addEdge, useReactFlow } from '@xyflow/react';
import { generateNodeId } from '../utils/idGenerator';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { useCanvasProjection } from './useCanvasProjection';
import { getHandleColorByConfig } from '../utils/handleUtils';
import { useHistoryStore } from '../store/useHistoryStore';
import { useBrain } from '../context/BrainContext';
import { Transaction } from '../engine/types';

export interface PendingConnection {
    nodeId: string;
    handleId: string | null;
    handleType: 'source' | 'target';
    handleColor: string;
}

interface UseNodeSpawnerProps {
    palettePosition: { x: number; y: number };
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
    logAction: (msg: string) => void;
}

/**
 * useNodeSpawner
 * Handles node creation from the Command Palette, including
 * auto-linking when spawned from a dangling connection (Smart Link).
 */
export function useNodeSpawner({
    palettePosition,
    setNodes,
    setEdges,
    logAction,
}: UseNodeSpawnerProps) {
    const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
    const spawnCountRef = useRef(0);
    const { project, getCurrentZoom } = useCanvasProjection();
    const { getNodes } = useReactFlow();
    const brain = useBrain();
    const pushHistory = useHistoryStore(s => s.push);

    // Reset spawn count when the palette is opened in a new location
    // Using optional chaining to prevent crash if palettePosition is null
    useEffect(() => {
        spawnCountRef.current = 0;
    }, [palettePosition?.x, palettePosition?.y]);

    const spawnNode = useCallback((type: string, label: string, extraData?: unknown, isContinuous?: boolean, screenPos?: { x: number, y: number }): Node | null => {
        logAction(`Spawn Node: ${type}`);

        const basePos = screenPos || palettePosition || { x: 0, y: 0 };

        const flowPos = project({
            x: basePos.x,
            y: basePos.y
        });

        const newId = generateNodeId(type);
        const nodeDef = NODE_DEFINITIONS.find(d => d.id === type);
        const newNode: Node = {
            id: newId,
            type: type || 'baseNode',
            position: flowPos,
            selected: true, // Default to selected so it can be grabbed immediately
            draggable: nodeDef?.draggable,
            data: {
                label,
                type: type === 'baseNode' ? undefined : type,
                ...(nodeDef?.defaultData || {}),
                ...(extraData as Record<string, unknown>),
                definitionId: type,
                // FORCE label from definition if it exists to maintain naming consistency
                ...(nodeDef?.label ? { label: nodeDef.label } : {})
            },
        };

        const forward: Transaction[] = [];
        const inverse: Transaction[] = [];

        // 1. Define Add Node Transaction
        forward.push({
            type: 'ADD_NODE',
            payload: {
                id: newNode.id,
                type: newNode.type,
                position: newNode.position,
                data: newNode.data,
                selected: true
            }
        });
        inverse.push({ type: 'REMOVE_NODE', payload: newNode.id });

        setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), newNode]);

        // Redo Z-Index Trap: Record current indices to preserve stacking order
        const currentNodes = getNodes();
        const nodeIndices: Record<string, number> = {
            [newNode.id]: currentNodes.length
        };

        // ... existing auto-link logic ...
        if (pendingConnection) {
            const nodeDef = NODE_DEFINITIONS.find(d => d.id === type);
            if (nodeDef) {
                const targetType = pendingConnection.handleType === 'source' ? 'target' : 'source';
                // Prioritize handles that match the color OR are "any" (white)
                const companionHandle = nodeDef.handles.find(h => {
                    if (h.type !== targetType) return false;
                    const resolvedColor = getHandleColorByConfig(h);
                    return resolvedColor === pendingConnection.handleColor || resolvedColor === 'var(--color-any)';
                }) || nodeDef.handles.find(h => h.type === targetType); // Fallback to first compatible type if no color match

                if (companionHandle) {
                    const newEdge: Edge = {
                        id: generateNodeId('edge'),
                        source: pendingConnection.handleType === 'source' ? pendingConnection.nodeId : newId,
                        sourceHandle: pendingConnection.handleType === 'source' ? pendingConnection.handleId : companionHandle.id,
                        target: pendingConnection.handleType === 'target' ? pendingConnection.nodeId : newId,
                        targetHandle: pendingConnection.handleType === 'target' ? pendingConnection.handleId : companionHandle.id,
                        type: 'magnetic',
                        data: { pathType: 'bezier' }
                    };

                    forward.push({ type: 'CONNECT', payload: newEdge });
                    inverse.push({ type: 'DISCONNECT', payload: newEdge.id });

                    // Execute edge creation
                    setEdges(eds => addEdge(newEdge, eds));
                }
            }
            setPendingConnection(null);
        }

        // Finalize History & Engine Sync
        brain.applyTransaction({ type: 'BATCH', payload: forward }, true);
        pushHistory({
            id: `spawn_${newNode.id}`,
            description: `Spawn ${label}`,
            forward,
            inverse,
            uiMetadata: {
                restoredNodeIndices: nodeIndices
            }
        });

        return newNode;
    }, [setNodes, setEdges, palettePosition, project, pendingConnection, logAction, getCurrentZoom, pushHistory, brain]);

    return {
        pendingConnection,
        setPendingConnection,
        spawnNode,
    };
}

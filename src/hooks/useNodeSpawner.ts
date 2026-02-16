'use client';

import { useCallback, useState } from 'react';
import { Node, Edge, addEdge } from '@xyflow/react';
import { generateNodeId } from '../utils/idGenerator';
import { NODE_DEFINITIONS } from '../definitions/nodeDefinitions';
import { useCanvasProjection } from './useCanvasProjection';

export interface PendingConnection {
    nodeId: string;
    handleId: string | null;
    handleType: 'source' | 'target';
}

interface UseNodeSpawnerProps {
    palettePosition: { x: number; y: number };
    edgeType: string;
    edgeAnimation: boolean;
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
    edgeType,
    edgeAnimation,
    setNodes,
    setEdges,
    logAction,
}: UseNodeSpawnerProps) {
    const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
    const { project } = useCanvasProjection();

    const spawnNode = useCallback((type: string, label: string, extraData?: Record<string, any>) => {
        logAction(`Spawn Node: ${type}`);
        const flowPos = project({
            x: palettePosition.x,
            y: palettePosition.y
        });

        const newId = generateNodeId(type);
        const newNode: Node = {
            id: newId,
            type: type || 'baseNode',
            position: flowPos,
            data: {
                label,
                type: type === 'baseNode' ? undefined : type,
                ...extraData
            },
        };

        setNodes((nds) => nds.concat(newNode));

        // Auto-Link if we have a pending connection
        if (pendingConnection) {
            const nodeDef = NODE_DEFINITIONS.find(d => d.id === type);
            if (nodeDef) {
                const targetType = pendingConnection.handleType === 'source' ? 'target' : 'source';
                const companionHandle = nodeDef.handles.find(h => h.type === targetType);

                if (companionHandle) {
                    const newEdge: Edge = {
                        id: generateNodeId('edge'),
                        source: pendingConnection.handleType === 'source' ? pendingConnection.nodeId : newId,
                        sourceHandle: pendingConnection.handleType === 'source' ? pendingConnection.handleId : companionHandle.id,
                        target: pendingConnection.handleType === 'target' ? pendingConnection.nodeId : newId,
                        targetHandle: pendingConnection.handleType === 'target' ? pendingConnection.handleId : companionHandle.id,
                        type: 'magnetic',
                        data: { pathType: edgeType, animate: edgeAnimation }
                    };

                    setTimeout(() => {
                        setEdges(eds => addEdge(newEdge, eds));
                    }, 50);
                }
            }
            setPendingConnection(null);
        }
    }, [setNodes, setEdges, palettePosition, project, pendingConnection, edgeType, edgeAnimation, logAction]);

    return {
        pendingConnection,
        setPendingConnection,
        spawnNode,
    };
}

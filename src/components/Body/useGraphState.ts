import { useCallback, useRef } from 'react';
import {
    addEdge,
    reconnectEdge,
    useNodesState,
    useEdgesState,
    useReactFlow,
    type Connection,
    type Edge,
    type NodeChange,
    type EdgeChange,
} from '@xyflow/react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { defaultNodes, defaultEdges } from './GraphConfig';

export function useGraphState(eyes: any, memories: any) {
    const { triggerLogicUpdate } = useAppStore();
    const { getNodes, setNodes: setNodesInternal, setEdges: setEdgesInternal } = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);

    const onNodesChangeWrapped = useCallback((changes: NodeChange[]) => {
        onNodesChange(changes);
        const isLogical = changes.some(c => c.type !== 'position' && c.type !== 'select' && c.type !== 'dimensions');
        if (isLogical) setTimeout(() => triggerLogicUpdate(), 0);
    }, [onNodesChange, triggerLogicUpdate]);

    const onEdgesChangeWrapped = useCallback((changes: EdgeChange[]) => {
        onEdgesChange(changes);
        const isLogical = changes.some(c => c.type === 'add' || c.type === 'remove' || c.type === 'replace');
        if (isLogical) setTimeout(() => triggerLogicUpdate(), 0);
    }, [onEdgesChange, triggerLogicUpdate]);

    const edgeReconnectSuccessful = useRef(true);

    const onConnect = useCallback(
        (params: Connection) => {
            if (eyes.detectCycle(params.source!, params.target!)) {
                toast.error('⚠️ Loop detected! This connection would create a cycle.');
                return;
            }

            setEdges((eds) => {
                const currentNodes = getNodes();
                const targetNode = currentNodes.find((n) => n.id === params.target);
                const sourceNode = currentNodes.find((n) => n.id === params.source);

                const isOutputNode = targetNode?.type === 'outputNode';
                const isFormula = sourceNode?.type !== 'inputNode';

                const filtered = eds.filter(
                    (e) => {
                        const isSameTargetHandle = e.target === params.target && e.targetHandle === params.targetHandle;
                        const isOutputNodeConflict = isOutputNode && e.target === params.target;
                        return !(isSameTargetHandle || isOutputNodeConflict);
                    }
                );
                return addEdge({ ...params, type: 'customEdge', data: { isFormula } }, filtered);
            });
            setTimeout(() => triggerLogicUpdate(), 0);
        },
        [eyes, getNodes, setEdges, triggerLogicUpdate]
    );

    const onReconnect = useCallback(
        (oldEdge: Edge, newConnection: Connection) => {
            edgeReconnectSuccessful.current = true;
            if (eyes.detectCycle(newConnection.source!, newConnection.target!)) {
                toast.error('⚠️ Loop detected! This reconnection would create a cycle.');
                return;
            }

            setEdges((eds) => {
                const currentNodes = getNodes();
                const sourceNode = currentNodes.find(n => n.id === newConnection.source);
                const isFormula = sourceNode?.type !== 'inputNode';

                const conflictingEdgesRemoved = eds.filter(e => {
                    const isConflicting = e.target === newConnection.target && e.targetHandle === newConnection.targetHandle;
                    const isOldEdge = e.id === oldEdge.id;
                    return !isConflicting || isOldEdge;
                });

                return reconnectEdge(oldEdge, { ...newConnection, data: { isFormula } } as any, conflictingEdgesRemoved);
            });
            setTimeout(() => triggerLogicUpdate(), 0);
        },
        [eyes, getNodes, setEdges, triggerLogicUpdate]
    );

    const onReconnectStart = useCallback(() => {
        edgeReconnectSuccessful.current = false;
    }, []);

    const onReconnectEnd = useCallback((_: MouseEvent | TouchEvent, edge: Edge) => {
        if (!edgeReconnectSuccessful.current) {
            setEdges((eds) => eds.filter((e) => e.id !== edge.id));
            setTimeout(() => triggerLogicUpdate(), 0);
        }
        edgeReconnectSuccessful.current = true;
    }, [setEdges, triggerLogicUpdate]);

    return {
        nodes,
        setNodes,
        onNodesChange: onNodesChangeWrapped,
        edges,
        setEdges,
        onEdgesChange: onEdgesChangeWrapped,
        onConnect,
        onReconnect,
        onReconnectStart,
        onReconnectEnd,
    };
}

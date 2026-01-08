import { useCallback, useEffect } from 'react';
import { type Node as FlowNode, type Edge } from '@xyflow/react';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';

export function usePersistence(
    nodes: FlowNode[],
    edges: Edge[],
    setNodes: (nds: FlowNode[] | ((nds: FlowNode[]) => FlowNode[])) => void,
    setEdges: (eds: Edge[] | ((eds: Edge[]) => Edge[])) => void,
    mouth: any,
    triggerLogicUpdate: () => void,
    logicVersion: number
) {
    const handleSave = useCallback(() => {
        mouth.savor();
        toast.success('Session saved manually');
    }, [mouth]);

    const handleReset = useCallback(() => {
        mouth.diet();
        window.location.reload();
    }, [mouth]);

    // Auto-Save
    useEffect(() => {
        const timeout = setTimeout(() => {
            mouth.savor();
        }, 2000);
        return () => clearTimeout(timeout);
    }, [logicVersion, mouth]);

    // Auto-Load
    useEffect(() => {
        mouth.eat();
        triggerLogicUpdate();
    }, [mouth, triggerLogicUpdate]);

    // Grouping Logic (Moved here to slim down Body.tsx)
    const handleGroupSelection = useCallback(() => {
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length < 2) {
            toast.error('Select at least 2 nodes to group.');
            return;
        }

        const selectedIds = new Set(selectedNodes.map((n) => n.id));
        const groupId = nanoid(8);

        const groupInputs: any[] = [];
        const groupOutputs: any[] = [];
        const newEdges: Edge[] = [];

        edges.forEach(edge => {
            const isSourceSelected = selectedIds.has(edge.source);
            const isTargetSelected = selectedIds.has(edge.target);

            if (isSourceSelected && isTargetSelected) return;

            if (!isSourceSelected && isTargetSelected) {
                const inputId = `in-${nanoid(4)}`;
                groupInputs.push({
                    id: inputId,
                    label: edge.targetHandle || 'input',
                    edgeId: edge.id,
                    source: edge.source,
                    sourceHandle: edge.sourceHandle || null
                });
                newEdges.push({
                    id: nanoid(6),
                    source: edge.source,
                    sourceHandle: edge.sourceHandle,
                    target: groupId,
                    targetHandle: inputId,
                    type: 'customEdge'
                });
                return;
            }

            if (isSourceSelected && !isTargetSelected) {
                const outputId = `out-${nanoid(4)}`;
                groupOutputs.push({
                    id: outputId,
                    label: 'result',
                    edgeId: edge.id,
                    target: edge.target,
                    targetHandle: edge.targetHandle || null
                });
                newEdges.push({
                    id: nanoid(6),
                    source: groupId,
                    sourceHandle: outputId,
                    target: edge.target,
                    targetHandle: edge.targetHandle,
                    type: 'customEdge'
                });
                return;
            }

            newEdges.push(edge);
        });

        const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
        const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

        const relativeNodes = selectedNodes.map(n => ({
            ...n,
            position: {
                x: n.position.x - avgX,
                y: n.position.y - avgY
            }
        }));

        const groupNode: FlowNode = {
            id: groupId,
            type: 'groupNode',
            position: { x: avgX, y: avgY },
            data: {
                label: 'Group',
                inputs: groupInputs,
                outputs: groupOutputs,
                subNetwork: {
                    nodes: relativeNodes,
                    edges: edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target)),
                    inputMapping: groupInputs.reduce((acc, inp) => {
                        const originalEdge = edges.find(e => e.id === inp.edgeId);
                        if (originalEdge) {
                            acc[inp.id] = { nodeId: originalEdge.target, handle: originalEdge.targetHandle };
                        }
                        return acc;
                    }, {}),
                    outputMapping: groupOutputs.reduce((acc, out) => {
                        const originalEdge = edges.find(e => e.id === out.edgeId);
                        if (originalEdge) {
                            acc[out.id] = { nodeId: originalEdge.source, handle: originalEdge.sourceHandle };
                        }
                        return acc;
                    }, {})
                }
            },
            width: 200,
            height: 100 + Math.max(groupInputs.length, groupOutputs.length) * 24
        };

        setNodes(nds => [...nds.filter(n => !selectedIds.has(n.id)), groupNode]);
        setEdges(newEdges);
        toast.success('Group created!');
    }, [nodes, edges, setNodes, setEdges]);

    const handleUngroup = useCallback(() => {
        const selectedGroup = nodes.find(n => n.selected && n.type === 'groupNode');
        if (!selectedGroup) return;

        const { subNetwork } = selectedGroup.data;
        if (!subNetwork) return;

        const { nodes: subNodes, edges: subEdges, inputMapping, outputMapping } = subNetwork as any;

        const restoredNodes = (subNodes as FlowNode[]).map(n => ({
            ...n,
            selected: true,
            position: {
                x: selectedGroup.position.x + n.position.x,
                y: selectedGroup.position.y + n.position.y
            }
        }));

        const restoredInternalEdges = subEdges as Edge[];
        const connectedEdges = edges.filter(e => e.source === selectedGroup.id || e.target === selectedGroup.id);
        const restoredExternalEdges: Edge[] = [];

        connectedEdges.forEach(edge => {
            if (edge.target === selectedGroup.id && edge.targetHandle) {
                const mapping = (inputMapping as any)[edge.targetHandle];
                if (mapping) {
                    restoredExternalEdges.push({ ...edge, target: mapping.nodeId, targetHandle: mapping.handle });
                }
            }
            if (edge.source === selectedGroup.id && edge.sourceHandle) {
                const mapping = (outputMapping as any)[edge.sourceHandle];
                if (mapping) {
                    restoredExternalEdges.push({ ...edge, source: mapping.nodeId, sourceHandle: mapping.handle });
                }
            }
        });

        const otherEdges = edges.filter(e => e.source !== selectedGroup.id && e.target !== selectedGroup.id);

        setNodes(nds => [...nds.filter(n => n.id !== selectedGroup.id), ...restoredNodes]);
        setEdges([...otherEdges, ...restoredInternalEdges, ...restoredExternalEdges]);
        toast.success('Group dissolved!');
    }, [nodes, edges, setNodes, setEdges]);

    return {
        handleSave,
        handleReset,
        handleGroupSelection,
        handleUngroup,
    };
}

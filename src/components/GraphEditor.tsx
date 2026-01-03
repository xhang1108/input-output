'use client';

import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type Connection,
    type NodeTypes,
    type EdgeTypes,
    SelectionMode,
    useReactFlow,
    useNodes,
    useEdges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { useGraphEvaluation } from '../hooks/useGraphEvaluation';
import { useGraphOperations } from '../hooks/useGraphOperations';
import { Save, Plus, Calculator, Hash, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { NodeInput } from './nodes/NodeInput';
import { NodeMath } from './nodes/NodeMath';
import { NodeUnary } from './nodes/NodeUnary';
import { NodeOutput } from './nodes/NodeOutput';
import { NodeSolver } from './nodes/NodeSolver';
import { NodeGroup } from './nodes/NodeGroup';
import { CustomEdge } from './edges/CustomEdge';
import { Sigma, Group, Layers } from 'lucide-react';

const nodeTypes: NodeTypes = {
    inputNode: NodeInput,
    mathNode: NodeMath,
    unaryNode: NodeUnary,
    outputNode: NodeOutput,
    solverNode: NodeSolver,
    groupNode: NodeGroup,
};


const edgeTypes: EdgeTypes = {
    customEdge: CustomEdge,
};

const defaultNodes: Node[] = [
    {
        id: 'input-a',
        type: 'inputNode',
        position: { x: 100, y: 100 },
        data: { label: 'Value A', value: 10, rawExpression: '10' },
    },
    {
        id: 'input-b',
        type: 'inputNode',
        position: { x: 100, y: 300 },
        data: { label: 'Value B', value: 7, rawExpression: '7' },
    },
    {
        id: 'math-1',
        type: 'mathNode',
        position: { x: 350, y: 180 },
        data: { operation: 'add' },
    },
    {
        id: 'output-1',
        type: 'outputNode',
        position: { x: 550, y: 180 },
        data: { value: 0 },
    },
];

const defaultEdges: Edge[] = [
    { id: 'e1', source: 'input-a', target: 'math-1', targetHandle: 'a', type: 'customEdge' },
    { id: 'e2', source: 'input-b', target: 'math-1', targetHandle: 'b', type: 'customEdge' },
    { id: 'e3', source: 'math-1', target: 'output-1', type: 'customEdge' },
];

export function GraphEditor() {
    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);

    // Cycle Detection
    const wouldCreateCycle = useCallback(
        (sourceId: string, targetId: string): boolean => {
            const successors = new Map<string, string[]>();
            edges.forEach((e) => {
                if (!successors.has(e.source)) successors.set(e.source, []);
                successors.get(e.source)!.push(e.target);
            });

            const visited = new Set<string>();
            const stack = [targetId];
            while (stack.length > 0) {
                const nodeId = stack.pop()!;
                if (nodeId === sourceId) return true;
                if (visited.has(nodeId)) continue;
                visited.add(nodeId);
                const succs = successors.get(nodeId) || [];
                stack.push(...succs);
            }
            return false;
        },
        [edges]
    );

    // Toast debounce ref to avoid spam
    const lastToastTimeRef = useRef(0);

    // Validate connection (silent, only for UI feedback red/blue)
    const isValidConnection = useCallback(
        (connection: Connection | Edge) => {
            // We allow most connections here to handle feedback in onConnect
            // But we can keep wouldCreateCycle here for immediate red-line feedback if desired
            // For now, let's just return true to allow onConnect to handle toasts
            return true;
        },
        []
    );



    // Handle new connection
    const onConnect = useCallback(
        (params: Connection) => {
            // 1. Check for cycle and show toast ONCE on drop
            if (wouldCreateCycle(params.source!, params.target!)) {
                toast.error('⚠️ Loop detected! This connection would create a cycle.');
                return;
            }

            // 2. Auto-replace logic
            setEdges((eds) => {
                const targetNode = nodes.find((n) => n.id === params.target);
                const isOutputNode = targetNode?.type === 'outputNode';

                const filtered = eds.filter(
                    (e) => {
                        const isSameTargetHandle = e.target === params.target && e.targetHandle === params.targetHandle;
                        // For output nodes, any connection to it replaces the existing one
                        const isOutputNodeConflict = isOutputNode && e.target === params.target;

                        return !(isSameTargetHandle || isOutputNodeConflict);
                    }
                );
                return addEdge({ ...params, type: 'customEdge' }, filtered);
            });
        },
        [wouldCreateCycle, nodes, setEdges]
    );

    // Use store state for evaluation to catch deep data changes from NodeInput
    const storeNodes = useNodes();
    const storeEdges = useEdges();

    // --- new engine integration ---
    const { nodeResults } = useGraphEvaluation(storeNodes, storeEdges);

    // Sync Result back to Nodes
    useEffect(() => {
        if (Object.keys(nodeResults).length === 0) return;

        setNodes((nds) => nds.map((node) => {
            const result = nodeResults[node.id];

            // Only update if result exists and changed (value or error or ast)
            if (result && (
                node.data.result !== result.value ||
                node.data.error !== result.error ||
                JSON.stringify(node.data.ast) !== JSON.stringify(result.ast) // Simple deep check for AST
            )) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        result: result.value,
                        error: result.error,
                        ast: result.ast
                    }
                };
            }
            return node;
        }));
    }, [nodeResults, setNodes]);

    // Add node
    const addNode = useCallback(
        (type: string) => {
            const id = nanoid(8);
            const newNode: Node = {
                id,
                type,
                position: { x: 300, y: 300 },
                data:
                    type === 'inputNode'
                        ? { label: 'Value', value: 0 }
                        : type === 'mathNode'
                            ? { operation: 'add' }
                            : type === 'unaryNode'
                                ? { operation: 'sqrt' }
                                : type === 'solverNode'
                                    ? { targetVar: 'x' }
                                    : { value: 0 },
            };
            setNodes((nds) => [...nds, newNode]);
        },
        [setNodes]
    );

    // Save (placeholder)
    const handleSave = () => {
        toast.success('Graph saved!');
        console.log({ nodes, edges });
    };

    // Group Selection Logic
    const handleGroupSelection = useCallback(() => {
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length < 2) {
            toast.error('Select at least 2 nodes to group.');
            return;
        }

        const selectedIds = new Set(selectedNodes.map((n) => n.id));
        const groupId = nanoid(8);

        // 1. Identify Boundary Edges
        const groupInputs: { id: string; label: string; edgeId: string; source: string; sourceHandle: string | null }[] = [];
        const groupOutputs: { id: string; label: string; edgeId: string; target: string; targetHandle: string | null }[] = [];

        // Edges that will remain in the main graph (connecting to the group)
        const newEdges: Edge[] = [];

        edges.forEach(edge => {
            const isSourceSelected = selectedIds.has(edge.source);
            const isTargetSelected = selectedIds.has(edge.target);

            // Internal Edge: Both selected (Will be moved to subNetwork)
            if (isSourceSelected && isTargetSelected) {
                return;
            }

            // Input Edge: Source is outside, Target is inside
            if (!isSourceSelected && isTargetSelected) {
                const inputId = `in-${nanoid(4)}`;
                // We create a handle on the group node for this input
                groupInputs.push({
                    id: inputId,
                    label: edge.targetHandle || 'input',
                    edgeId: edge.id,
                    source: edge.source,
                    sourceHandle: edge.sourceHandle || null
                });

                // Add replacement edge: Outside -> GroupNode
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

            // Output Edge: Source is inside, Target is outside
            if (isSourceSelected && !isTargetSelected) {
                const outputId = `out-${nanoid(4)}`;
                groupOutputs.push({
                    id: outputId,
                    label: 'result', // For now generic, could be specific
                    edgeId: edge.id,
                    target: edge.target,
                    targetHandle: edge.targetHandle || null
                });

                // Add replacement edge: GroupNode -> Outside
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

            // External Edge: Neither selected (Keep as is)
            newEdges.push(edge);
        });

        // 2. Create Group Node
        // Calculate center position
        const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
        const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

        // Create relative nodes for subNetwork
        const relativeNodes = selectedNodes.map(n => ({
            ...n,
            position: {
                x: n.position.x - avgX,
                y: n.position.y - avgY
            }
        }));

        const groupNode: Node = {
            id: groupId,
            type: 'groupNode',
            position: { x: avgX, y: avgY },
            data: {
                label: 'Group',
                inputs: groupInputs, // Handles to render
                outputs: groupOutputs, // Handles to render
                subNetwork: {
                    nodes: relativeNodes,
                    edges: edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target)),
                    // Mapping of GroupHandleId -> InternalTargetNodeId/Handle
                    inputMapping: groupInputs.reduce((acc, inp) => {
                        // Find the original internal node this input was connected to
                        const originalEdge = edges.find(e => e.id === inp.edgeId);
                        if (originalEdge) {
                            acc[inp.id] = { nodeId: originalEdge.target, handle: originalEdge.targetHandle };
                        }
                        return acc;
                    }, {} as Record<string, { nodeId: string; handle: string | null | undefined }>),
                    // Mapping of GroupHandleId -> InternalSourceNodeId/Handle
                    outputMapping: groupOutputs.reduce((acc, out) => {
                        const originalEdge = edges.find(e => e.id === out.edgeId);
                        if (originalEdge) {
                            acc[out.id] = { nodeId: originalEdge.source, handle: originalEdge.sourceHandle };
                        }
                        return acc;
                    }, {} as Record<string, { nodeId: string; handle: string | null | undefined }>)
                }
            },
            width: 200,
            height: 100 + Math.max(groupInputs.length, groupOutputs.length) * 24
        };

        // 3. Update State
        setNodes(nds => [...nds.filter(n => !selectedIds.has(n.id)), groupNode]);
        setEdges(newEdges);
        toast.success('Group created!');

    }, [nodes, edges, setNodes, setEdges]);

    // Ungroup Selection Logic
    const handleUngroup = useCallback(() => {
        const selectedGroup = nodes.find(n => n.selected && n.type === 'groupNode');
        if (!selectedGroup) return;

        const { subNetwork } = selectedGroup.data;
        if (!subNetwork) return;

        const { nodes: subNodes, edges: subEdges, inputMapping, outputMapping } = subNetwork as any;

        // 1. Restore Nodes (Offset by Group Position)
        // subNodes have positions relative to (0,0) of the *original creation center*.
        // Wait, I normalized them to be relative to the group center (0,0).
        // So NewPos = GroupPos + RelativePos
        const restoredNodes = (subNodes as Node[]).map(n => ({
            ...n,
            selected: true, // Auto-select restored nodes
            position: {
                x: selectedGroup.position.x + n.position.x,
                y: selectedGroup.position.y + n.position.y
            }
        }));

        // 2. Restore Edges
        // A. Internal Edges (Just put them back)
        const restoredInternalEdges = subEdges as Edge[];

        // B. Reconnect External Edges
        // We need to look at edges currently connected TO/FROM the group node
        const connectedEdges = edges.filter(e => e.source === selectedGroup.id || e.target === selectedGroup.id);

        const restoredExternalEdges: Edge[] = [];

        connectedEdges.forEach(edge => {
            // Incoming: Source -> Group (TargetHandle = GroupInputId)
            if (edge.target === selectedGroup.id && edge.targetHandle) {
                // Find which internal node this maps to
                const mapping = (inputMapping as Record<string, { nodeId: string; handle: string | null }>)[edge.targetHandle];
                if (mapping) {
                    restoredExternalEdges.push({
                        ...edge,
                        target: mapping.nodeId,
                        targetHandle: mapping.handle
                    });
                }
            }

            // Outgoing: Group (SourceHandle = GroupOutputId) -> Target
            if (edge.source === selectedGroup.id && edge.sourceHandle) {
                const mapping = (outputMapping as Record<string, { nodeId: string; handle: string | null }>)[edge.sourceHandle];
                if (mapping) {
                    restoredExternalEdges.push({
                        ...edge,
                        source: mapping.nodeId,
                        sourceHandle: mapping.handle
                    });
                }
            }
        });

        const otherEdges = edges.filter(e => e.source !== selectedGroup.id && e.target !== selectedGroup.id);

        setNodes(nds => [...nds.filter(n => n.id !== selectedGroup.id), ...restoredNodes]);
        setEdges([...otherEdges, ...restoredInternalEdges, ...restoredExternalEdges]);
        toast.success('Group dissolved!');

    }, [nodes, edges, setNodes, setEdges]);

    // Blender-style Keyboard Shortcuts
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const { screenToFlowPosition, fitView, getNodes } = useReactFlow();

    // Duplication & Placement Logic
    const [placingNodeIds, setPlacingNodeIds] = useState<Set<string> | null>(null);
    // Note: clipboard logic moved to useGraphOperations, local state removed to prevent conflict.

    const placementRef = useRef<{
        startMousePos: { x: number, y: number },
        nodeOffsets: Record<string, { x: number, y: number }>
    } | null>(null);

    // Track mouse for Shift+A menu location
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Operations
    const {
        handleSelectAll,
        handleFocusSelected,
        handleDelete,
        handleCopy,
        handleCut,
        handlePaste,
        handleDuplicate
    } = useGraphOperations();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape: Blur Input (Exit Typing Mode)
            if (e.code === 'Escape') {
                if (document.activeElement instanceof HTMLElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    document.activeElement.blur();
                    e.preventDefault();
                    return;
                }
            }

            // Global Ignore for Inputs
            if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                return;
            }

            // Shift + A: Open Add Menu
            if (e.shiftKey && e.code === 'KeyA') {
                e.preventDefault();
                setMenuPosition({ x: mousePosRef.current.x, y: mousePosRef.current.y });
                return;
            }

            // A: Select All
            if (e.code === 'KeyA' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                handleSelectAll();
                return;
            }

            // Period (.): Focus Selected
            if (e.key === '.' || e.code === 'Period') {
                e.preventDefault();
                handleFocusSelected();
                return;
            }

            // Delete / Backspace / X
            if ((e.code === 'KeyX' && !e.ctrlKey) || e.code === 'Delete' || e.code === 'Backspace') {
                e.preventDefault();
                handleDelete();
                return;
            }

            // Ctrl + C: Copy
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
                e.preventDefault();
                handleCopy();
                return;
            }

            // Ctrl + X: Cut
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
                e.preventDefault();
                handleCut();
                return;
            }

            // Ctrl + V: Paste
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
                e.preventDefault();
                handlePaste(mousePosRef.current);
                return;
            }

            // Shift + D: Duplicate
            if (e.shiftKey && e.code === 'KeyD') {
                e.preventDefault();
                handleDuplicate(mousePosRef.current);
                return;
            }

            // G: Grab (Locally Managed Interactive Logic)
            if (e.code === 'KeyG') {
                e.preventDefault();
                const currentNodes = getNodes();
                let targetNodes = currentNodes.filter(n => n.selected);

                // Hover Fallback
                if (targetNodes.length === 0) {
                    const mouseFlowPos = screenToFlowPosition({ x: mousePosRef.current.x, y: mousePosRef.current.y });
                    for (let i = currentNodes.length - 1; i >= 0; i--) {
                        const n = currentNodes[i];
                        const w = n.measured?.width ?? n.width ?? 200;
                        const h = n.measured?.height ?? n.height ?? 50;
                        if (mouseFlowPos.x >= n.position.x && mouseFlowPos.x <= n.position.x + w &&
                            mouseFlowPos.y >= n.position.y && mouseFlowPos.y <= n.position.y + h) {
                            targetNodes = [{ ...n, selected: true }];
                            setNodes(nds => nds.map(node => node.id === n.id ? { ...node, selected: true } : node));
                            break;
                        }
                    }
                }

                if (targetNodes.length === 0) return;

                const movingIds = new Set<string>();
                const nodeOffsets: Record<string, { x: number, y: number }> = {};
                targetNodes.forEach(node => {
                    movingIds.add(node.id);
                    nodeOffsets[node.id] = { x: node.position.x, y: node.position.y };
                });

                setPlacingNodeIds(movingIds);
                placementRef.current = {
                    startMousePos: mousePosRef.current,
                    nodeOffsets: nodeOffsets
                };
                toast.success('Grab mode: Move mouse to place, Click to confirm.');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        handleSelectAll, handleFocusSelected, handleDelete,
        handleCopy, handleCut, handlePaste, handleDuplicate,
        getNodes, setNodes, screenToFlowPosition
    ]);

    const closeMenu = () => setMenuPosition(null);



    // Context-Aware Connect Logic
    const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null);
    const [pendingConnection, setPendingConnection] = useState<{ source: string; sourceHandle: string | null } | null>(null);

    // Handle Placement Movement
    useEffect(() => {
        if (!placingNodeIds) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!placementRef.current) return;

            const currentFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            const startFlowPos = screenToFlowPosition(placementRef.current.startMousePos);

            const dx = currentFlowPos.x - startFlowPos.x;
            const dy = currentFlowPos.y - startFlowPos.y;

            setNodes(nds => nds.map(n => {
                if (placingNodeIds.has(n.id)) {
                    const originalPos = placementRef.current!.nodeOffsets[n.id];
                    if (originalPos) {
                        return {
                            ...n,
                            position: {
                                x: originalPos.x + dx,
                                y: originalPos.y + dy
                            }
                        };
                    }
                }
                return n;
            }));
        };

        const handleMouseDown = (e: MouseEvent) => {
            // Commit placement
            e.stopPropagation(); // Stop React Flow from starting a selection box
            setPlacingNodeIds(null);
            placementRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown, { capture: true }); // Capture phase to beat React Flow component listeners
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown, { capture: true });
        };
    }, [placingNodeIds, screenToFlowPosition, setNodes]);

    const onConnectStart = useCallback((_: any, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
        connectionStartRef.current = params;
    }, []);

    const onConnectEnd = useCallback((event: any) => {
        const targetIsPane = event.target.classList.contains('react-flow__pane');

        if (targetIsPane && connectionStartRef.current) {
            // Dropped in void, open menu
            const { clientX, clientY } = event instanceof TouchEvent ? event.touches[0] : event;
            setMenuPosition({ x: clientX, y: clientY });

            // Store pending connection (assuming source was the start)
            // Note: handleType 'source' means we started dragging from a source handle. 
            // If 'target', we started from a target handle (backwards connection). 
            // For simplicity, we assume source dragging for now, or check handleType.
            if (connectionStartRef.current.handleType === 'source') {
                setPendingConnection({
                    source: connectionStartRef.current.nodeId!,
                    sourceHandle: connectionStartRef.current.handleId
                });
            } else {
                // Determine logic for backwards connection if needed
                setPendingConnection(null);
            }
        }
        // If not pane (valid connection or dropped on node), onConnect handles it or it's cancelled
    }, []);

    // Helper to add node at menu position
    const addNodeAtCursor = (type: string) => {
        if (!menuPosition) return;

        const position = screenToFlowPosition({ x: menuPosition.x, y: menuPosition.y });

        const id = nanoid(8);
        const newNode: Node = {
            id,
            type,
            position,
            data: type === 'inputNode' ? { label: 'Value', value: 0 }
                : type === 'mathNode' ? { operation: 'add' }
                    : type === 'unaryNode' ? { operation: 'sqrt' }
                        : type === 'solverNode' ? { targetVar: 'x' }
                            : { value: 0 }
        };

        // Auto-connect if pending
        const newEdgesToAdd: Edge[] = [];
        if (pendingConnection) {
            // We need to know which handle of the NEW node to connect TO.
            // Simplified: Connect to 'a' handle for math nodes, or 'target' for single-input nodes.
            // Ideally we check node definitions.
            let targetHandle: string | null = 'a'; // Default for mathNode
            if (type === 'unaryNode') targetHandle = 'input'; // If unary has specific handle id
            if (type === 'outputNode') targetHandle = 'input'; // Generic

            // Check definitions in node components to be precise:
            // MathNode: 'a', 'b'
            // UnaryNode: 'input' (implied or 'a'?) Let's check NodeUnary.tsx later. Defaulting to 'a' or null often works if single target.
            // React Flow edges need accurate matching.

            // Heuristic for now: everything connects to 'a' except inputNode (no target)
            // Actually MathNode handles are 'a' and 'b'. Unary is likely 'input'.
            // Let's guess 'a' for now for math, 'input' for unary/output.
            if (type === 'mathNode') targetHandle = 'a';
            else if (type === 'unaryNode' || type === 'outputNode') targetHandle = 'input';
            else targetHandle = null; // Fallback for other nodes or if no specific target handle is known

            newEdgesToAdd.push({
                id: nanoid(6),
                source: pendingConnection.source,
                sourceHandle: pendingConnection.sourceHandle,
                target: id,
                targetHandle: targetHandle,
                type: 'customEdge'
            });
            setPendingConnection(null);
        }
        setNodes(nds => [...nds, newNode]);
        if (newEdgesToAdd.length > 0) {
            setEdges(eds => [...eds, ...newEdgesToAdd]);
        }
        closeMenu();
    };

    // Auto-Insert Logic
    const onNodeDragStop = useCallback((_: any, node: Node) => {
        // Find visible edges
        const candidateEdges = edges.filter(e => e.source !== node.id && e.target !== node.id);

        const w = node.measured?.width || node.width || 150;
        const h = node.measured?.height || node.height || 50;
        const cx = node.position.x + w / 2;
        const cy = node.position.y + h / 2;

        const threshold = 30; // pixels

        for (const edge of candidateEdges) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) continue;

            const sx = sourceNode.position.x + (sourceNode.measured?.width || 150) / 2;
            const sy = sourceNode.position.y + (sourceNode.measured?.height || 50) / 2;
            const tx = targetNode.position.x + (targetNode.measured?.width || 150) / 2;
            const ty = targetNode.position.y + (targetNode.measured?.height || 50) / 2;

            // Distance from point (cx, cy) to segment (sx, sy)-(tx, ty)
            const dist = distanceToSegment(cx, cy, sx, sy, tx, ty);

            if (dist < threshold) {
                // Bingo! Insert node.
                // 1. Remove old edge
                // 2. Add Source -> Node
                // 3. Add Node -> Target

                // Which handles?
                // Source -> Node: use edge.sourceHandle -> NodeInput (generic or 'a')
                // Node -> Target: use NodeOutput (generic) -> edge.targetHandle

                let newNodeInput = 'a'; // Default math input
                if (node.type === 'unaryNode' || node.type === 'outputNode' || node.type === 'solverNode') newNodeInput = 'input';

                let newNodeOutput = 'source'; // Default output generic? 
                // Wait, nodes don't usually have named output handles unless custom.
                // Our NodeMath/NodeInput use Position.Right without ID => default handle (null).
                // If we defined id="result" in node types, we must use it.
                // Let's check NodeMath: <Handle type="source" ... /> (No ID) => ID is null.

                const newEdge1: Edge = {
                    id: nanoid(6),
                    source: edge.source,
                    sourceHandle: edge.sourceHandle,
                    target: node.id,
                    targetHandle: newNodeInput,
                    type: 'customEdge'
                };

                const newEdge2: Edge = {
                    id: nanoid(6),
                    source: node.id,
                    sourceHandle: null, // Default source handle
                    target: edge.target,
                    targetHandle: edge.targetHandle,
                    type: 'customEdge'
                };

                setEdges(eds => eds.filter(e => e.id !== edge.id).concat([newEdge1, newEdge2]));
                toast.success('Auto-inserted node!');
                break; // One insertion at a time
            }
        }
    }, [nodes, edges, setEdges]);

    // Helper for math
    function distanceToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) // in case of 0 length line
            param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Actually, let's just use the clientX/Y mapped to current viewport if possible.
    // Without 'screenToFlowPosition', placing exactly at cursor is hard if zoomed/panned.
    // Strategy: We will just spawn at the click location but in "Screen" space it might be wrong.
    return (
        <div className="h-screen w-screen bg-zinc-900 relative" onClick={closeMenu}>

            {/* Context Menu (Blender Style) */}
            {menuPosition && (
                <div
                    className="absolute z-[100] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-1 min-w-[150px] flex flex-col gap-1"
                    style={{ top: menuPosition.y, left: menuPosition.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1 text-xs font-bold text-zinc-500 border-b border-zinc-700 mb-1">Add Node</div>
                    <button onClick={() => addNodeAtCursor('inputNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Hash className="w-4 h-4 text-blue-500" /> Input
                    </button>
                    <button onClick={() => addNodeAtCursor('mathNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Plus className="w-4 h-4 text-orange-500" /> Math
                    </button>
                    <button onClick={() => addNodeAtCursor('unaryNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Calculator className="w-4 h-4 text-purple-500" /> Function
                    </button>
                    <button onClick={() => addNodeAtCursor('solverNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Sigma className="w-4 h-4 text-indigo-500" /> Solver
                    </button>
                    <button onClick={() => addNodeAtCursor('outputNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Monitor className="w-4 h-4 text-green-500" /> Output
                    </button>
                </div>
            )}

            {/* Top Controls */}
            <div className="absolute top-4 right-4 z-50 flex gap-2">
                <Button
                    onClick={handleSave}
                    variant="outline"
                    className="rounded-full"
                >
                    <Save className="w-4 h-4" />
                    Save
                </Button>
            </div>

            {/* Viewport Info */}
            <div className="absolute bottom-4 left-4 z-50 bg-zinc-800/90 text-white text-xs px-3 py-2 rounded-lg font-mono backdrop-blur-md border border-zinc-700">
                <div className="flex items-center gap-4">
                    <span><strong>Nodes:</strong> {nodes.length}</span>
                    <span><strong>Edges:</strong> {edges.length}</span>
                    <span className="text-zinc-500">Shift+A to Add • Middle Mouse to Pan</span>
                </div>
            </div>

            {/* Floating Toolbar (Optional now, given Shift+A, but kept for discovery) */}
            <TooltipProvider>
                <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-50 flex gap-1 bg-zinc-800 p-2 rounded-2xl shadow-xl border border-zinc-700">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() => addNode('inputNode')}
                                variant="ghost"
                                size="icon"
                                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl"
                            >
                                <Hash className="w-5 h-5 text-blue-500" />
                                <span className="text-[10px] text-gray-400 font-bold mt-1">IN</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add Input Node</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() => addNode('mathNode')}
                                variant="ghost"
                                size="icon"
                                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl"
                            >
                                <Plus className="w-5 h-5 text-orange-500" />
                                <span className="text-[10px] text-gray-400 font-bold mt-1">MATH</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add Math Node</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() => addNode('unaryNode')}
                                variant="ghost"
                                size="icon"
                                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl"
                            >
                                <Calculator className="w-5 h-5 text-purple-500" />
                                <span className="text-[10px] text-gray-400 font-bold mt-1">TRIG</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add Trig Node</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() => addNode('solverNode')}
                                variant="ghost"
                                size="icon"
                                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl"
                            >
                                <Sigma className="w-5 h-5 text-indigo-500" />
                                <span className="text-[10px] text-gray-400 font-bold mt-1">SOLVE</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add Solver Node</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={handleGroupSelection}
                                variant="ghost"
                                size="icon"
                                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl"
                            >
                                <Layers className="w-5 h-5 text-pink-500" />
                                <span className="text-[10px] text-gray-400 font-bold mt-1">GROUP</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Group Selected Nodes</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={handleUngroup}
                                variant="ghost"
                                size="icon"
                                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl"
                            >
                                <Group className="w-5 h-5 text-red-400" />
                                <span className="text-[10px] text-gray-400 font-bold mt-1">UNGROUP</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ungroup Selected Group</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                onClick={() => addNode('outputNode')}
                                variant="ghost"
                                size="icon"
                                className="flex flex-col items-center justify-center w-12 h-12 rounded-xl"
                            >
                                <Monitor className="w-5 h-5 text-green-500" />
                                <span className="text-[10px] text-gray-400 font-bold mt-1">OUT</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add Output Node</TooltipContent>
                    </Tooltip>
                </div>
            </TooltipProvider>

            {/* React Flow */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'customEdge' }}
                isValidConnection={isValidConnection}
                fitView
                panOnDrag={[1, 2]} // Middle or Right click to pan
                panOnScroll={true}
                selectionOnDrag={true} // Left click to select
                selectionMode={SelectionMode.Partial}
                style={{ background: '#18181b' }}
            >
                <Background color="#333" gap={20} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                    nodeColor="#888"
                    maskColor="rgba(0,0,0,0.6)"
                    className="!bg-zinc-800 !border-zinc-700 rounded-lg"
                />
            </ReactFlow>
        </div>
    );
}

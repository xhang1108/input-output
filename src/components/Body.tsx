'use client';

import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    addEdge,
    reconnectEdge,
    useNodesState,
    useEdgesState,
    useReactFlow,
    type Node,
    type Edge,
    type Connection,
    type NodeTypes,
    type EdgeTypes,
    useNodes,
    useEdges,
    type NodeChange,
    type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { useHand } from '../nerves/useHand';
import { useEar } from '../nerves/useEar';
import { useEye } from '../nerves/useEye';
import { useMemory } from '../nerves/useMemory';
import { useMouth } from '../nerves/useMouth';
import { Skin } from './Skin';
import { Plus, Calculator, Hash, Monitor, Sigma, Save, Download, Trash } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { NodeInput } from './nodes/NodeInput';
import { NodeMath } from './nodes/NodeMath';
import { NodeUnary } from './nodes/NodeUnary';
import { NodeLogic } from './nodes/NodeLogic';
import { NodeCompare } from './nodes/NodeCompare';
import { NodeOutput } from './nodes/NodeOutput';
import { NodeSolver } from './nodes/NodeSolver';
import { NodeGroup } from './nodes/NodeGroup';
import { CustomEdge } from './edges/CustomEdge';
import { Group, Layers, Ungroup, ToggleRight, Scale } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

const nodeTypes: NodeTypes = {
    inputNode: NodeInput,
    mathNode: NodeMath,
    unaryNode: NodeUnary,
    logicNode: NodeLogic,
    compareNode: NodeCompare,
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
    { id: 'e1', source: 'input-a', target: 'math-1', targetHandle: 'inputA', type: 'customEdge' },
    { id: 'e2', source: 'input-b', target: 'math-1', targetHandle: 'inputB', type: 'customEdge' },
    { id: 'e3', source: 'math-1', target: 'output-1', targetHandle: 'inputA', type: 'customEdge' },
];

// --- Performance Stabilization Helpers ---
const nodeColor = (n: Node) => {
    if (n.type === 'inputNode') return '#3b82f6'; // blue-500
    if (n.type === 'outputNode') return '#22c55e'; // green-500
    if (n.type === 'mathNode') return '#f97316'; // orange-500
    return '#71717a'; // zinc-500
};

const defaultEdgeOptions = {
    type: 'customEdge',
    animated: true,
};

export function Body() {
    const { screenToFlowPosition, fitView, getNodes, getEdges } = useReactFlow();
    const { displayMode, toggleDisplayMode, triggerLogicUpdate, logicVersion } = useAppStore();

    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);

    // Logic-Aware Change Handlers
    const onNodesChangeWrapped = useCallback((changes: NodeChange[]) => {
        onNodesChange(changes);
        // Performance optimization: Only trigger logic update if the change is NOT purely visual/interactve (drag, select, resize)
        const isLogical = changes.some(c => c.type !== 'position' && c.type !== 'select' && c.type !== 'dimensions');
        if (isLogical) setTimeout(() => triggerLogicUpdate(), 0);
    }, [onNodesChange, triggerLogicUpdate]);

    const onEdgesChangeWrapped = useCallback((changes: EdgeChange[]) => {
        onEdgesChange(changes);
        const isLogical = changes.some(c => c.type === 'add' || c.type === 'remove' || c.type === 'replace');
        if (isLogical) setTimeout(() => triggerLogicUpdate(), 0);
    }, [onEdgesChange, triggerLogicUpdate]);

    // Context-Aware Connect Refs
    const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null);
    const connectionMadeRef = useRef(false);
    const connectEndTimestampRef = useRef(0);
    const interactionLockRef = useRef(false); // Prevents overlapping events (e.g. drop vs click)
    const [pendingConnection, setPendingConnection] = useState<{ source: string; sourceHandle: string | null } | null>(null);

    // Cycle Detection (Stable - uses getEdges helper)
    const wouldCreateCycle = useCallback(
        (sourceId: string, targetId: string): boolean => {
            const currentEdges = getEdges();
            const successors = new Map<string, string[]>();
            currentEdges.forEach((e) => {
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
        [getEdges]
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



    // Handle new connection (Stable)
    const onConnect = useCallback(
        (params: Connection) => {
            connectionMadeRef.current = true;
            if (wouldCreateCycle(params.source!, params.target!)) {
                toast.error('⚠️ Loop detected! This connection would create a cycle.');
                return;
            }

            setEdges((eds) => {
                const currentNodes = getNodes();
                const targetNode = currentNodes.find((n) => n.id === params.target);
                const isOutputNode = targetNode?.type === 'outputNode';

                const filtered = eds.filter(
                    (e) => {
                        const isSameTargetHandle = e.target === params.target && e.targetHandle === params.targetHandle;
                        const isOutputNodeConflict = isOutputNode && e.target === params.target;
                        return !(isSameTargetHandle || isOutputNodeConflict);
                    }
                );
                return addEdge({ ...params, type: 'customEdge' }, filtered);
            });
            setTimeout(() => triggerLogicUpdate(), 0);
        },
        [wouldCreateCycle, getNodes, setEdges, triggerLogicUpdate]
    );

    // Handle edge reconnection (Blender-style: drag from handle to detach and reconnect)
    const onReconnect = useCallback(
        (oldEdge: Edge, newConnection: Connection) => {
            edgeReconnectSuccessful.current = true;
            // Check for cycle with the new connection
            if (wouldCreateCycle(newConnection.source!, newConnection.target!)) {
                toast.error('⚠️ Loop detected! This reconnection would create a cycle.');
                return;
            }

            // Enforce "one edge per input handle" during reconnection
            setEdges((eds) => {
                // Remove any *other* edge that is already connected to the *new* target handle
                // (We don't remove oldEdge here; reconnectEdge handles that update)
                const conflictingEdgesRemoved = eds.filter(e => {
                    const isConflicting = e.target === newConnection.target && e.targetHandle === newConnection.targetHandle;
                    // Don't filter out the edge being reconnected! ReactFlow needs it in the array to update it.
                    const isOldEdge = e.id === oldEdge.id;
                    return !isConflicting || isOldEdge;
                });

                return reconnectEdge(oldEdge, newConnection, conflictingEdgesRemoved);
            });
            setTimeout(() => triggerLogicUpdate(), 0);
        },
        [wouldCreateCycle, setEdges, triggerLogicUpdate]
    );

    const edgeReconnectSuccessful = useRef(true);
    const isReconnecting = useRef(false);

    const onReconnectStart = useCallback(() => {
        edgeReconnectSuccessful.current = false;
        isReconnecting.current = true;
    }, []);

    const onReconnectEnd = useCallback((_: MouseEvent | TouchEvent, edge: Edge) => {
        if (!edgeReconnectSuccessful.current) {
            setEdges((eds) => eds.filter((e) => e.id !== edge.id));
            setTimeout(() => triggerLogicUpdate(), 0);
        }
        edgeReconnectSuccessful.current = true;
    }, [setEdges, triggerLogicUpdate]);

    // Use store state for evaluation to catch deep data changes from NodeInput
    // --- Hand Integration ---
    const { memories } = useMemory();
    const { hands } = useHand(memories, setNodes, setEdges);


    // --- Eye Integration ---
    const { eyes } = useEye();

    // --- Mouth Integration ---
    const { mouth } = useMouth();

    // --- React Flow Utils ---
    // (Already declared above at top of component)

    // --- Hand Integration ---
    const addNode = useCallback(
        (type: string) => {
            const id = nanoid(8);
            const newNode: Node = {
                id,
                type,
                position: {
                    x: Math.random() * 400 + 100,
                    y: Math.random() * 400 + 100,
                },
                data: {
                    label: `New ${type.replace('Node', '')}`,
                    value: 0,
                },
            };
            setNodes((nds) => nds.concat(newNode));
        },
        [setNodes]
    );

    // Save (placeholder)
    // Save / Load / Reset
    const handleSave = () => {
        mouth.savor();
        toast.success('Session saved manually');
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





    // Better Auto-Save (Only savior logicVersion or structural-esque changes)
    // We avoid resetting the effect on every frame by checking the state outside the dependency array
    // Or just debouncing the mouth.savor call inside a stable event listener.
    // For now, let's just use logicVersion to trigger major saves, but nodes/edges for lazy saves.
    useEffect(() => {
        // We only reset the timeout if nodes/edges refs change, but wait...
        // Let's use logicVersion as the primary trigger for saving data, 
        // but for position saving, we use the existing debounce but maybe more aggressively filtered.
        const timeout = setTimeout(() => {
            mouth.savor();
        }, 2000);
        return () => clearTimeout(timeout);
    }, [logicVersion, mouth]); // Much more stable during drag! Positions will save once dragging stops.

    // Auto-Load (Eat) on Mount
    useEffect(() => {
        mouth.eat();
        // Force a calculation cycle immediately after loading to prevent "0" display pop-in
        triggerLogicUpdate();
    }, [mouth, triggerLogicUpdate]); // Added dependencies for stability

    // Listens for keyboard shortcuts and mouse movements
    useEar({
        hands,
        eyes,
        memories,
        setNodes,
        onOpenMenu: (pos) => setMenuPosition(pos),
    });

    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

    const onConnectStart = useCallback((_: any, params: { nodeId: string | null; handleId: string | null; handleType: string | null }) => {
        connectionStartRef.current = params;
        connectionMadeRef.current = false;
    }, []);

    // NOTE: onConnect is defined above at line 147

    const onConnectEnd = useCallback((event: any) => {
        const isReconnect = isReconnecting.current;
        const startParams = connectionStartRef.current;
        const connected = connectionMadeRef.current;

        // Record timestamp to prevent onPaneClick from firing immediately after
        const now = Date.now();
        connectEndTimestampRef.current = now;

        if (startParams && !connected && !isReconnect) {
            // If dragging from Source: Open Menu to add node
            // If dragging from Target (Input) and dropping in void: Just cancel (do nothing)
            // But checking handleType='source' might be strict. Let's rely on the fact that
            // "Dragging new wire" usually means we want to connect something.

            // Allow menu for Source handles primarily
            if (startParams.handleType === 'source') {
                // Ensure we get coordinates correctly
                const clientX = (event instanceof TouchEvent) ? event.changedTouches[0]?.clientX : event.clientX;
                const clientY = (event instanceof TouchEvent) ? event.changedTouches[0]?.clientY : event.clientY;

                if (clientX !== undefined && clientY !== undefined) {
                    setMenuPosition({ x: clientX, y: clientY });
                    setPendingConnection({
                        source: startParams.nodeId!,
                        sourceHandle: startParams.handleId
                    });
                }
            } else {
                setPendingConnection(null);
            }
        }
        connectionStartRef.current = null;
        isReconnecting.current = false;
    }, []);

    // Right Click Menu
    const onContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        // Check if clientX exists (MouseEvent)
        if ('clientX' in event) {
            setMenuPosition({ x: event.clientX, y: event.clientY });
        }
    }, []);



    const onPaneClick = useCallback(() => {
        // Prevent closing menu if we just finished a connection drag (within 300ms)
        if (Date.now() - connectEndTimestampRef.current < 300) return;
        setMenuPosition(null);
        setPendingConnection(null);
    }, []);

    // Helper to add node at menu position (Stable)
    const addNodeAtCursor = useCallback((type: string) => {
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

        // If there was a pending connection, create it!
        if (pendingConnection) {
            // Heuristic target handle matching standardized IDs
            let targetHandle = 'inputA';
            if (type === 'mathNode' || type === 'logicNode' || type === 'compareNode') targetHandle = 'inputA';
            else if (type === 'unaryNode' || type === 'outputNode' || type === 'solverNode') targetHandle = 'inputA';

            setEdges((eds) => addEdge({
                id: nanoid(6),
                source: pendingConnection.source,
                sourceHandle: pendingConnection.sourceHandle,
                target: id,
                targetHandle: targetHandle,
                type: 'customEdge',
            }, eds));
        }

        setNodes((nds) => nds.concat(newNode));
        setMenuPosition(null);
        setPendingConnection(null);
        triggerLogicUpdate();
    }, [menuPosition, screenToFlowPosition, pendingConnection, setEdges, setNodes, triggerLogicUpdate]);

    // Auto-Insert Logic (Stable)
    const onNodeDragStop = useCallback((_: any, node: Node) => {
        // Input Nodes cannot be inserted into wires (they have no inputs)
        if (node.type === 'inputNode') return;

        const currentNodes = getNodes();
        const currentEdges = getEdges();

        // Find visible edges
        const candidateEdges = currentEdges.filter(e => e.source !== node.id && e.target !== node.id);

        const w = node.measured?.width || node.width || 150;
        const h = node.measured?.height || node.height || 50;
        const cx = node.position.x + w / 2;
        const cy = node.position.y + h / 2;

        const threshold = 30; // pixels

        for (const edge of candidateEdges) {
            const sourceNode = currentNodes.find(n => n.id === edge.source);
            const targetNode = currentNodes.find(n => n.id === edge.target);
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

                let newNodeInput = 'inputA';

                // Smart Port Selection & Full Occupancy Check
                if (node.type === 'mathNode') {
                    const isInputAOccupied = currentEdges.some(e => e.target === node.id && e.targetHandle === 'inputA');
                    const isInputBOccupied = currentEdges.some(e => e.target === node.id && e.targetHandle === 'inputB');

                    if (isInputAOccupied) {
                        if (isInputBOccupied) {
                            // Both ports full: Abort Auto-Insert
                            continue;
                        }
                        newNodeInput = 'inputB';
                    }
                } else {
                    // For single-input nodes (Unary, Output, Solver), abort if inputA is occupied
                    const isInputAOccupied = currentEdges.some(e => e.target === node.id && e.targetHandle === 'inputA');
                    if (isInputAOccupied) {
                        continue;
                    }
                }

                let newNodeOutput = null; // Default output (null for generic source handle)



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
                    sourceHandle: newNodeOutput, // Default source handle
                    target: edge.target,
                    targetHandle: edge.targetHandle,
                    type: 'customEdge'
                };

                // Update edges:
                // 1. Remove the edge we split (edge.id)
                // 2. Remove any PRE-EXISTING edge to the inserted node's input (newNodeInput)
                //    This prevents the "double connection" bug when inserting a node that already has a wire.
                setEdges(eds => {
                    return eds
                        .filter(e => e.id !== edge.id) // Remove split edge
                        .filter(e => !(e.target === node.id && e.targetHandle === newNodeInput)) // Remove old input to inserted node
                        .concat([newEdge1, newEdge2]);
                });

                toast.success('Auto-inserted node!');
                break; // One insertion at a time
            }
        }
    }, [getNodes, getEdges, setEdges]);



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



    return (
        <div
            className="h-screen w-screen bg-zinc-900 relative"
            onContextMenu={onContextMenu}
        >

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
                    <button onClick={() => addNodeAtCursor('logicNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <ToggleRight className="w-4 h-4 text-indigo-400" /> Logic
                    </button>
                    <button onClick={() => addNodeAtCursor('compareNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Scale className="w-4 h-4 text-teal-400" /> Compare
                    </button>
                    <button onClick={() => addNodeAtCursor('solverNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Sigma className="w-4 h-4 text-indigo-500" /> Solver
                    </button>
                    <button onClick={() => addNodeAtCursor('outputNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Monitor className="w-4 h-4 text-green-500" /> Output
                    </button>
                </div>
            )}


            {/* React Flow */}
            <div className="w-screen h-screen bg-zinc-950 text-white overflow-hidden select-none">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChangeWrapped}
                    onEdgesChange={onEdgesChangeWrapped}
                    onConnect={onConnect}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    onReconnect={onReconnect}
                    onReconnectStart={onReconnectStart}
                    onReconnectEnd={onReconnectEnd}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    className="bg-zinc-950"
                    minZoom={0.1}
                    maxZoom={4}
                    defaultEdgeOptions={defaultEdgeOptions}
                    onPaneContextMenu={onContextMenu}
                    onPaneClick={onPaneClick}
                >
                    <Background color="#222" gap={20} />
                    <Controls className="bg-zinc-900 border-zinc-800 text-zinc-400" />
                    <MiniMap
                        className="bg-zinc-900 border-zinc-800"
                        nodeColor={nodeColor}
                    />

                    {/* Top Panel */}
                    <Panel position="top-right" className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleDisplayMode}
                            className="gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                        >
                            {displayMode === 'value' ? <Hash className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                            {displayMode === 'value' ? 'Values' : 'Formulas'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleSave} className="text-zinc-400 hover:text-green-400 hover:bg-zinc-700" title="Save Session">
                            <Save className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => mouth.spit()} className="text-zinc-400 hover:text-blue-400 hover:bg-zinc-700" title="Export JSON">
                            <Download className="w-5 h-5" />
                        </Button>
                        <div className="w-px h-6 bg-zinc-700 mx-1 self-center" />
                        <Button variant="ghost" size="icon" onClick={handleGroupSelection} className="text-zinc-400 hover:text-purple-400 hover:bg-zinc-700" title="Group Selected">
                            <Group className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleUngroup} className="text-zinc-400 hover:text-pink-400 hover:bg-zinc-700" title="Ungroup">
                            <Ungroup className="w-5 h-5" />
                        </Button>
                        <div className="w-px h-6 bg-zinc-700 mx-1 self-center" />
                        <Button variant="ghost" size="icon" onClick={() => { mouth.diet(); window.location.reload(); }} className="text-zinc-400 hover:text-red-400 hover:bg-zinc-700" title="Clear & Reset">
                            <Trash className="w-5 h-5" />
                        </Button>
                    </Panel>
                    <MiniMap
                        nodeColor="#888"
                        maskColor="rgba(0,0,0,0.6)"
                        className="!bg-zinc-800 !border-zinc-700 rounded-lg"
                    />
                </ReactFlow>
            </div>
        </div>
    );
}

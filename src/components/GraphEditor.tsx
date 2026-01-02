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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import { Save, Plus, Calculator, Hash, Monitor } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { NodeInput } from './nodes/NodeInput';
import { NodeMath } from './nodes/NodeMath';
import { NodeUnary } from './nodes/NodeUnary';
import { NodeOutput } from './nodes/NodeOutput';
import { CustomEdge } from './edges/CustomEdge';
import { evaluateGraph } from '@/lib/engine';

const nodeTypes: NodeTypes = {
    inputNode: NodeInput,
    mathNode: NodeMath,
    unaryNode: NodeUnary,
    outputNode: NodeOutput,
};

const edgeTypes: EdgeTypes = {
    customEdge: CustomEdge,
};

const defaultNodes: Node[] = [
    {
        id: 'input-a',
        type: 'inputNode',
        position: { x: 100, y: 100 },
        data: { label: 'Value A', value: 10 },
    },
    {
        id: 'input-b',
        type: 'inputNode',
        position: { x: 100, y: 300 },
        data: { label: 'Value B', value: 7 },
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
        (connection: Connection) => {
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

    // Create a key based on input node values AND operation changes to trigger re-evaluation
    const graphStateKey = useMemo(() => {
        const inputKeys = nodes
            .filter((n) => n.type === 'inputNode')
            .map((n) => `${n.id}:${n.data.value}`);
        const opKeys = nodes
            .filter((n) => n.type === 'mathNode' || n.type === 'unaryNode')
            .map((n) => `${n.id}:${n.data.operation}`);
        return [...inputKeys, ...opKeys].join(',');
    }, [nodes]);

    // Evaluate graph and update node data
    useEffect(() => {
        const computed = evaluateGraph(nodes as never[], edges as never[]);
        let hasChanges = false;
        const newNodes = nodes.map((node) => {
            const computedNode = computed.get(node.id);
            if (
                computedNode &&
                node.type !== 'inputNode' &&
                computedNode.data.value !== node.data.value
            ) {
                hasChanges = true;
                return { ...node, data: { ...node.data, value: computedNode.data.value } };
            }
            return node;
        });
        if (hasChanges) {
            setNodes(newNodes);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edges, graphStateKey]);

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

    return (
        <div className="h-screen w-screen bg-zinc-900 relative">
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
                </div>
            </div>

            {/* Floating Toolbar */}
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
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'customEdge' }}
                isValidConnection={isValidConnection}
                fitView
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

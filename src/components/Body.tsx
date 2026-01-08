'use client';

import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    useReactFlow,
    SelectionMode,
    type XYPosition,
    ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
    Plus, Calculator, Sigma, Monitor, Save, Download,
    Trash, Hash, Scale, ToggleRight, Group, Ungroup, LayoutTemplate, Sliders
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';

import { useHand } from '../nerves/useHand';
import { useEar } from '../nerves/useEar';
import { useEye } from '../nerves/useEye';
import { useLayout } from '../nerves/useLayout';
import { useMemory } from '../nerves/useMemory';
import { useMouth } from '../nerves/useMouth';

import { Skin } from './Skin';
import { KnifeVisual } from './tools/KnifeVisual';

// Sub-Hooks and Configuration
import { nodeTypes, edgeTypes, nodeColor, defaultEdgeOptions } from './Body/GraphConfig';
import { useGraphState } from './Body/useGraphState';
import { useKnifeTool } from './Body/useKnifeTool';
import { useContextMenu } from './Body/useContextMenu';
import { usePersistence } from './Body/usePersistence';

export function Body() {
    const { screenToFlowPosition } = useReactFlow();
    const { displayMode, toggleDisplayMode, triggerLogicUpdate, logicVersion } = useAppStore();

    // --- State & Organs ---
    const [menuPosition, setMenuPosition] = useState<XYPosition | null>(null);
    const { memories } = useMemory();
    const { eyes } = useEye();
    const { mouth } = useMouth();
    const { layoutGraph } = useLayout(memories);

    // --- Modular Logic Hooks ---
    const {
        nodes, setNodes, onNodesChange,
        edges, setEdges, onEdgesChange,
        onConnect, onReconnect, onReconnectStart, onReconnectEnd
    } = useGraphState(eyes, memories);

    const { hands } = useHand(memories, setNodes, setEdges);

    // Context Menu Logic
    const {
        pendingConnection, setPendingConnection,
        menuRef, closeMenu, addNodeAtCursor
    } = useContextMenu(
        menuPosition,
        setMenuPosition,
        screenToFlowPosition,
        setNodes,
        setEdges,
        () => nodes,
        triggerLogicUpdate
    );

    // Ears (Keyboard & Mouse Context)
    const handsWithLayout = useMemo(() => ({ ...hands, layoutGraph }), [hands, layoutGraph]);
    const { keys } = useEar({
        hands: handsWithLayout,
        eyes,
        memories,
        onOpenMenu: (pos) => setMenuPosition(pos),
    });

    // Knife Tool
    const knife = useKnifeTool(keys, eyes, hands, screenToFlowPosition);

    // Persistence & Scene Actions
    const {
        handleSave, handleReset, handleGroupSelection, handleUngroup
    } = usePersistence(nodes, edges, setNodes, setEdges, mouth, triggerLogicUpdate, logicVersion);

    // --- Local Event Handlers (Orchestration) ---
    const onContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
        event.preventDefault();
        if (keys.ctrl || knife.isCutting) return;
        if ('clientX' in event) {
            setMenuPosition({ x: event.clientX, y: event.clientY });
        }
    }, [keys.ctrl, knife.isCutting]);

    const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null);

    const onConnectStartWrapped = useCallback((_: any, params: any) => {
        connectionStartRef.current = params;
        onReconnectStart();
    }, [onReconnectStart]);

    const onConnectEndWrapped = useCallback((event: any) => {
        const startParams = connectionStartRef.current;
        if (startParams && startParams.handleType === 'source') {
            const clientX = (event instanceof TouchEvent) ? event.changedTouches[0]?.clientX : event.clientX;
            const clientY = (event instanceof TouchEvent) ? event.changedTouches[0]?.clientY : event.clientY;

            if (clientX !== undefined && clientY !== undefined) {
                setMenuPosition({ x: clientX, y: clientY });
                setPendingConnection({
                    source: startParams.nodeId!,
                    sourceHandle: startParams.handleId
                });
            }
        }
        connectionStartRef.current = null;
    }, [setMenuPosition, setPendingConnection]);

    const onNodeDragStop = useCallback((_: any, node: any) => {
        const candidate = eyes.scanInsertionCandidate(node);
        if (candidate) hands.injectNode(node, candidate.edge, candidate.targetHandle);
    }, [eyes, hands]);

    return (
        <div
            className="h-screen w-screen bg-zinc-900 relative"
            onContextMenu={onContextMenu}
            onMouseDown={knife.onMouseDown}
            onMouseMove={knife.onMouseMove}
            onMouseUp={knife.onMouseUp}
        >
            {/* Context Menu (Blender Style) */}
            {menuPosition && (
                <div
                    ref={menuRef}
                    className="absolute z-100 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-1 min-w-[150px] flex flex-col gap-1"
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
                    <button onClick={() => addNodeAtCursor('switchNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <ToggleRight className="w-4 h-4 text-indigo-500" /> Switch
                    </button>
                    <button onClick={() => addNodeAtCursor('sliderNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Sliders className="w-4 h-4 text-indigo-400" /> Slider
                    </button>
                    <button onClick={() => addNodeAtCursor('solverNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Sigma className="w-4 h-4 text-indigo-500" /> Solver
                    </button>
                    <button onClick={() => addNodeAtCursor('outputNode')} className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-700 rounded text-sm text-zinc-200 text-left">
                        <Monitor className="w-4 h-4 text-green-500" /> Output
                    </button>
                </div>
            )}

            <div className="w-screen h-screen bg-zinc-950 text-white overflow-hidden select-none">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onConnectStart={onConnectStartWrapped}
                    onConnectEnd={onConnectEndWrapped}
                    onReconnect={onReconnect}
                    onReconnectStart={onReconnectStart}
                    onReconnectEnd={onReconnectEnd}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionLineType={ConnectionLineType.Bezier}
                    connectionLineStyle={{ stroke: '#71717a', strokeWidth: 2 }}
                    fitView
                    className="bg-zinc-950"
                    minZoom={0.1}
                    maxZoom={4}
                    defaultEdgeOptions={defaultEdgeOptions}
                    panOnDrag={[1, 2]}
                    selectionOnDrag
                    selectionMode={SelectionMode.Partial}
                    onPaneContextMenu={onContextMenu}
                    onMoveStart={() => setMenuPosition(null)}
                >
                    <Background color="#222" gap={20} />
                    <Controls className="bg-zinc-900 border-zinc-800 text-zinc-400" />
                    <MiniMap className="bg-zinc-900 border-zinc-800" nodeColor={nodeColor} />

                    <Panel position="top-right" className="flex gap-2">
                        <div className="bg-zinc-800 border border-zinc-700 text-zinc-400 px-3 py-1 rounded-md text-sm font-mono flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            {nodes.length} Nodes
                        </div>
                        <Button variant="outline" size="sm" onClick={toggleDisplayMode} className="gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                            {displayMode === 'value' ? <Hash className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                            {displayMode === 'value' ? 'Values' : 'Formulas'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={layoutGraph} className="gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                            <LayoutTemplate className="w-4 h-4" />
                            Layout
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleSave} title="Save Session"><Save className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => mouth.spit()} title="Export JSON"><Download className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleGroupSelection} title="Group Selected"><Group className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleUngroup} title="Ungroup"><Ungroup className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleReset} title="Clear & Reset"><Trash className="w-5 h-5" /></Button>
                    </Panel>
                </ReactFlow>
            </div>
            {knife.isCutting && <KnifeVisual path={knife.knifePath} />}
        </div>
    );
}

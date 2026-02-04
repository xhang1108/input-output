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
    Trash, Hash, Scale, ToggleRight, Group, Ungroup, LayoutTemplate, Sliders, Settings as SettingsIcon, Box
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
import { Profiler, useRenderTracker } from './debug/Profiler';

function SettingsMenu() {
    const { settings, updateSettings } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(!isOpen)}
                title="Settings"
                className={isOpen ? 'bg-zinc-800 text-white' : ''}
            >
                <SettingsIcon className="w-5 h-5" />
            </Button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-4 flex flex-col gap-4 z-50">
                    <div className="text-sm font-bold text-zinc-400 border-b border-zinc-700 pb-2">Appearance & Performance</div>

                    <div className="flex items-center justify-between">
                        <Label htmlFor="minimap" className="text-zinc-200 text-sm">
                            MiniMap <span className="text-zinc-500 text-xs">({settings.showMinimap ? 'ON' : 'OFF'})</span>
                        </Label>
                        <Switch
                            id="minimap"
                            checked={settings.showMinimap}
                            onCheckedChange={(c) => updateSettings({ showMinimap: c })}
                            className="scale-75"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="animations" className="text-zinc-200 text-sm">
                            Flow Animations <span className="text-zinc-500 text-xs">({settings.enableAnimations ? 'ON' : 'OFF'})</span>
                        </Label>
                        <Switch
                            id="animations"
                            checked={settings.enableAnimations}
                            onCheckedChange={(c) => updateSettings({ enableAnimations: c })}
                            className="scale-75"
                        />
                    </div>

                    <div className="text-sm font-bold text-zinc-400 border-b border-zinc-700 pb-2 mt-2">Connection Style</div>
                    <div className="flex flex-col gap-2">
                        {['step', 'bezier', 'straight'].map((style) => (
                            <div key={style} className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    id={`style-${style}`}
                                    name="edgeStyle"
                                    value={style}
                                    checked={settings.edgeStyle === style}
                                    onChange={() => updateSettings({ edgeStyle: style as any })}
                                    className="accent-primary"
                                />
                                <Label htmlFor={`style-${style}`} className="text-zinc-200 text-sm capitalize">
                                    {style}
                                </Label>
                            </div>
                        ))}
                    </div>

                    <div className="text-sm font-bold text-zinc-400 border-b border-zinc-700 pb-2 mt-2">Debug</div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="debug" className="text-zinc-200 text-sm">
                            Show Performance <span className="text-zinc-500 text-xs">({settings.showDebugInfo ? 'ON' : 'OFF'})</span>
                        </Label>
                        <Switch
                            id="debug"
                            checked={settings.showDebugInfo}
                            onCheckedChange={(c) => updateSettings({ showDebugInfo: c })}
                            className="scale-75"
                        />
                    </div>
                </div>
            )}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}

export function Body() {
    useRenderTracker('Body');
    const { screenToFlowPosition } = useReactFlow();
    const { triggerLogicUpdate, logicVersion, settings } = useAppStore();

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
        menuRef, closeMenu, addNodeAtCursor,
        adjustedPosition,
        connectionHandlers
    } = useContextMenu(
        menuPosition,
        setMenuPosition,
        screenToFlowPosition,
        setNodes,
        setEdges,
        () => nodes,
        triggerLogicUpdate,
        onConnect,
        onReconnectStart,
        onReconnectEnd
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
    // const { logicVersion, settings } = useAppStore(); // Removed duplicate
    const {
        handleSave, handleReset, handleGroupSelection, handleUngroup
    } = usePersistence(nodes, edges, setNodes, setEdges, mouth, triggerLogicUpdate, logicVersion, settings);

    // --- Local Event Handlers (Orchestration) ---
    const onContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
        // If we are currently placing/transforming nodes, right click should be handled by useHand (cancellation)
        // and we must NOT open the menu.
        if (hands.isPlacing || keys.ctrl || knife.isCutting) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        event.preventDefault();
        if ('clientX' in event) {
            setMenuPosition({ x: event.clientX, y: event.clientY });
        }
    }, [hands.isPlacing, keys.ctrl, knife.isCutting]);


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
            {useAppStore.getState().settings.showDebugInfo && <Profiler />}
            {/* Context Menu (Blender Style) */}
            {menuPosition && (
                <div
                    ref={menuRef}
                    className="fixed z-1000 bg-zinc-800/95 backdrop-blur-md border border-zinc-700/50 rounded-lg shadow-2xl p-1 min-w-[160px] flex flex-col gap-0.5 transition-all duration-75 animate-in fade-in zoom-in-95"
                    style={{
                        top: adjustedPosition?.y ?? menuPosition.y,
                        left: adjustedPosition?.x ?? menuPosition.x,
                        opacity: adjustedPosition ? 1 : 0
                    }}
                    onClick={(e) => e.stopPropagation()}
                >

                    <button onClick={() => addNodeAtCursor('mathNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Plus className="w-4 h-4 text-orange-500" /> Math
                    </button>
                    <button onClick={() => addNodeAtCursor('unaryNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Calculator className="w-4 h-4 text-purple-500" /> Function
                    </button>
                    <button onClick={() => addNodeAtCursor('logicNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <ToggleRight className="w-4 h-4 text-indigo-400" /> Logic
                    </button>
                    <button onClick={() => addNodeAtCursor('compareNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Scale className="w-4 h-4 text-teal-400" /> Compare
                    </button>
                    <button onClick={() => addNodeAtCursor('switchNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <ToggleRight className="w-4 h-4 text-indigo-500" /> Switch
                    </button>
                    <button onClick={() => addNodeAtCursor('sliderNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Sliders className="w-4 h-4 text-indigo-400" /> Slider
                    </button>
                    <button onClick={() => addNodeAtCursor('solverNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Sigma className="w-4 h-4 text-indigo-500" /> Solver
                    </button>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-t border-zinc-700/50 mt-1 mb-0.5">Inputs</div>
                    <button onClick={() => addNodeAtCursor('inputNumber')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Hash className="w-4 h-4 text-blue-500" /> Number
                    </button>
                    <button onClick={() => addNodeAtCursor('inputMatrix')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <LayoutTemplate className="w-4 h-4 text-blue-500" /> Matrix
                    </button>

                    <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider border-t border-zinc-700/50 mt-1 mb-0.5">Results</div>
                    <button onClick={() => addNodeAtCursor('monitorNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Monitor className="w-4 h-4 text-green-500" /> Result
                    </button>
                    <button onClick={() => addNodeAtCursor('formulaNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Sigma className="w-4 h-4 text-purple-500" /> Formula
                    </button>
                    <button onClick={() => addNodeAtCursor('macroNode')} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700/50 rounded-md text-sm text-zinc-200 text-left transition-colors">
                        <Box className="w-4 h-4 text-amber-500" /> Macro
                    </button>
                </div>
            )}

            <div className="w-screen h-screen bg-zinc-950 text-white overflow-hidden select-none">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={connectionHandlers.onConnect}
                    onConnectStart={connectionHandlers.onConnectStart}
                    onConnectEnd={connectionHandlers.onConnectEnd}
                    onReconnect={onReconnect}
                    onReconnectStart={connectionHandlers.onReconnectStart}
                    onReconnectEnd={connectionHandlers.onReconnectEnd}
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
                    onMoveStart={() => setMenuPosition(null)}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color="#222" gap={20} />
                    {/* Controls removed per user request */}
                    {useAppStore.getState().settings.showMinimap && (
                        <MiniMap className="bg-zinc-900 border-zinc-800" nodeColor={nodeColor} />
                    )}

                    <Panel position="top-right" className="flex gap-2">
                        <div className="bg-zinc-800 border border-zinc-700 text-zinc-400 px-3 py-1 rounded-md text-sm font-mono flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            {nodes.length} Nodes
                        </div>
                        <Button variant="outline" size="sm" onClick={layoutGraph} className="gap-2 bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-zinc-300">
                            <LayoutTemplate className="w-4 h-4" />
                            Layout
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleSave} title="Save Session"><Save className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => mouth.spit()} title="Export JSON"><Download className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleGroupSelection} title="Group Selected"><Group className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleUngroup} title="Ungroup"><Ungroup className="w-5 h-5" /></Button>
                        <Button variant="ghost" size="icon" onClick={handleReset} title="Clear & Reset"><Trash className="w-5 h-5" /></Button>
                        <div className="w-px h-6 bg-zinc-700 mx-1" />
                        <SettingsMenu />
                    </Panel>
                </ReactFlow>
            </div>
            {knife.isCutting && <KnifeVisual path={knife.knifePath} />}
        </div>
    );
}

'use client';

import {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    SelectionMode,
    ConnectionMode,
    ConnectionLineType,
    OnConnectStartParams,
} from '@xyflow/react';
import { RelinkLine, RelinkContext } from './edges/RelinkLine';
import '@xyflow/react/dist/style.css';

import { useRef, useCallback, useState, useEffect } from 'react';
import { SoulRenderer } from '../utils/SoulRenderer';
import { nodeTypes, edgeTypes } from '../config/nodeTypeMap';
import { getCanvasMenuItems, getNodeMenuItems } from '../config/contextMenuItems';
import { useEar } from '../nerves/useEar';
import { useHand } from '../nerves/useHand';
import { useEye } from '../nerves/useEye';
import { useCanvasProjection } from '../hooks/useCanvasProjection';
import { useRelink } from '../hooks/useRelink';
import { useAutoInsert } from '../hooks/useAutoInsert';
import { useNodeSpawner } from '../hooks/useNodeSpawner';
import { useProjectSave } from '../hooks/useProjectSave';
import { CommandPalette } from './ui/CommandPalette';
import { DebugOverlay } from './ui/DebugOverlay';
import { InspectorPanel } from './ui/InspectorPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import { useMemory, initialNodes } from '../engine/useMemory';
import { useBrainSync } from '../hooks/useBrainSync';
import { ContextMenu } from './ui/ContextMenu';
import { StatusBar } from './ui/StatusBar';
import { Brain } from '../engine/Brain';
import { NodeRegistry } from '../engine/NodeRegistry';
import { useBrainUpdates } from '../hooks/useBrainUpdates';
import { useAutoLayout } from '../hooks/useAutoLayout';
import { useAppStore } from '../store/useStore';
import { toast } from 'sonner';

// nodeTypes and edgeTypes imported from config/nodeTypeMap.ts

export function Body() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // UI Helpers
    const mousePosRef = useRef({ x: 0, y: 0 });
    const [isSnapping, setIsSnapping] = useState(false);

    const {
        showPalette, setShowPalette,
        palettePosition, setPalettePosition,
        showInspector, setShowInspector,
        manualSnap, setManualSnap,
        showGrid, setShowGrid,
        showDebug, setShowDebug,
        edgeType, setEdgeType,
        edgeAnimation, setEdgeAnimation,
        layoutAlgorithm, setLayoutAlgorithm,
        layoutDirection, setLayoutDirection,
        panOnScroll, setPanOnScroll,
        actionLog, logAction
    } = useAppStore();

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        type: 'CANVAS' | 'NODE';
        nodeId?: string;
    } | null>(null);

    // pendingConnection and spawnNode managed by useNodeSpawner
    // highlightedEdgeId and autoInsert managed by useAutoInsert

    const effectiveSnap = isSnapping || manualSnap;

    // Save/Load Hook
    const { saveProject } = useProjectSave();

    // Sync Edge Type for existing edges
    // (Removed duplicate useEffect that caused ReferenceError)


    // Get flow helpers
    const { focusOn, resetView, getZoom } = useEye();

    // Action Log is handled by useAppStore

    const { handleAutoLayout } = useAutoLayout(
        nodes,
        edges,
        setNodes,
        setEdges,
        layoutAlgorithm,
        layoutDirection,
        logAction
    );

    const {
        startGrab,
        startScale,
        startRotate,
        confirmGrab,
        cancelGrab,
        duplicateSelected,
        groupSelected,
        copyToClipboard,
        pasteFromClipboard,
        deleteSelected,
        resetSelected,
        setAxisLock,
        handleMouseMove,
        handleMouseDown,
        handleMouseUp,
        mode,
        cutPath,
        swapConnections,
        detachSelected,
        clearSelection,
        selectNode,
        handleTypeNum,
        transformBuffer,
        transformValue
    } = useHand();

    // Memory (Nodes & Edges Persistence)
    const { clearMemory } = useMemory(nodes, edges, setNodes, setEdges, logAction);

    // Node Spawner (Command Palette + Auto-Link)
    const { pendingConnection, setPendingConnection, spawnNode } = useNodeSpawner({
        palettePosition,
        edgeType,
        edgeAnimation,
        setNodes,
        setEdges,
        logAction,
    });

    // Auto Insert (Drag over edge to split)
    const { highlightedEdgeId, detectAutoInsert, performAutoInsert } = useAutoInsert({
        nodes,
        edges,
        mode,
        edgeType,
        edgeAnimation,
        setEdges,
        logAction,
    });

    // Sync Edge Type and Highlight State
    useEffect(() => {
        setEdges(eds => eds.map(e => ({
            ...e,
            data: {
                ...e.data,
                pathType: edgeType,
                animate: edgeAnimation,
                isHighlighted: e.id === highlightedEdgeId
            }
        })));
    }, [edgeType, edgeAnimation, highlightedEdgeId, setEdges]);

    // Brain Sync (Shadow Mirror)
    useBrainSync(nodes, edges);
    // Brain Updates (Reverse Sync: Brain -> UI)
    useBrainUpdates(setNodes, setEdges);

    // Connect Brain Log to UI Log
    useEffect(() => {
        const brain = Brain.getInstance();
        // @ts-expect-error - Expose for debugging
        window.Brain = Brain;
        // @ts-expect-error - Expose for debugging
        window.brain = brain;
        // @ts-expect-error - Expose for debugging
        window.NodeRegistry = NodeRegistry;
        // @ts-expect-error - Expose for debugging
        window.SoulRenderer = SoulRenderer;

        // @ts-expect-error - Debug helper
        window.debugBrain = () => {
            console.log('Brain State:', (brain as any).state);
            console.log('Available Nodes:', Array.from((brain as any).state.nodes.keys()));
            console.log('Registered Evaluators:', (NodeRegistry as any).evaluators.size);
            console.log('Registered Symbolizers:', (NodeRegistry as any).symbolizers.size);
        };
        // @ts-expect-error - Debug helper
        window.getNodes = () => Array.from((brain as any).state.nodes.values());

        const cleanupLog = brain.on('log', (msg: unknown) => logAction(String(msg)));
        return () => { cleanupLog(); };
    }, [logAction]);

    // Debug: Log Mode Changes
    useEffect(() => {
        logAction(`Mode: ${mode}`);
    }, [mode, logAction]);

    // Track Modifiers for Snapping (Standard Drag)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsSnapping(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsSnapping(false);
        };
        const handleBlur = () => {
            setIsSnapping(false); // Reset on focus loss
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        }
    }, []);

    // spawnNode managed by useNodeSpawner hook

    // --- Custom Handle Interactions State ---
    const {
        relinkState,
        onRelinkStart,
        onRelinkEnd,
        onRelinkConnect,
        isValidRelinkConnection,
        isRelinkActive
    } = useRelink({
        edges,
        setEdges,
        logAction,
        edgeType,
        edgeAnimation: edgeAnimation,
        onSmartLinkSearch: (params) => {
            console.log('Smart Link Search Triggered via useRelink:', params);
            setPalettePosition(params.position);
            setShowPalette(true);
            paletteGuardRef.current = true; // Block immediate close from background click

            // Store for auto-link
            setPendingConnection({
                nodeId: params.nodeId,
                handleId: params.handleId,
                handleType: params.handleType
            });

            logAction(`Smart Search: from ${params.nodeId}`);
        }
    });

    const onConnectStart = useCallback((event: MouseEvent | TouchEvent, params: OnConnectStartParams): void => {
        onRelinkStart(event, params);
    }, [onRelinkStart]);

    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connectionState: { toNode: { id: string } | null; toHandle: { id?: string | null } | null; isValid: boolean | null } | null) => {
        onRelinkEnd(event, connectionState);
    }, [onRelinkEnd]);

    // --- Auto-Resize Frame on Child Drag ---


    const relinkValue = {
        ...relinkState,
        edgeType // Inject current edgeType into RelinkContext
    };

    // --- FEEL NERVES (Input Handling) ---
    // ... (Keep useEar existing logic) ...
    // Note: Since I am replacing the block where pendingInputRelocation was defined, I must be careful not to delete useEar if it was below.
    // Checking file content... useEar starts at line 265.
    // I will target the onConnect/Return block specifically.

    /*
     Wait, I cannot easily replace the useState AND the JSX in one go if they are far apart.
     I will break this into two edits.
     1. Add State (Lines 258-260).
     2. Update JSX (Lines 504-600).
    */
    // Guard: Prevent onConnectStart from interfering with native Reconnect
    const paletteGuardRef = useRef(false);

    // --- FEEL NERVES (Input Handling) ---

    useEar({
        shortcuts: {
            // Creation & Layout
            'shift+a': (e) => { e.preventDefault(); setPalettePosition(mousePosRef.current); setShowPalette(true); logAction('Show Palette (Shift+A)'); },
            'alt+s': (e) => { e.preventDefault(); swapConnections(); logAction('Swap Inputs (Alt+S)'); },
            'l': () => { handleAutoLayout(); },
            '.': (e) => {
                if (mode === 'GRABBING' || mode === 'SCALING' || mode === 'ROTATING') {
                    handleTypeNum('.');
                } else {
                    const selected = nodes.filter(n => n.selected);
                    const actionName = focusOn(selected);
                    logAction(`${actionName} (.)`);
                }
            },

            // Transform Commands
            'g': (e) => { startGrab(mousePosRef.current, e.altKey); logAction('Start Grab (G)'); },
            's': (e) => { startScale(mousePosRef.current); logAction('Start Scale (S)'); },
            'r': (e) => { startRotate(mousePosRef.current); logAction('Start Rotate (R)'); },
            'shift+d': (e) => {
                e.preventDefault();
                const newNodes = duplicateSelected();
                if (newNodes) {
                    startGrab(mousePosRef.current, false, newNodes as Node[]);
                    logAction('Duplicate Selected (Shift+D)');
                }
            },
            'f': (e) => { e.preventDefault(); groupSelected(); logAction('Group Selected (F)'); },

            // Node Operations
            'delete': () => {
                const active = document.activeElement?.tagName;
                if (active !== 'INPUT' && active !== 'TEXTAREA' && mode === 'IDLE') {
                    deleteSelected();
                    logAction('Delete Selected');
                }
            },
            'x': () => {
                const active = document.activeElement?.tagName;
                if (active === 'INPUT' || active === 'TEXTAREA') return;

                if (mode === 'GRABBING' || mode === 'SCALING') {
                    setAxisLock('X');
                    logAction('Axis Lock X');
                } else if (mode === 'IDLE') {
                    deleteSelected();
                    logAction('Delete Selected');
                }
                // During ROTATING or CUTTING, 'x' does nothing (doesn't delete)
            },

            'a': (e) => {
                if (!e.shiftKey && !e.ctrlKey) {
                    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
                    logAction('Select All (A)');
                }
            },
            'n': (e) => { e.preventDefault(); setShowInspector((prev: boolean) => !prev); logAction('Toggle Inspector (N)'); },
            'm': () => {
                const active = document.activeElement?.tagName;
                if (active === 'INPUT' || active === 'TEXTAREA') return;

                const selected = nodes.filter(n => n.selected);
                selected.forEach(node => {
                    const isMuted = !!node.data?.muted;
                    Brain.getInstance().applyTransaction({
                        type: 'UPDATE_NODE_DATA',
                        payload: { id: node.id, data: { muted: !isMuted } }
                    });
                });
                if (selected.length > 0) logAction(`Toggle Mute [${selected.length}] (M)`);
            },

            // Axis Lock (While Grabbing/Scaling)
            'y': () => { if (mode === 'GRABBING' || mode === 'SCALING') { setAxisLock('Y'); logAction('Axis Lock Y'); } },

            // Clipboard
            'ctrl+c': () => { copyToClipboard(); logAction('Copy (Ctrl+C)'); },
            'cmd+c': () => { copyToClipboard(); logAction('Copy (Cmd+C)'); },
            'ctrl+v': () => { pasteFromClipboard(); logAction('Paste (Ctrl+V)'); },
            'cmd+v': () => { pasteFromClipboard(); logAction('Paste (Cmd+V)'); },

            // Save
            'ctrl+s': (e) => { e.preventDefault(); saveProject(); logAction('Save Project (Ctrl+S)'); },
            'cmd+s': (e) => { e.preventDefault(); saveProject(); logAction('Save Project (Cmd+S)'); },

            // Confirmation & Navigation
            'enter': () => { confirmGrab(); logAction('Confirm (Enter)'); },
            'escape': () => {
                cancelGrab();
                setShowPalette(false);
                setShowInspector(false);
                setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                logAction('Cancel/Deselect (Esc)');
            },

            // Numeric Inputs for Transform
            '0': () => handleTypeNum('0'),
            '1': () => handleTypeNum('1'),
            '2': () => handleTypeNum('2'),
            '3': () => handleTypeNum('3'),
            '4': () => handleTypeNum('4'),
            '5': () => handleTypeNum('5'),
            '6': () => handleTypeNum('6'),
            '7': () => handleTypeNum('7'),
            '8': () => handleTypeNum('8'),
            '9': () => handleTypeNum('9'),

            '-': () => handleTypeNum('-'),
            'backspace': () => {
                const active = document.activeElement?.tagName;
                if (active !== 'INPUT' && active !== 'TEXTAREA') {
                    if (transformBuffer) {
                        handleTypeNum('Backspace');
                    } else {
                        // Standard Backspace Logic (Reset)
                        resetSelected();
                        logAction('Reset Selected');
                    }
                }
            },
        },
        deps: [startGrab, startScale, startRotate, confirmGrab, cancelGrab, duplicateSelected, copyToClipboard, pasteFromClipboard, groupSelected, deleteSelected, resetSelected, focusOn, nodes, setNodes, mode, setAxisLock, swapConnections, logAction, mousePosRef, setPalettePosition, setShowPalette, setShowInspector, handleAutoLayout, handleTypeNum, transformBuffer, saveProject]
    });


    // Auto Insert logic managed by useAutoInsert hook

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
        handleMouseMove(e.nativeEvent);
        detectAutoInsert(); // Check for insert opportunities
    }, [handleMouseMove, detectAutoInsert]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        handleMouseDown(e.nativeEvent);
    }, [handleMouseDown]);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
        handleMouseUp(e.nativeEvent);
        performAutoInsert(); // Execute insert if valid
    }, [handleMouseUp, performAutoInsert]);

    const onClick = useCallback((e: React.MouseEvent) => {
        if (paletteGuardRef.current) {
            paletteGuardRef.current = false;
            return;
        }
        if (showPalette) setShowPalette(false);
        if (contextMenu) setContextMenu(null);
        if (['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) confirmGrab();
    }, [mode, confirmGrab, showPalette, contextMenu, setShowPalette, setContextMenu]);


    return (
        <RelinkContext.Provider value={relinkValue}>
            <div
                className="h-screen w-screen bg-zinc-950 relative"
                onMouseMove={onMouseMove}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                onClick={onClick}
                onContextMenu={(e) => e.preventDefault()}
            >
                <ReactFlow
                    connectionLineComponent={RelinkLine}
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}

                    onEdgesChange={onEdgesChange}
                    onConnect={onRelinkConnect}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    isValidConnection={isValidRelinkConnection}

                    nodeTypes={nodeTypes}
                    fitView
                    colorMode="dark"
                    connectionMode={ConnectionMode.Loose} // Allow Target-to-Target connection start
                    proOptions={{ hideAttribution: true }}
                    // Explicitly disable native edge updates to prioritize our Relink system
                    edgesReconnectable={false}

                    snapToGrid={effectiveSnap}

                    onPaneContextMenu={(e) => {
                        e.preventDefault();
                        if (mode !== 'IDLE') {
                            cancelGrab();
                            return;
                        }
                        setContextMenu({
                            isOpen: true,
                            x: e.clientX,
                            y: e.clientY,
                            type: 'CANVAS'
                        });
                    }}

                    onNodeContextMenu={(e, node) => {
                        e.preventDefault();
                        if (mode !== 'IDLE') {
                            cancelGrab();
                            return;
                        }
                        // Auto-select if not selected
                        if (!node.selected) {
                            selectNode(node.id, true);
                        }
                        setContextMenu({
                            isOpen: true,
                            x: e.clientX,
                            y: e.clientY,
                            type: 'NODE',
                            nodeId: node.id
                        });
                    }}
                    onEdgeContextMenu={(e) => e.preventDefault()}


                    nodesDraggable={false} // Disable native drag to use our custom system
                    panOnDrag={[1]}
                    selectionOnDrag={true}
                    panOnScroll={panOnScroll}
                    zoomOnScroll={!panOnScroll}
                    zoomOnPinch={true}
                    zoomOnDoubleClick={false}
                    preventScrolling={true}
                    panOnScrollSpeed={1}
                    selectionMode={SelectionMode.Partial}
                    multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
                    connectionLineType={{
                        bezier: ConnectionLineType.Bezier,
                        straight: ConnectionLineType.Straight,
                        step: ConnectionLineType.Step,
                        smoothstep: ConnectionLineType.SmoothStep,
                    }[edgeType as 'bezier' | 'straight' | 'step' | 'smoothstep'] || ConnectionLineType.Bezier}
                    connectionLineStyle={{ stroke: '#71717a', strokeWidth: 2 }}
                    edgeTypes={edgeTypes}
                    defaultEdgeOptions={{
                        type: 'magnetic',
                        animated: false,
                        data: { pathType: edgeType, animate: edgeAnimation }
                    }}

                    // Snapping Logic

                    snapGrid={effectiveSnap ? [20, 20] : undefined} // Only provide grid when enabled
                    minZoom={0.1}
                    maxZoom={4}
                >
                    {showGrid && <Background color="#555" gap={20} size={1} />}
                    {showDebug && <DebugOverlay mode={mode} />}

                    <SettingsPanel
                        isSnapping={manualSnap}
                        setSnapping={setManualSnap}
                        showGrid={showGrid}
                        setShowGrid={setShowGrid}
                        showDebug={showDebug}
                        setShowDebug={setShowDebug}
                        showInspector={showInspector}
                        setShowInspector={setShowInspector}
                        edgeType={edgeType}
                        setEdgeType={setEdgeType}
                        layoutAlgorithm={layoutAlgorithm}
                        setLayoutAlgorithm={setLayoutAlgorithm}
                        layoutDirection={layoutDirection}
                        setLayoutDirection={setLayoutDirection}
                        edgeAnimation={edgeAnimation}
                        setEdgeAnimation={setEdgeAnimation}
                        panOnScroll={panOnScroll}
                        setPanOnScroll={setPanOnScroll}
                        onReset={clearMemory}
                    />


                    {/* Inspector Panel (N) */}
                    <InspectorPanel
                        isOpen={showInspector}
                        onClose={() => setShowInspector(false)}
                    />

                    {/* Context Menu */}
                    {contextMenu && (
                        <ContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            onClose={() => setContextMenu(null)}
                            items={contextMenu.type === 'CANVAS'
                                ? getCanvasMenuItems({
                                    openPalette: (x, y) => { setPalettePosition({ x, y }); setShowPalette(true); },
                                    resetView,
                                    pasteFromClipboard,
                                    selectAll: () => setNodes((nds: Node[]) => nds.map(n => ({ ...n, selected: true }))),
                                    rename: () => logAction('Rename via Menu (Todo)'),
                                    duplicateAndGrab: () => { },
                                    copyToClipboard,
                                    detachSelected,
                                    deleteSelected,
                                    logAction,
                                }, contextMenu.x, contextMenu.y)
                                : getNodeMenuItems({
                                    openPalette: () => { },
                                    resetView,
                                    pasteFromClipboard,
                                    selectAll: () => { },
                                    rename: () => logAction('Rename via Menu (Todo)'),
                                    duplicateAndGrab: () => {
                                        const newNodes = duplicateSelected();
                                        if (newNodes) startGrab({ x: contextMenu.x, y: contextMenu.y }, false, newNodes as Node[]);
                                    },
                                    copyToClipboard,
                                    detachSelected,
                                    deleteSelected,
                                    logAction,
                                })
                            }
                        />
                    )}
                </ReactFlow>


                {/* Knife Cut Path Overlay */}
                {mode === 'CUTTING' && cutPath.length > 0 && (
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-50 overflow-visible">
                        <polyline
                            points={cutPath.map(p => `${p.x},${p.y}`).join(' ')}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="3"
                            strokeDasharray="5,5"
                            strokeLinecap="round"
                        />
                    </svg>
                )}

                <StatusBar
                    mode={mode}
                    nodeCount={nodes.length}
                    selectionCount={nodes.filter(n => n.selected).length}
                    transformValue={transformValue}
                />

                {/* Command Palette (Shift + A) - Moved outside ReactFlow to avoid transform scaling issues */}
                {showPalette && (
                    <CommandPalette
                        isOpen={true}
                        position={palettePosition}
                        onClose={() => {
                            setShowPalette(false);
                            setPendingConnection(null);
                        }}
                        onSelect={spawnNode}
                        pendingConnection={pendingConnection}
                    />
                )}
            </div>
        </RelinkContext.Provider >
    );
}

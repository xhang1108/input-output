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
    useReactFlow,
} from '@xyflow/react';
import { RelinkLine, RelinkContext } from './edges/RelinkLine';
import '@xyflow/react/dist/style.css';

import { useRef, useCallback, useState, useEffect } from 'react';
import { FormulaRenderer } from '../utils/FormulaRenderer';
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
import { NodePicker } from './ui/NodePicker';
import { DebugOverlay } from './ui/DebugOverlay';
import { NPanel } from './ui/NPanel';
import { SettingsPanel } from './ui/SettingsPanel';
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

interface BodyProps {
    projectId: string; // slot id or 'new' for blank canvas
    onBackToProjects: () => void;
}

export function Body({ projectId, onBackToProjects }: BodyProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // UI Helpers
    const { fitView, getViewport, setViewport } = useReactFlow();
    const mousePosRef = useRef({ x: 0, y: 0 });
    const [isModifierActive, setIsModifierActive] = useState(false);
    const [isSnapping, setIsSnapping] = useState(false);

    const {
        showPalette, setShowPalette,
        palettePosition, setPalettePosition,
        showNPanel, setShowNPanel,
        manualSnap, setManualSnap,
        showGrid, setShowGrid,
        showDebug, setShowDebug,
        edgeType, setEdgeType,
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
    const { saveProject, isLoaded } = useProjectSave(projectId, setNodes);

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
        bundleSelected,
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
        isResolvingTransform,
        transformBuffer,
        transformValue
    } = useHand();

    // Intercept React Flow node changes to prevent native deselection during operation
    const onNodesChangeSafe = useCallback((changes: any[]) => {
        if (isResolvingTransform() || ['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) {
            const filtered = changes.filter(c => c.type !== 'select');
            if (filtered.length > 0) onNodesChange(filtered);
            return;
        }

        // Additive Selection Strategy: 
        // If any modifier (Shift/Ctrl/Cmd) is active, we treat selection as "Union".
        if (isModifierActive) {
            // Get a snapshot of currently selected IDs BEFORE applying the new changes
            const currentlySelected = new Set(nodes.filter(n => n.selected).map(n => n.id));

            const enforcedChanges = changes.map(c => {
                // If it's a selection change trying to UNSELECT a node that was ALREADY selected,
                // we FORCE it back to true instead of just filtering it out.
                // This manually bridges any state sync gaps in xyflow.
                if (c.type === 'select' && !c.selected && currentlySelected.has(c.id)) {
                    return { ...c, selected: true };
                }
                return c;
            });

            onNodesChange(enforcedChanges);
            return;
        }

        onNodesChange(changes);
    }, [mode, isResolvingTransform, onNodesChange, isModifierActive, nodes]);

    // --- Canvas Reset ---
    const clearMemory = useCallback(() => {
        if (confirm('Are you sure you want to wipe all memory? This cannot be undone.')) {
            Brain.getInstance().clearAll();
            setNodes([]);
            setEdges([]);
            logAction('Memory Wiped');
            setTimeout(() => fitView({ duration: 400 }), 100);
        }
    }, [setNodes, setEdges, logAction, fitView]);

    // Node Spawner (Command Palette + Auto-Link)
    const { pendingConnection, setPendingConnection, spawnNode } = useNodeSpawner({
        palettePosition,
        edgeType,
        setNodes,
        setEdges,
        logAction,
    });

    // Auto Insert (Drag over edge to split)
    const { highlightedEdgeId, detectAutoInsert, performAutoInsert } = useAutoInsert({
        mode,
        edgeType,
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
                isHighlighted: e.id === highlightedEdgeId
            }
        })));
    }, [edgeType, highlightedEdgeId, setEdges]);

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
        window.FormulaRenderer = FormulaRenderer;

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

    // Track Modifiers for Snapping and Additive Selection
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsSnapping(true);
            if (e.shiftKey || e.ctrlKey || e.metaKey) setIsModifierActive(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsSnapping(false);
            const anyActive = e.shiftKey || e.ctrlKey || e.metaKey;
            if (!anyActive) setIsModifierActive(false);
        };
        const handleBlur = () => {
            setIsSnapping(false);
            setIsModifierActive(false);
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        window.addEventListener('keyup', handleKeyUp, { capture: true });
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            window.removeEventListener('keyup', handleKeyUp, { capture: true });
            window.removeEventListener('blur', handleBlur);
        }
    }, []);

    // spawnNode managed by useNodeSpawner hook

    // --- Custom Handle Interactions State ---
    const { project } = useCanvasProjection();
    const {
        relinkState,
        onRelinkStart,
        onRelinkEnd,
        onRelinkConnect,
        isValidRelinkConnection,
        isRelinkActive,
        startEdgeDragDisconnect
    } = useRelink({
        setEdges,
        logAction,
        edgeType,
        onSmartLinkSearch: (params) => {
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
        edgeType, // Inject current edgeType into RelinkContext
        startEdgeDragDisconnect
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
    const autoConfirm = useCallback((fn: (e: any) => void) => (e: any) => {
        if (mode !== 'IDLE') confirmGrab();
        fn(e);
    }, [mode, confirmGrab]);

    useEar({
        shortcuts: {
            // Creation & Layout
            'shift+a': autoConfirm((e) => { e.preventDefault(); setPalettePosition(mousePosRef.current); setShowPalette(true); logAction('Show Palette (Shift+A)'); }),
            'alt+s': autoConfirm((e) => { e.preventDefault(); swapConnections(); logAction('Swap Inputs (Alt+S)'); }),
            'l': autoConfirm(() => { handleAutoLayout(); }),
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
            'g': autoConfirm((e) => { startGrab(mousePosRef.current, e.altKey, undefined, true); logAction('Start Grab (G)'); }),
            's': autoConfirm((e) => { startScale(mousePosRef.current); logAction('Start Scale (S)'); }),
            'r': autoConfirm((e) => { startRotate(mousePosRef.current); logAction('Start Rotate (R)'); }),
            'shift+d': autoConfirm((e) => {
                e.preventDefault();
                const duplicated = duplicateSelected();
                if (duplicated) {
                    startGrab(mousePosRef.current, false, duplicated.nodes, true);
                    logAction('Duplicate Selected (Shift+D)');
                }
            }),
            'f': (e) => {
                if (mode === 'IDLE') {
                    e.preventDefault();
                    bundleSelected();
                    logAction('Frame Selected (F)');
                }
            },

            // Node Operations
            'delete': () => {
                const active = document.activeElement?.tagName;
                if (active !== 'INPUT' && active !== 'TEXTAREA') {
                    if (mode !== 'IDLE') confirmGrab();
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
            },

            'a': autoConfirm((e) => {
                if (!e.shiftKey && !e.ctrlKey) {
                    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
                    logAction('Select All (A)');
                }
            }),
            'n': (e) => {
                e.preventDefault();
                setShowNPanel((prev: boolean) => !prev);
                logAction('Toggle N Panel (N)');
            },
            'm': autoConfirm(() => {
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
            }),

            // Axis Lock (While Grabbing/Scaling)
            'y': () => { if (mode === 'GRABBING' || mode === 'SCALING') { setAxisLock('Y'); logAction('Axis Lock Y'); } },

            // Clipboard
            'ctrl+c': autoConfirm(() => { copyToClipboard(); logAction('Copy (Ctrl+C)'); }),
            'cmd+c': autoConfirm(() => { copyToClipboard(); logAction('Copy (Cmd+C)'); }),
            'ctrl+v': autoConfirm(() => { pasteFromClipboard(project(mousePosRef.current)); logAction('Paste (Ctrl+V)'); }),
            'cmd+v': autoConfirm(() => { pasteFromClipboard(project(mousePosRef.current)); logAction('Paste (Cmd+V)'); }),

            // Save
            'ctrl+s': autoConfirm((e) => { e.preventDefault(); saveProject(); logAction('Save Project (Ctrl+S)'); }),
            'cmd+s': autoConfirm((e) => { e.preventDefault(); saveProject(); logAction('Save Project (Cmd+S)'); }),

            // Confirmation & Navigation
            'enter': () => { confirmGrab(); logAction('Confirm (Enter)'); },
            'escape': () => {
                cancelGrab();
                setShowPalette(false);
                setShowNPanel(false);
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
                        if (mode !== 'IDLE') confirmGrab();
                        resetSelected();
                        logAction('Reset Selected');
                    }
                }
            },
        },
        deps: [startGrab, startScale, startRotate, confirmGrab, cancelGrab, duplicateSelected, copyToClipboard, pasteFromClipboard, bundleSelected, deleteSelected, resetSelected, focusOn, nodes, setNodes, mode, setAxisLock, swapConnections, logAction, mousePosRef, setPalettePosition, setShowPalette, setShowNPanel, handleAutoLayout, handleTypeNum, transformBuffer, saveProject]
    });


    // Auto Insert logic managed by useAutoInsert hook

    const updateModifier = useCallback((e: React.MouseEvent) => {
        const active = e.shiftKey || e.ctrlKey || e.metaKey;
        if (active !== isModifierActive) setIsModifierActive(active);
    }, [isModifierActive]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
        updateModifier(e);
        handleMouseMove(e.nativeEvent);
        detectAutoInsert();
    }, [handleMouseMove, detectAutoInsert, updateModifier]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        updateModifier(e);
        handleMouseDown(e.nativeEvent);
    }, [handleMouseDown, updateModifier]);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
        updateModifier(e);
        handleMouseUp(e.nativeEvent);
        performAutoInsert();
    }, [handleMouseUp, performAutoInsert, updateModifier]);

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
                onClickCapture={(e) => {
                    if (isResolvingTransform() || ['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) {
                        e.stopPropagation();
                    }
                }}
                onContextMenu={(e) => e.preventDefault()}
            >
                {/* Loading Overlay — blocks flash while project data loads */}
                {!isLoaded && (
                    <div className="absolute inset-0 z-9999 bg-zinc-950 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-zinc-700 border-t-unit rounded-full animate-spin" />
                            <span className="text-xs text-zinc-500">Loading project...</span>
                        </div>
                    </div>
                )}
                <ReactFlow
                    connectionLineComponent={RelinkLine}
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChangeSafe}

                    onEdgesChange={onEdgesChange}
                    onConnect={onRelinkConnect}
                    onConnectStart={onConnectStart}
                    onConnectEnd={onConnectEnd}
                    isValidConnection={isValidRelinkConnection}

                    nodeTypes={nodeTypes}
                    colorMode="dark"
                    connectionMode={ConnectionMode.Loose} // Allow Target-to-Target connection start
                    proOptions={{ hideAttribution: true }}
                    // Explicitly disable native edge updates to prioritize our Relink system
                    edgesReconnectable={false}

                    nodeOrigin={[0.5, 0.5]}
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
                        data: { pathType: edgeType }
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
                        showNPanel={showNPanel}
                        setShowNPanel={setShowNPanel}
                        edgeType={edgeType}
                        setEdgeType={setEdgeType}
                        layoutAlgorithm={layoutAlgorithm}
                        setLayoutAlgorithm={setLayoutAlgorithm}
                        layoutDirection={layoutDirection}
                        setLayoutDirection={setLayoutDirection}
                        panOnScroll={panOnScroll}
                        setPanOnScroll={setPanOnScroll}
                        onReset={clearMemory}
                        onBackToProjects={onBackToProjects}
                    />


                    {/* N Panel (N) */}
                    <NPanel
                        isOpen={showNPanel}
                        onClose={() => setShowNPanel(false)}
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
                                        const duplicated = duplicateSelected();
                                        if (duplicated) startGrab({ x: contextMenu.x, y: contextMenu.y }, false, duplicated.nodes);
                                    },
                                    copyToClipboard,
                                    detachSelected,
                                    deleteSelected,
                                    logAction,
                                })
                            }
                        />
                    )}
                    <StatusBar
                        mode={mode}
                        transformValue={transformValue}
                    />
                </ReactFlow>


                {/* Knife Cut Path Overlay */}
                {mode === 'CUTTING' && cutPath.length > 0 && (
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-100 overflow-visible">
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

                {/* Node Picker (Shift + A) - Moved outside ReactFlow to avoid transform scaling issues */}
                {showPalette && (
                    <NodePicker
                        isOpen={true}
                        position={palettePosition}
                        onClose={() => {
                            setShowPalette(false);
                            setPendingConnection(null);
                        }}
                        onSelect={(type, label, data, isContinuous) => {
                            spawnNode(type, label, data, isContinuous, mousePosRef.current);
                        }}
                        pendingConnection={pendingConnection}
                    />
                )}

                {/* Additive Selection Active Indicator */}
                {isModifierActive && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-unit/20 border border-unit/30 rounded-full flex items-center gap-2 backdrop-blur-md z-1000 pointer-events-none animate-in fade-in zoom-in duration-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-unit animate-pulse" />
                        <span className="text-[10px] font-medium text-unit uppercase tracking-widest">Additive Selection Active</span>
                    </div>
                )}
            </div>
        </RelinkContext.Provider >
    );
}

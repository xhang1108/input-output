'use client';

import {
    ReactFlow,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    Node,
    addEdge,
    Connection,
    Edge,
    SelectionMode,
    useReactFlow,
    XYPosition,
    ConnectionMode,
    ConnectionLineType,
} from '@xyflow/react';
import { RelinkLine, RelinkContext, RelinkState, RelinkAnchor } from './edges/RelinkLine';
import '@xyflow/react/dist/style.css';

import { useRef, useCallback, useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { BaseNode } from './nodes/BaseNode';
import { FrameNode } from './nodes/FrameNode';
import { MagneticEdge } from './edges/MagneticEdge';
import { useEar } from '../nerves/useEar';
import { useHand } from '../nerves/useHand';
import { useEye } from '../nerves/useEye';
import { useCanvasProjection } from '../hooks/useCanvasProjection';
import { useRelink } from '../hooks/useRelink';
import { CommandPalette } from './ui/CommandPalette';
import { DebugOverlay } from './ui/DebugOverlay';
import { InspectorPanel } from './ui/InspectorPanel';
import { SettingsPanel } from './ui/SettingsPanel'; // Import SettingsPanel
import { getLayoutedElements } from '../nerves/layoutEngine';
import { useMemory, initialNodes } from '../engine/useMemory';

const nodeTypes = {
    baseNode: BaseNode,
    frame: FrameNode,
};

const edgeTypes = {
    magnetic: MagneticEdge,
};

export function Body() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [showPalette, setShowPalette] = useState(false);
    const [palettePosition, setPalettePosition] = useState({ x: 0, y: 0 });
    const [showInspector, setShowInspector] = useState(false);

    const mousePosRef = useRef({ x: 0, y: 0 });
    const [isSnapping, setIsSnapping] = useState(false);

    // Settings States
    const [manualSnap, setManualSnap] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [showDebug, setShowDebug] = useState(true);
    const [edgeType, setEdgeType] = useState('bezier');
    const [edgeAnimation, setEdgeAnimation] = useState(true);
    const [layoutAlgorithm, setLayoutAlgorithm] = useState<any>('layered');
    const [layoutDirection, setLayoutDirection] = useState<any>('RIGHT');

    const effectiveSnap = isSnapping || manualSnap;

    // Sync Edge Type for existing edges
    // (Removed duplicate useEffect that caused ReferenceError)


    // Get flow helpers
    const { project } = useCanvasProjection();
    const { focusOn, resetView, getZoom } = useEye();

    // Action Log State
    const [actionLog, setActionLog] = useState<string[]>([]);

    const logAction = useCallback((action: string) => {
        setActionLog(prev => [action, ...prev].slice(0, 20));
    }, []);

    // Sync Edge Type for existing edges (Moved here to use logAction)
    useEffect(() => {
        setEdges(eds => eds.map(e => ({
            ...e,
            data: {
                ...e.data,
                pathType: edgeType,
                animate: edgeAnimation
            }
        })));
        logAction(`Edge Type: ${edgeType} | Anim: ${edgeAnimation}`);
    }, [edgeType, edgeAnimation, setEdges, logAction]);

    // --- Persistence Logic ---
    const SETTINGS_KEY = 'calctopus-settings-v1';

    // Memory (Nodes & Edges Persistence)
    const { clearMemory } = useMemory(nodes, edges, setNodes, setEdges, logAction);

    // Load Settings on Mount
    useEffect(() => {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            try {
                const s = JSON.parse(stored);
                if (s.manualSnap !== undefined) setManualSnap(s.manualSnap);
                if (s.showGrid !== undefined) setShowGrid(s.showGrid);
                if (s.showDebug !== undefined) setShowDebug(s.showDebug);
                if (s.showInspector !== undefined) setShowInspector(s.showInspector);
                if (s.edgeType !== undefined) setEdgeType(s.edgeType);
                if (s.edgeAnimation !== undefined) setEdgeAnimation(s.edgeAnimation);
                if (s.layoutAlgorithm !== undefined) setLayoutAlgorithm(s.layoutAlgorithm);
                if (s.layoutDirection !== undefined) setLayoutDirection(s.layoutDirection);
                logAction('Settings Loaded');
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
    }, [logAction]);

    // Save Settings on Change
    useEffect(() => {
        const settings = { manualSnap, showGrid, showDebug, showInspector, edgeType, edgeAnimation, layoutAlgorithm, layoutDirection };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }, [manualSnap, showGrid, showDebug, showInspector, edgeType, edgeAnimation, layoutAlgorithm, layoutDirection]);

    // Auto-Load Flow Data on Mount

    const handleAutoLayout = useCallback(async () => {
        const selectedNodes = nodes.filter(n => n.selected);
        const isPartial = selectedNodes.length > 0;

        const nodesToLayout = isPartial ? selectedNodes : nodes;
        const edgesToLayout = isPartial
            ? edges.filter(e => selectedNodes.some(n => n.id === e.source) && selectedNodes.some(n => n.id === e.target))
            : edges;

        if (nodesToLayout.length === 0) return;

        // Calculate center for partial layout to preserve location
        let originalCenter = { x: 0, y: 0 };
        if (isPartial) {
            const xSum = nodesToLayout.reduce((acc, n) => acc + n.position.x, 0);
            const ySum = nodesToLayout.reduce((acc, n) => acc + n.position.y, 0);
            originalCenter = { x: xSum / nodesToLayout.length, y: ySum / nodesToLayout.length };
        }

        const layouted = await getLayoutedElements(nodesToLayout, edgesToLayout, {
            algorithm: layoutAlgorithm,
            direction: layoutDirection
        });

        // Restore center for partial layout
        let finalNodes = layouted.nodes;
        if (isPartial) {
            const xSum = layouted.nodes.reduce((acc, n) => acc + n.position.x, 0);
            const ySum = layouted.nodes.reduce((acc, n) => acc + n.position.y, 0);
            const currentCenter = { x: xSum / layouted.nodes.length, y: ySum / layouted.nodes.length };

            const offsetX = originalCenter.x - currentCenter.x;
            const offsetY = originalCenter.y - currentCenter.y;

            finalNodes = layouted.nodes.map(n => ({
                ...n,
                position: { x: n.position.x + offsetX, y: n.position.y + offsetY }
            }));
        }

        if (isPartial) {
            setNodes(nds => nds.map(n => {
                const found = finalNodes.find(ln => ln.id === n.id);
                return found ? found : n;
            }));
            logAction('Layout Selected (L)');
        } else {
            setNodes([...finalNodes]);
            setEdges([...layouted.edges]);
            setTimeout(() => focusOn([]), 50); // Global focus
            logAction('Layout Global (L)');
        }
    }, [nodes, edges, setNodes, setEdges, focusOn, logAction]);

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
        swapConnections, // Imported
        detachSelected, // Imported
        clearSelection, // Imported
        selectNode // Imported
    } = useHand();

    // Debug: Log Mode Changes (To catch flickering)
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

    // Helper: Spawn Node
    const spawnNode = useCallback((type: string, label: string, extraData?: Record<string, any>) => {
        logAction(`Spawn Node: ${type}`);
        // Project screen coordinates (palette position) to flow coordinates
        const flowPos = project({
            x: palettePosition.x,
            y: palettePosition.y
        });

        const newNode: Node = {
            id: nanoid(),
            type: type || 'baseNode',
            position: flowPos,
            data: {
                label,
                type: type === 'baseNode' ? undefined : type,
                ...extraData
            },
        };

        setNodes((nds) => nds.concat(newNode));
    }, [setNodes, palettePosition, project]);

    // --- Custom Handle Interactions State ---
    const {
        relinkState,
        onRelinkStart,
        onRelinkEnd,
        onRelinkConnect,
        isValidRelinkConnection
    } = useRelink({
        edges,
        setEdges,
        logAction,
        edgeType,
        edgeAnimation: edgeAnimation
    });

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



    // --- FEEL NERVES (Input Handling) ---

    useEar({
        shortcuts: {
            // Creation & Layout
            'shift+a': (e) => { e.preventDefault(); setPalettePosition(mousePosRef.current); setShowPalette(true); logAction('Show Palette (Shift+A)'); },
            'alt+s': (e) => { e.preventDefault(); swapConnections(); logAction('Swap Inputs (Alt+S)'); },
            'l': () => { handleAutoLayout(); },
            '.': (e) => {
                const selected = nodes.filter(n => n.selected);
                const actionName = focusOn(selected);
                logAction(`${actionName} (.)`);
            },

            // Transform Commands
            'g': (e) => { startGrab(mousePosRef.current, e.altKey); logAction('Start Grab (G)'); },
            's': (e) => { startScale(mousePosRef.current); logAction('Start Scale (S)'); },
            'r': (e) => { startRotate(mousePosRef.current); logAction('Start Rotate (R)'); },
            'shift+d': (e) => { e.preventDefault(); if (duplicateSelected()) { startGrab(mousePosRef.current); logAction('Duplicate Selected (Shift+D)'); } },
            'f': (e) => { e.preventDefault(); groupSelected(); logAction('Group Selected (F)'); },

            // Node Operations
            'delete': () => {
                const active = document.activeElement?.tagName;
                if (active !== 'INPUT' && active !== 'TEXTAREA') {
                    deleteSelected();
                    logAction('Delete Selected');
                }
            },
            'x': () => {
                const active = document.activeElement?.tagName;
                if (active === 'INPUT' || active === 'TEXTAREA') return;

                if (mode === 'GRABBING') {
                    setAxisLock('X');
                    logAction('Axis Lock X');
                } else {
                    deleteSelected();
                    logAction('Delete Selected');
                }
            },
            'backspace': () => {
                const active = document.activeElement?.tagName;
                if (active !== 'INPUT' && active !== 'TEXTAREA') {
                    resetSelected();
                    logAction('Reset Selected');
                }
            },
            'a': (e) => {
                if (!e.shiftKey && !e.ctrlKey) {
                    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
                    logAction('Select All (A)');
                }
            },
            'n': (e) => { e.preventDefault(); setShowInspector(prev => !prev); logAction('Toggle Inspector (N)'); },

            // Axis Lock (While Grabbing)
            'y': () => { if (mode === 'GRABBING') { setAxisLock('Y'); logAction('Axis Lock Y'); } },

            // Clipboard
            'ctrl+c': () => { copyToClipboard(); logAction('Copy (Ctrl+C)'); },
            'cmd+c': () => { copyToClipboard(); logAction('Copy (Cmd+C)'); },
            'ctrl+v': () => { pasteFromClipboard(); logAction('Paste (Ctrl+V)'); },
            'cmd+v': () => { pasteFromClipboard(); logAction('Paste (Cmd+V)'); },

            // Confirmation & Navigation
            'enter': () => { confirmGrab(); logAction('Confirm (Enter)'); },
            'escape': () => {
                cancelGrab();
                setShowPalette(false);
                setShowInspector(false);
                setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                logAction('Cancel/Deselect (Esc)');
            }
        },
        deps: [startGrab, startScale, startRotate, confirmGrab, cancelGrab, duplicateSelected, copyToClipboard, pasteFromClipboard, groupSelected, deleteSelected, resetSelected, focusOn, nodes, setNodes, mode, setAxisLock, swapConnections, logAction, mousePosRef, setPalettePosition, setShowPalette, setShowInspector, handleAutoLayout]
    });



    const onMouseMove = useCallback((e: React.MouseEvent) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
        handleMouseMove(e.nativeEvent);
    }, [handleMouseMove]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        // Right Click Cancel Logic
        if (e.button === 2 && mode !== 'IDLE') {
            e.preventDefault();
            e.stopPropagation();
            cancelGrab();
            return;
        }
        handleMouseDown(e.nativeEvent);
    }, [handleMouseDown, mode, cancelGrab]);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
        handleMouseUp(e.nativeEvent);
    }, [handleMouseUp]);

    const onClick = useCallback((e: React.MouseEvent) => {
        if (showPalette) setShowPalette(false);
        if (['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) confirmGrab();
    }, [mode, confirmGrab, showPalette]);

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
                    onConnectStart={onRelinkStart}
                    onConnectEnd={onRelinkEnd}
                    isValidConnection={isValidRelinkConnection}
                    nodeTypes={nodeTypes}
                    fitView
                    colorMode="dark"
                    connectionMode={ConnectionMode.Loose} // Allow Target-to-Target connection start
                    proOptions={{ hideAttribution: true }}
                    // Explicitly disable native edge updates to prioritize our Relink system
                    edgesReconnectable={false}

                    snapToGrid={effectiveSnap}

                    onPaneContextMenu={(e) => e.preventDefault()}

                    onNodeContextMenu={(e) => e.preventDefault()}
                    onEdgeContextMenu={(e) => e.preventDefault()}



                    onNodeDragStart={(e, node) => {
                        // 1. Detach Logic (Alt + Drag)
                        if (e.altKey) {
                            detachSelected();
                            logAction('Detach Selected');
                        }

                        // 2. Selection Polish (Drag unselected -> Select Exclusive)
                        // If dragging a node that isn't selected, it should become the ONLY selection
                        // unless Shift/Ctrl is held (standard multi-select behavior)
                        if (!node.selected && !e.shiftKey && !e.ctrlKey) {
                            selectNode(node.id, true);
                            logAction(`Select Node ${node.id}`);
                        }
                    }}

                    panOnDrag={[1]}
                    selectionOnDrag={true}
                    panOnScroll={false}
                    zoomOnScroll={true}
                    zoomOnPinch={true}
                    zoomOnDoubleClick={false}
                    preventScrolling={true}
                    selectionMode={SelectionMode.Partial}
                    connectionLineType={{
                        bezier: ConnectionLineType.Bezier,
                        straight: ConnectionLineType.Straight,
                        step: ConnectionLineType.Step,
                        smoothstep: ConnectionLineType.SmoothStep,
                    }[edgeType] || ConnectionLineType.Bezier}
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
                    {showDebug && <DebugOverlay mode={mode} actionLog={actionLog} />}

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
                        onReset={clearMemory}
                    />

                    {/* Command Palette (Shift + A) */}
                    {showPalette && (
                        <CommandPalette
                            isOpen={true}
                            position={palettePosition}
                            onClose={() => setShowPalette(false)}
                            onSelect={spawnNode}
                        />
                    )}

                    {/* Inspector Panel (N) */}
                    <InspectorPanel
                        isOpen={showInspector}
                        onClose={() => setShowInspector(false)}
                    />
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

                {/* Mode Indicator */}
                {mode === 'GRABBING' && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-800 text-white px-4 py-2 rounded-full shadow-lg border border-zinc-700 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-2">
                        <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                        MOVE
                    </div>
                )}
                {mode === 'SCALING' && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-800 text-white px-4 py-2 rounded-full shadow-lg border border-zinc-700 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        SCALE
                    </div>
                )}
                {mode === 'ROTATING' && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-800 text-white px-4 py-2 rounded-full shadow-lg border border-zinc-700 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                        ROTATE
                    </div>
                )}
                {mode === 'CUTTING' && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-800 text-white px-4 py-2 rounded-full shadow-lg border border-zinc-700 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-bottom-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        CUTTING
                    </div>
                )}
            </div>
        </RelinkContext.Provider>
    );
}

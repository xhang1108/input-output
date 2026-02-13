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
import { generateNodeId } from '../utils/idGenerator';
import { BaseNode } from './nodes/BaseNode';
import { FrameNode } from './nodes/FrameNode';
import { InputNode } from './nodes/InputNode';
import { MathNode } from './nodes/MathNode';
import { ResultNode } from './nodes/ResultNode';
import { SliderNode } from './nodes/SliderNode';
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
import { useBrainSync } from '../hooks/useBrainSync';
import { ContextMenu, ContextMenuItem } from './ui/ContextMenu';
import { StatusBar } from './ui/StatusBar';
import { Brain } from '../engine/Brain';
import { useBrainUpdates } from '../hooks/useBrainUpdates';
import { useAppStore } from '../store/useStore';

const nodeTypes = {
    baseNode: BaseNode,
    frame: FrameNode,
    'MA-01': MathNode,
    'IO-01': InputNode,
    'IO-02': SliderNode,
    'IO-11': ResultNode,
};

const edgeTypes = {
    magnetic: MagneticEdge,
};

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

    const effectiveSnap = isSnapping || manualSnap;

    // Sync Edge Type for existing edges
    // (Removed duplicate useEffect that caused ReferenceError)


    // Get flow helpers
    const { project } = useCanvasProjection();
    const { focusOn, resetView, getZoom } = useEye();

    // Action Log is handled by useAppStore


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
    // Settings are handled by Zustand persist middleware.

    // Memory (Nodes & Edges Persistence)
    const { clearMemory } = useMemory(nodes, edges, setNodes, setEdges, logAction);

    // Brain Sync (Shadow Mirror)
    useBrainSync(nodes, edges);
    // Brain Updates (Reverse Sync: Brain -> UI)
    useBrainUpdates(setNodes, setEdges);


    // Auto-Load Flow Data on Mount

    // Connect Brain Log to UI Log
    useEffect(() => {
        const brain = Brain.getInstance();
        const cleanup = brain.on('log', (msg: string) => logAction(msg));
        return cleanup;
    }, [logAction]);

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
        selectNode, // Imported
        handleTypeNum, // New Import
        transformBuffer, // New Import
        transformValue // New Import
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
            id: generateNodeId(type),
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
            'shift+d': (e) => { e.preventDefault(); if (duplicateSelected()) { startGrab(mousePosRef.current); logAction('Duplicate Selected (Shift+D)'); } },
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

            // Axis Lock (While Grabbing/Scaling)
            'y': () => { if (mode === 'GRABBING' || mode === 'SCALING') { setAxisLock('Y'); logAction('Axis Lock Y'); } },

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
        deps: [startGrab, startScale, startRotate, confirmGrab, cancelGrab, duplicateSelected, copyToClipboard, pasteFromClipboard, groupSelected, deleteSelected, resetSelected, focusOn, nodes, setNodes, mode, setAxisLock, swapConnections, logAction, mousePosRef, setPalettePosition, setShowPalette, setShowInspector, handleAutoLayout, handleTypeNum, transformBuffer]
    });



    const onMouseMove = useCallback((e: React.MouseEvent) => {
        mousePosRef.current = { x: e.clientX, y: e.clientY };
        handleMouseMove(e.nativeEvent);
    }, [handleMouseMove]);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        handleMouseDown(e.nativeEvent);
    }, [handleMouseDown]);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
        handleMouseUp(e.nativeEvent);
    }, [handleMouseUp]);

    const onClick = useCallback((e: React.MouseEvent) => {
        if (showPalette) setShowPalette(false);
        if (contextMenu) setContextMenu(null);
        if (['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) confirmGrab();
    }, [mode, confirmGrab, showPalette, contextMenu]);

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
                    // isValidConnection removed to allow full Code Judgment (Brain)

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

                    {/* Context Menu */}
                    {contextMenu && (
                        <ContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            onClose={() => setContextMenu(null)}
                            items={contextMenu.type === 'CANVAS' ? [
                                { label: 'Command Palette', shortcut: 'Shift+A', action: () => { setPalettePosition({ x: contextMenu.x, y: contextMenu.y }); setShowPalette(true); } },
                                { label: 'Reset View', action: () => resetView() },
                                { label: 'Paste', shortcut: 'Ctrl+V', action: () => pasteFromClipboard() },
                                { label: 'Select All', shortcut: 'A', action: () => { setNodes((nds: Node[]) => nds.map(n => ({ ...n, selected: true }))); } },
                            ] : [
                                { label: 'Rename', shortcut: 'Enter', action: () => { /* Trigger Rename? Needs Focus Logic */ logAction('Rename via Menu (Todo)'); } },
                                { label: 'Duplicate', shortcut: 'Shift+D', action: () => { if (duplicateSelected()) startGrab({ x: contextMenu.x, y: contextMenu.y }); } },
                                { label: 'Copy', shortcut: 'Ctrl+C', action: () => copyToClipboard() },
                                { label: 'Colors', action: () => { logAction('Colors via Menu (Todo)'); } },
                                { label: 'Detach', shortcut: 'Alt+Drag', action: () => detachSelected() },
                                { label: 'Delete', shortcut: 'Del', danger: true, action: () => deleteSelected() },
                            ]}
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
            </div>
        </RelinkContext.Provider >
    );
}

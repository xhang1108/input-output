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
    ConnectionLineType,
    useReactFlow,
    XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useRef, useCallback, useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { BaseNode } from './nodes/BaseNode';
import { FrameNode } from './nodes/FrameNode';
import { MagneticEdge } from './edges/MagneticEdge';
import { useEar } from '../nerves/useEar';
import { useHand } from '../nerves/useHand';
import { CommandPalette } from './ui/CommandPalette';
import { DebugOverlay } from './ui/DebugOverlay';
import { InspectorPanel } from './ui/InspectorPanel';

const nodeTypes = {
    baseNode: BaseNode,
    frame: FrameNode,
};

const edgeTypes = {
    magnetic: MagneticEdge,
};

// Initial nodes for testing interactions
const initialNodes: Node[] = [
    { id: '1', type: 'baseNode', position: { x: 100, y: 100 }, data: { label: 'Cube' } },
    { id: '2', type: 'baseNode', position: { x: 400, y: 100 }, data: { label: 'Sphere' } },
];

export function Body() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [showPalette, setShowPalette] = useState(false);
    const [palettePosition, setPalettePosition] = useState({ x: 0, y: 0 });
    const [showInspector, setShowInspector] = useState(false);

    const mousePosRef = useRef({ x: 0, y: 0 });
    const [isSnapping, setIsSnapping] = useState(false);

    // Get flow helpers
    const { screenToFlowPosition, fitView, getZoom } = useReactFlow();

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
        cutPath
    } = useHand();

    // Track Modifiers for Snapping (Standard Drag)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsSnapping(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control' || e.key === 'Meta') setIsSnapping(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Helper: Spawn Node
    const spawnNode = useCallback((type: string, label: string) => {
        // Project screen coordinates (palette position) to flow coordinates
        const flowPos = screenToFlowPosition({
            x: palettePosition.x,
            y: palettePosition.y
        });

        const newNode: Node = {
            id: nanoid(),
            type: type || 'baseNode',
            position: flowPos,
            data: { label, type: type === 'baseNode' ? undefined : type },
        };

        setNodes((nds) => nds.concat(newNode));
    }, [setNodes, palettePosition, screenToFlowPosition]);

    useEar({
        onKeyDown: useCallback((e: KeyboardEvent) => {
            const key = e.key.toLowerCase();

            // Interaction: Creation Gate (Shift + A)
            if (key === 'a' && e.shiftKey) {
                e.preventDefault();
                setPalettePosition(mousePosRef.current);
                setShowPalette(true);
                return;
            }

            // Interaction: Grab / Scale / Rotate
            if (key === 'g') startGrab(mousePosRef.current);
            if (key === 's') startScale(mousePosRef.current);
            if (key === 'r') startRotate(mousePosRef.current);
            // Interaction: Duplicate
            if (key === 'd' && e.shiftKey) {
                e.preventDefault();
                if (duplicateSelected()) {
                    startGrab(mousePosRef.current);
                }
            }
            // Interaction: Group (Frames)
            if (key === 'f') {
                e.preventDefault();
                groupSelected();
            }
            // Interaction: Inspector
            if (key === 'n') {
                e.preventDefault();
                setShowInspector(prev => !prev);
            }

            // Interaction: Delete (X or Del)
            // Note: X handles Delete only if NOT Grabbing (Axis Lock priority)
            if (key === 'delete' || (key === 'x' && mode !== 'GRABBING')) {
                const active = document.activeElement?.tagName;
                if (active !== 'INPUT' && active !== 'TEXTAREA') {
                    deleteSelected();
                }
            }

            // Interaction: Reset Data (Backspace)
            if (key === 'backspace') {
                const active = document.activeElement?.tagName;
                if (active !== 'INPUT' && active !== 'TEXTAREA') {
                    resetSelected();
                }
            }

            // Interaction: Select All (A)
            if (key === 'a' && !e.shiftKey && !e.ctrlKey) {
                setNodes(nds => nds.map(n => ({ ...n, selected: true })));
            }

            // Interaction: Focus (.)
            if (key === '.') {
                const selected = nodes.filter(n => n.selected).map(n => ({ id: n.id }));
                if (selected.length > 0) {
                    fitView({ nodes: selected, duration: 400, padding: 0.2 });
                } else {
                    fitView({ duration: 400, padding: 0.2 }); // Reset view
                }
            }

            // Interaction: Axis Lock (X/Y)
            if (mode === 'GRABBING') {
                if (key === 'x') setAxisLock('X');
                if (key === 'y') setAxisLock('Y');
            }

            // Interaction: Clipboard
            if (key === 'c' && (e.ctrlKey || e.metaKey)) copyToClipboard();
            if (key === 'v' && (e.ctrlKey || e.metaKey)) pasteFromClipboard();

            if (key === 'enter') confirmGrab();
            if (key === 'escape') {
                cancelGrab();
                setShowPalette(false);
                setShowInspector(false);
                setNodes(nds => nds.map(n => ({ ...n, selected: false }))); // Deselect All
            }
        }, [startGrab, confirmGrab, cancelGrab, duplicateSelected, copyToClipboard, pasteFromClipboard, groupSelected, deleteSelected, resetSelected, fitView, nodes, setNodes, mode, setAxisLock])
    });

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

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
        <div
            className="h-screen w-screen bg-zinc-950 relative"
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onClick={onClick}
            onContextMenu={(e) => e.preventDefault()}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                colorMode="dark"
                minZoom={0.1}
                maxZoom={4}
                proOptions={{ hideAttribution: true }}

                onPaneContextMenu={(e) => e.preventDefault()}
                onNodeContextMenu={(e) => e.preventDefault()}
                onEdgeContextMenu={(e) => e.preventDefault()}

                panOnDrag={[1]}
                selectionOnDrag={true}
                panOnScroll={false}
                zoomOnScroll={true}
                selectionMode={SelectionMode.Partial}
                connectionLineType={ConnectionLineType.Bezier}
                connectionLineStyle={{ stroke: '#71717a', strokeWidth: 2 }}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'magnetic', animated: false }}

                // Snapping Logic
                snapToGrid={isSnapping}
                snapGrid={[20, 20]}
            >
                <Background color="#222" variant={BackgroundVariant.Dots} />
            </ReactFlow>

            {/* UI Overlays */}
            <DebugOverlay mode={mode} />
            <InspectorPanel isOpen={showInspector} onClose={() => setShowInspector(false)} />
            <CommandPalette
                isOpen={showPalette}
                position={palettePosition}
                onClose={() => setShowPalette(false)}
                onSelect={spawnNode}
            />

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
    );
}

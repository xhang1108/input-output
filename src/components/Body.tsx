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
import { useSession } from 'next-auth/react';
import { Plus } from 'lucide-react';
import '@xyflow/react/dist/style.css';

import { useRef, useCallback, useState, useEffect } from 'react';
import { FormulaRenderer } from '../utils/FormulaRenderer';
import { nodeTypes, edgeTypes } from '../config/nodeTypeMap';
import { getCanvasMenuItems, getNodeMenuItems } from '../config/contextMenuItems';
import { useEar } from '../nerves/useEar';
import { useHand } from '../nerves/useHand';
import { useKnife } from './useKnife';
import { COMMAND_REGISTRY, getEarShortcuts, Platform } from '../config/shortcuts';

type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';
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
import { SaveManager } from '../services/SaveManager';
import { useBrain } from '../context/BrainContext';
import { useBrainUpdates } from '../hooks/useBrainUpdates';
import { useAutoLayout } from '../hooks/useAutoLayout';
import { useExampleListener } from '../hooks/useExampleListener';
import { useAppStore } from '../store/useStore';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getDocInfo, hasDocForToken } from '../config/docRegistry';
import { FloatingProjectControls } from './ui/FloatingProjectControls';

// nodeTypes and edgeTypes imported from config/nodeTypeMap.ts

interface BodyProps {
    projectId: string;
    onBackToProjects?: () => void;
    onProjectLoaded?: (meta: { title: string; visibility: 'private' | 'public'; userId: string }) => void;
    onForbidden?: () => void;
    visibility?: 'private' | 'public';
}

export function Body({
    projectId,
    onBackToProjects,
    onProjectLoaded,
    onForbidden,
    visibility
}: BodyProps) {
    const brain = useBrain();
    const { data: session } = useSession();
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Enable cross-page example loading (The Living Lab)
    useExampleListener();

    // UI Helpers
    const { fitView, getViewport, setViewport } = useReactFlow();
    const router = useRouter();
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

    const {
        saveProject,
        autoSave,
        isLoaded,
        projectMeta,
        permissionError,
        forkProject,
        isOwner,
        isReadOnly
    } = useProjectSave(projectId, setNodes, visibility);

    // Propagate metadata to parent
    useEffect(() => {
        if (projectMeta && onProjectLoaded) {
            onProjectLoaded(projectMeta);
        }
    }, [projectMeta, onProjectLoaded]);

    // Handle Permission Error
    useEffect(() => {
        if (permissionError && onForbidden) {
            onForbidden();
        }
    }, [permissionError, onForbidden]);


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
        // Block destructive/structural changes for non-owners, but allow 'add' for ephemeral experiments
        const isDestructive = changes.some(c => c.type === 'remove' || c.type === 'position' || c.type === 'dimensions');
        if (isReadOnly && isDestructive) return;

        if (isResolvingTransform() || ['GRABBING', 'SCALING', 'ROTATING'].includes(mode)) {
            const filtered = changes.filter(c => c.type !== 'select');
            if (filtered.length > 0) onNodesChange(filtered);
            return;
        }

        // Additive Selection Strategy: 
        if (isModifierActive) {
            const currentlySelected = new Set(nodes.filter(n => n.selected).map(n => n.id));

            const enforcedChanges = changes.map(c => {
                if (c.type === 'select' && !c.selected && currentlySelected.has(c.id)) {
                    return { ...c, selected: true };
                }
                return c;
            });

            onNodesChange(enforcedChanges);
            autoSave();
            return;
        }

        onNodesChange(changes);
        if (!isReadOnly) autoSave();
    }, [mode, isResolvingTransform, onNodesChange, isModifierActive, nodes, autoSave, isReadOnly]);

    const onEdgesChangeSafe = useCallback((changes: any[]) => {
        const isDestructive = changes.some(c => c.type === 'remove');
        if (isReadOnly && isDestructive) return;
        onEdgesChange(changes);
        if (!isReadOnly) autoSave();
    }, [onEdgesChange, autoSave, isReadOnly]);

    // --- Canvas Reset ---
    const clearMemory = useCallback(() => {
        if (isReadOnly) return;
        if (confirm('Are you sure you want to wipe all memory? This cannot be undone.')) {
            brain.clearAll();
            setNodes([]);
            setEdges([]);
            logAction('Memory Wiped');
            setTimeout(() => fitView({ duration: 400 }), 100);
        }
    }, [setNodes, setEdges, logAction, fitView, brain, isReadOnly]);

    const handleRename = useCallback(() => {
        if (isReadOnly) return;
        const currentId = projectId === 'new' ? null : (projectId.startsWith('cloud:') ? projectId : projectId);
        const meta = currentId ? SaveManager.getMeta(currentId) : null;
        const currentName = meta?.name || 'Untitled Project';

        const newName = prompt('Enter new project name:', currentName);
        if (newName && newName !== currentName) {
            if (currentId) {
                SaveManager.rename(currentId, newName);
                logAction(`Project renamed to: ${newName}`);
                // Trigger an immediate save to sync the new name to cloud if applicable
                saveProject(true);
            } else {
                // If it's a 'new' project, we just save it for the first time with the name
                saveProject(false);
            }
        }
    }, [projectId, saveProject, logAction, isReadOnly]);

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
    }, [logAction, brain]);


    // Debug: Log Mode Changes
    useEffect(() => {
        logAction(`Mode: ${mode}`);
    }, [mode, logAction]);

    // Track Modifiers for Snapping and Additive Selection
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsSnapping(true);
            // ONLY Shift triggers additive selection. 
            // Control is for Snapping, Meta/Cmd is for system shortcuts.
            if (e.shiftKey) setIsModifierActive(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsSnapping(false);
            const anyActive = e.shiftKey;
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
                handleType: params.handleType,
                handleColor: params.handleColor
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


    const relinkValue = {
        ...relinkState,
        edgeType, // Inject current edgeType into RelinkContext
        startEdgeDragDisconnect
    };

    // Guard: Prevent onConnectStart from interfering with native Reconnect
    const paletteGuardRef = useRef(false);

    const closePalette = useCallback(() => {
        setShowPalette(false);
        setPendingConnection(null);
    }, [setShowPalette, setPendingConnection]);

    // --- FEEL NERVES (Input Handling) ---
    const autoConfirm = useCallback((fn: (e: any) => void) => (e: any) => {
        if (mode !== 'IDLE') confirmGrab();
        fn(e);
    }, [mode, confirmGrab]);

    const platform: Platform = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'mac' : 'win';

    useEar({
        shortcuts: getEarShortcuts(platform, {
            // Creation & Layout
            'palette:open': autoConfirm((e: any) => {
                e.preventDefault();
                setPendingConnection(null);
                setPalettePosition(mousePosRef.current);
                setShowPalette(true);
                logAction('Show Palette (Shift+A)');
            }),
            'nodes:swap-inputs': autoConfirm((e) => {
                if (isReadOnly) return;
                e.preventDefault();
                swapConnections();
                logAction('Swap Inputs (Alt+S)');
            }),
            'layout:auto': autoConfirm(() => {
                if (isReadOnly) return;
                handleAutoLayout();
            }),
            'canvas:focus-selected': (e) => {
                if (mode === 'GRABBING' || mode === 'SCALING' || mode === 'ROTATING') {
                    handleTypeNum('.');
                } else {
                    const selected = nodes.filter(n => n.selected);
                    const actionName = focusOn(selected);
                    logAction(`${actionName} (.)`);
                }
            },

            // Transform Commands
            'transform:grab': autoConfirm((e) => {
                if (isReadOnly) return;
                startGrab(mousePosRef.current, e.altKey, undefined, true);
                logAction('Start Grab (G)');
            }),
            'transform:scale': autoConfirm((e) => {
                if (isReadOnly) return;
                startScale(mousePosRef.current);
                logAction('Start Scale (S)');
            }),
            'transform:rotate': autoConfirm((e) => {
                if (isReadOnly) return;
                startRotate(mousePosRef.current);
                logAction('Start Rotate (R)');
            }),
            'nodes:duplicate': autoConfirm((e) => {
                if (isReadOnly) return;
                e.preventDefault();
                const duplicated = duplicateSelected();
                if (duplicated) {
                    startGrab(mousePosRef.current, false, duplicated.nodes, true);
                    logAction('Duplicate Selected (Shift+D)');
                }
            }),
            'nodes:bundle': (e: any) => {
                if (mode === 'IDLE') {
                    if (isReadOnly) return;
                    e.preventDefault();
                    bundleSelected();
                    logAction('Frame Selected (F)');
                }
            },

            // Node Operations
            'nodes:delete': () => {
                if (isReadOnly) return;
                const active = document.activeElement?.tagName;
                if (active !== 'INPUT' && active !== 'TEXTAREA') {
                    if (mode !== 'IDLE') confirmGrab();
                    deleteSelected();
                    logAction('Delete Selected');
                }
            },
            'nodes:delete-alt': () => {
                const active = document.activeElement?.tagName;
                if (active === 'INPUT' || active === 'TEXTAREA') return;

                if (mode === 'GRABBING' || mode === 'SCALING') {
                    setAxisLock('X');
                    logAction('Axis Lock X');
                } else if (mode === 'IDLE') {
                    if (isReadOnly) return;
                    deleteSelected();
                    logAction('Delete Selected');
                }
            },

            'selection:all': autoConfirm((e) => {
                if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                    setNodes(nds => nds.map(n => ({ ...n, selected: true })));
                    logAction('Select All (A)');
                }
            }),

            'system:toggle-n-panel': (e: any) => {
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
                    brain.applyTransaction({
                        type: 'UPDATE_NODE_DATA',
                        payload: { id: node.id, data: { muted: !isMuted } }
                    });
                });
                if (selected.length > 0) logAction(`Toggle Mute [${selected.length}] (M)`);
            }),

            // Axis Lock (While Grabbing/Scaling)
            'y': () => { if (mode === 'GRABBING' || mode === 'SCALING') { setAxisLock('Y'); logAction('Axis Lock Y'); } },

            // Clipboard
            'clipboard:copy': autoConfirm(() => { copyToClipboard(); logAction('Copy'); }),
            'clipboard:paste': autoConfirm(() => {
                if (isReadOnly) return;
                pasteFromClipboard(project(mousePosRef.current));
                logAction('Paste');
            }),

            // Save
            'system:save': autoConfirm((e) => { e.preventDefault(); saveProject(); logAction('Save Project'); }),

            // Confirmation & Navigation
            'system:confirm': () => { confirmGrab(); logAction('Confirm (Enter)'); },
            'system:cancel': () => {
                cancelGrab();
                closePalette();
                setShowNPanel(false);
                setNodes(nds => nds.map(n => ({ ...n, selected: false })));
                logAction('Cancel/Deselect (Esc)');
            },

            // Numeric Inputs for Transform (keep as literal keys for now as they are many)
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
                        if (isReadOnly) return;
                        resetSelected();
                        logAction('Reset Selected');
                    }
                }
            },
        }),
        deps: [startGrab, startScale, startRotate, confirmGrab, cancelGrab, duplicateSelected, copyToClipboard, pasteFromClipboard, bundleSelected, deleteSelected, resetSelected, focusOn, nodes, setNodes, mode, setAxisLock, swapConnections, logAction, mousePosRef, setPalettePosition, setShowPalette, setShowNPanel, handleAutoLayout, handleTypeNum, transformBuffer, saveProject, isReadOnly]
    });


    const updateModifier = useCallback((e: React.MouseEvent) => {
        const active = e.shiftKey;
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
                className="h-full w-full bg-zinc-800 relative"
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
                    <div className="absolute inset-0 z-9999 bg-zinc-800 flex items-center justify-center">
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
                    onEdgesChange={onEdgesChangeSafe}
                    onConnect={isReadOnly ? undefined : onRelinkConnect}
                    onConnectStart={isReadOnly ? undefined : onConnectStart}
                    onConnectEnd={isReadOnly ? undefined : onConnectEnd}
                    isValidConnection={isValidRelinkConnection}

                    nodeTypes={nodeTypes}
                    colorMode="dark"
                    connectionMode={ConnectionMode.Loose} // Allow Target-to-Target connection start
                    proOptions={{ hideAttribution: true }}
                    // Explicitly disable native edge updates to prioritize our Relink system
                    edgesReconnectable={false}

                    nodeOrigin={[0.5, 0.5]}
                    snapToGrid={effectiveSnap}
                    selectionKeyCode={null}
                    multiSelectionKeyCode={['Shift']}

                    onPaneContextMenu={(e) => {
                        e.preventDefault();
                        if (mode !== 'IDLE') {
                            cancelGrab();
                            return;
                        }
                        if (isReadOnly) return;
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
                        if (isReadOnly) return;
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
                    nodesConnectable={!isReadOnly}
                    elementsSelectable={true}
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
                    connectionLineStyle={{ stroke: 'var(--color-zinc-500)', strokeWidth: 2 }}
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
                    <Background color="#555" gap={20} size={1} />
                    {showDebug && <DebugOverlay mode={mode} />}



                    <SettingsPanel
                        isSnapping={manualSnap}
                        setSnapping={setManualSnap}
                        showDebug={showDebug}
                        setShowDebug={setShowDebug}
                        edgeType={edgeType}
                        setEdgeType={setEdgeType}
                        layoutAlgorithm={layoutAlgorithm}
                        setLayoutAlgorithm={setLayoutAlgorithm}
                        panOnScroll={panOnScroll}
                        setPanOnScroll={setPanOnScroll}
                        onReset={clearMemory}
                        onBackToProjects={onBackToProjects || (() => { })}
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
                                    openPalette: (x, y) => { setPendingConnection(null); setPalettePosition({ x, y }); setShowPalette(true); },
                                    resetView,
                                    pasteFromClipboard,
                                    selectAll: () => setNodes((nds: Node[]) => nds.map(n => ({ ...n, selected: true }))),
                                    rename: handleRename,
                                    duplicateAndGrab: () => { },
                                    copyToClipboard,
                                    detachSelected,
                                    deleteSelected,
                                    viewSpecs: () => { }, // Canvas has no specs
                                    logAction,
                                }, contextMenu.x, contextMenu.y)
                                : (() => {
                                    const node = nodes.find(n => n.id === contextMenu.nodeId);
                                    const nodeType = node?.type || '';
                                    const opToken = (node?.data?.opToken as string) || '';
                                    const docInfo = getDocInfo(nodeType, opToken);
                                    const hasSpecs = !!docInfo;

                                    return getNodeMenuItems({
                                        openPalette: () => { },
                                        resetView,
                                        pasteFromClipboard,
                                        selectAll: () => { },
                                        rename: handleRename,
                                        viewSpecs: () => {
                                            if (docInfo) {
                                                router.push(`/wiki#${docInfo.anchor}`);
                                                logAction(`View Specs: ${docInfo.anchor}`);
                                            }
                                        },
                                        duplicateAndGrab: () => {
                                            const duplicated = duplicateSelected();
                                            if (duplicated) startGrab({ x: contextMenu.x, y: contextMenu.y }, false, duplicated.nodes);
                                        },
                                        copyToClipboard,
                                        detachSelected,
                                        deleteSelected,
                                        logAction,
                                    }, hasSpecs);
                                })()
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
                    <div className="absolute top-0 left-0 w-full h-full z-100 flex items-center justify-center pointer-events-none">
                        <NodePicker
                            isOpen={showPalette}
                            position={palettePosition || { x: 0, y: 0 }}
                            onSelect={(type, opToken, data, isContinuous) => {
                                spawnNode(type, opToken, data, isContinuous);
                                if (!isContinuous) {
                                    closePalette();
                                }
                            }}
                            onClose={closePalette}
                            pendingConnection={pendingConnection}
                        />
                    </div>
                )}

                {/* Floating Project Controls */}
                <FloatingProjectControls
                    isOwner={isOwner}
                    projectId={projectId}
                    onBack={onBackToProjects || (() => { })}
                    onFork={forkProject}
                    visibility={visibility}
                />

                {/* Additive Selection Active Indicator */}
                {isModifierActive && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-unit/20 border border-unit/30 rounded-full flex items-center gap-2 backdrop-blur-md z-1000 pointer-events-none animate-in fade-in zoom-in duration-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-unit animate-pulse" />
                        <span className="text-[10px] font-medium text-unit uppercase tracking-widest">Additive Selection Active</span>
                    </div>
                )}
            </div>
        </RelinkContext.Provider>
    );
}

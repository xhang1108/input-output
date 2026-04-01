'use client';

import {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    NodeChange,
    EdgeChange,
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

import { useState, useCallback, useEffect, useRef } from 'react';
import { FormulaRenderer } from '../utils/FormulaRenderer';
import { nodeTypes, edgeTypes } from '../config/nodeTypeMap';
import { getCanvasMenuItems, getNodeMenuItems } from '../config/contextMenuItems';
import { useEar } from '../hooks/nerves/useEar';
import { useHand } from '../hooks/nerves/useHand';
import { useHistoryExecutor } from '../hooks/useHistoryExecutor';
import { getEarShortcuts, Platform } from '../config/shortcuts';

type InteractionMode = 'IDLE' | 'GRABBING' | 'CUTTING' | 'SCALING' | 'ROTATING';
import { useEye } from '../hooks/nerves/useEye';
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
import { useAppStore } from '../store/useStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { useRouter } from 'next/navigation';
import { getDocInfo } from '../config/docRegistry';
import { FloatingProjectControls } from './ui/FloatingProjectControls';

export interface FlowCanvasProps {
    isReadOnly: boolean;
    isLoaded: boolean;
    saveProject: (silent?: boolean, options?: any) => Promise<void>;
    autoSave: { trigger: () => void; cancel: () => void };
    triggerDirty: () => void;
    resetCloudTimer: () => void;
    setPalettePosition: (pos: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;
    setShowPalette: (show: boolean | ((prev: boolean) => boolean)) => void;
    setShowNPanel: (show: boolean | ((prev: boolean) => boolean)) => void;
    setPendingConnection: (c: any) => void;
    paletteGuardRef: React.MutableRefObject<boolean>;
    closePalette: () => void;
    showPalette: boolean;
    showNPanel: boolean;
}

export function FlowCanvas({
    isReadOnly,
    isLoaded,
    saveProject,
    autoSave,
    triggerDirty,
    resetCloudTimer,
    setPalettePosition,
    setShowPalette,
    setShowNPanel,
    setPendingConnection,
    paletteGuardRef,
    closePalette,
    showPalette,
    showNPanel
}: FlowCanvasProps) {
    const brain = useBrain();
    const { data: session } = useSession();

    const { fitView, getViewport, setViewport, setNodes, setEdges, getNodes } = useReactFlow();
    const router = useRouter();
    const mousePosRef = useRef({ x: 0, y: 0 });
    const [isModifierActive, setIsModifierActive] = useState(false);
    const [isSnapping, setIsSnapping] = useState(false);

    const manualSnap = useAppStore(s => s.manualSnap);
    const setManualSnap = useAppStore(s => s.setManualSnap);
    const showDebugStats = useAppStore(s => s.showDebugStats);
    const setShowDebugStats = useAppStore(s => s.setShowDebugStats);
    const edgeType = useAppStore(s => s.edgeType);
    const setEdgeType = useAppStore(s => s.setEdgeType);
    const layoutAlgorithm = useAppStore(s => s.layoutAlgorithm);
    const setLayoutAlgorithm = useAppStore(s => s.setLayoutAlgorithm);
    const panOnScroll = useAppStore(s => s.panOnScroll);
    const setPanOnScroll = useAppStore(s => s.setPanOnScroll);
    const logAction = useAppStore(s => s.logAction);

    const [contextMenu, setContextMenu] = useState<{
        isOpen: boolean;
        x: number;
        y: number;
        type: 'CANVAS' | 'NODE';
        nodeId?: string;
    } | null>(null);

    const effectiveSnap = isSnapping || manualSnap;

    const isRestoring = useHistoryStore(s => s.isRestoring);
    const { undo, redo } = useHistoryExecutor();

    const { focusOn, resetView } = useEye();

    const { handleAutoLayout } = useAutoLayout(
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
        alignSelectedNodes,
        selectNode,
        handleTypeNum,
        isResolvingTransform,
        lastCancelTimestamp,
        transformBuffer
    } = useHand();

    const onNodesChangeSafe = useCallback((changes: NodeChange[]) => {
        const isDestructive = changes.some(c => c.type === 'remove' || c.type === 'position' || c.type === 'dimensions');
        if (isReadOnly && isDestructive) return;

        // In Uncontrolled mode, React Flow applies internal interactions (selection/drag) automatically.
        // We catch selection events to sync with the additive selection behavior and update the Brain.
        // We drop 'remove' because useSelection perfectly handles it.
        // We drop 'position' because useHand perfectly handles it.

        const txs: import('../engine/types').Transaction[] = [];
        const currentlySelected = new Set(getNodes().filter(n => n.selected).map(n => n.id));

        changes.forEach(c => {
            if (c.type === 'select') {
                let finalSelection = c.selected;
                // Enforce modifier additive selection
                if (isModifierActive && !c.selected && currentlySelected.has(c.id)) {
                    finalSelection = true;
                }
                
                // If it's a valid change, instruct the Brain
                txs.push({
                    type: 'UPDATE_NODE_DATA',
                    payload: { id: c.id, data: { selected: finalSelection } }
                });

                // Since we are uncontrolled, React Flow's internal change already ran asynchronously or uses default behavior.
                // We MUST override the internal store natively if our modifier dictates a block:
                if (finalSelection !== c.selected) {
                    setNodes(nds => nds.map(n => n.id === c.id ? { ...n, selected: finalSelection } : n));
                }
            }
        });

        // Use silent mode for selection updates to avoid triggering BATCH re-evaluations
        if (txs.length > 0) {
            brain.applyTransaction({ type: 'BATCH', payload: txs }, true);
        }
    }, [isModifierActive, isReadOnly, getNodes, setNodes, brain]);

    const onEdgesChangeSafe = useCallback((changes: EdgeChange[]) => {
        const isDestructive = (changes as any[]).some(c => c.type === 'remove');
        if (isReadOnly && isDestructive) return;
        
        // Uncontrolled mode auto removes edges when user presses Delete. 
        // We MUST tell the brain to sever the logical link!
        const txs: import('../engine/types').Transaction[] = [];
        changes.forEach(c => {
            if (c.type === 'remove') {
                txs.push({ type: 'DISCONNECT', payload: c.id });
                logAction('Disconnect Edge(s)');
            }
        });

        if (txs.length > 0) {
            brain.applyTransaction({ type: 'BATCH', payload: txs });
        }
    }, [isReadOnly, brain, logAction]);

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
        const currentName = 'Untitled Project'; // Defer to save system in parent

        const newName = prompt('Enter new project name:', currentName);
        if (newName && newName !== currentName) {
            // Placeholder: parent handles renaming.
        }
    }, [isReadOnly]);

    const { detectAutoInsert, performAutoInsert, highlightedEdgeId } = useAutoInsert({
        mode,
        edgeType,
        brain,
        setEdges,
        logAction,
    });

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

    // useBrainSync interceptor logic will be integrated into onNodesChangeSafe
    // useBrainSync(nodes, edges); // REMOVED
    useBrainUpdates(setNodes, setEdges);

    useEffect(() => {
        window.Brain = Brain;
        window.brain = brain;
        window.NodeRegistry = NodeRegistry;
        window.FormulaRenderer = FormulaRenderer;

        window.debugBrain = () => {
            console.log('Brain State:', (brain as any).state);
            console.log('Available Nodes:', Array.from((brain as any).state.nodes.keys()));
            console.log('Registered Evaluators:', (NodeRegistry as any).evaluators.size);
            console.log('Registered Symbolizers:', (NodeRegistry as any).symbolizers.size);
        };
        window.getNodes = () => Array.from((brain as any).state.nodes.values());

        const cleanupLog = brain.on('log', (msg: unknown) => logAction(String(msg)));
        return () => { cleanupLog(); };
    }, [logAction, brain]);

    useEffect(() => {
        logAction(`Mode: ${mode}`);
    }, [mode, logAction]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Control') setIsSnapping(true);
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


    const { project } = useCanvasProjection();
    const {
        relinkState,
        onRelinkStart,
        onRelinkEnd,
        onRelinkConnect,
        isValidRelinkConnection,
        startEdgeDragDisconnect
    } = useRelink({
        setEdges,
        logAction,
        edgeType,
        onSmartLinkSearch: (params) => {
            setPalettePosition(params.position);
            setShowPalette(true);
            paletteGuardRef.current = true;

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
        edgeType,
        startEdgeDragDisconnect
    };

    const handleCancel = useCallback(() => {
        if (mode !== 'IDLE') {
            cancelGrab(false);
            logAction('Cancel Transform (Esc)');
            return;
        }

        const selectedCount = getNodes().filter(n => n.selected).length;
        if (selectedCount > 0) {
            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
            logAction(`Deselect [${selectedCount}] (Esc)`);
            return;
        }

        if (showPalette || showNPanel) {
            closePalette();
            setShowNPanel(false);
            logAction('Close Panels (Esc)');
            return;
        }
    }, [mode, cancelGrab, setNodes, showPalette, showNPanel, closePalette, setShowNPanel, logAction, getNodes]);

    const autoConfirm = useCallback((fn: (e: any) => void) => (e: any) => {
        if (mode !== 'IDLE') confirmGrab();
        fn(e);
    }, [mode, confirmGrab]);

    const platform: Platform = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'mac' : 'win';

    useEar({
        shortcuts: getEarShortcuts(platform, {
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
            'layout:auto': (e: any) => {
                if (isReadOnly) return;
                if (mode !== 'IDLE' || isRestoring) {
                    logAction('Layout manual override blocked (Busy)');
                    return;
                }
                handleAutoLayout();
            },
            'canvas:focus-selected': (e) => {
                if (mode === 'GRABBING' || mode === 'SCALING' || mode === 'ROTATING') {
                    handleTypeNum('.');
                } else {
                    const selected = getNodes().filter(n => n.selected);
                    const actionName = focusOn(selected);
                    logAction(`${actionName} (.)`);
                }
            },
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

                const selected = getNodes().filter(n => n.selected);
                selected.forEach(node => {
                    const isMuted = !!node.data?.muted;
                    brain.applyTransaction({
                        type: 'UPDATE_NODE_DATA',
                        payload: { id: node.id, data: { muted: !isMuted } }
                    });
                });
                if (selected.length > 0) logAction(`Toggle Mute [${selected.length}] (M)`);
            }),
            'y': () => { if (mode === 'GRABBING' || mode === 'SCALING') { setAxisLock('Y'); logAction('Axis Lock Y'); } },
            'clipboard:copy': autoConfirm(() => { copyToClipboard(); logAction('Copy'); }),
            'clipboard:paste': autoConfirm(() => {
                if (isReadOnly) return;
                pasteFromClipboard(project(mousePosRef.current));
                logAction('Paste');
            }),
            'system:save': autoConfirm(async (e) => { 
                e.preventDefault(); 
                await saveProject(); 
                resetCloudTimer();
                logAction('Save Project'); 
            }),
            'system:undo': (e) => {
                e.preventDefault();
                autoSave.cancel();
                if (mode !== 'IDLE') {
                    cancelGrab(true);
                    logAction('Cancel + Undo');
                } else {
                    logAction('Undo');
                }
                undo();
            },
            'system:redo': (e) => { 
                e.preventDefault(); 
                autoSave.cancel(); 
                redo(); 
                logAction('Redo'); 
            },
            'system:redo-alt': (e) => { 
                e.preventDefault(); 
                autoSave.cancel(); 
                redo(); 
                logAction('Redo'); 
            },
            'system:confirm': () => { confirmGrab(); logAction('Confirm (Enter)'); },
            'system:cancel': () => { handleCancel(); },
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
        deps: [undo, redo, startGrab, startScale, startRotate, confirmGrab, cancelGrab, duplicateSelected, copyToClipboard, pasteFromClipboard, deleteSelected, resetSelected, focusOn, setNodes, mode, setAxisLock, swapConnections, logAction, mousePosRef, setPalettePosition, setShowPalette, setShowNPanel, handleAutoLayout, handleTypeNum, transformBuffer, saveProject, isReadOnly, triggerDirty, autoSave, resetCloudTimer, getNodes]
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
                    defaultNodes={[]}
                    defaultEdges={[]}
                    onNodesChange={onNodesChangeSafe}
                    onEdgesChange={onEdgesChangeSafe}
                    onConnect={isReadOnly ? undefined : onRelinkConnect}
                    onConnectStart={isReadOnly ? undefined : onConnectStart}
                    onConnectEnd={isReadOnly ? undefined : onConnectEnd}
                    isValidConnection={isValidRelinkConnection}

                    nodeTypes={nodeTypes}
                    colorMode="dark"
                    connectionMode={ConnectionMode.Loose}
                    proOptions={{ hideAttribution: true }}
                    edgesReconnectable={false}

                    selectionKeyCode={null}
                    multiSelectionKeyCode={['Shift']}

                    onPaneContextMenu={(e) => {
                        e.preventDefault();
                        if (Date.now() - lastCancelTimestamp.current < 100) return;

                        if (mode !== 'IDLE') {
                            cancelGrab(true);
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
                        if (Date.now() - lastCancelTimestamp.current < 100) return;

                        if (mode !== 'IDLE') {
                            cancelGrab(true);
                            return;
                        }
                        if (isReadOnly) return;
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

                    nodesDraggable={false}
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

                    nodeOrigin={[0, 0]}
                    snapGrid={[20, 20]}
                    minZoom={0.1}
                    maxZoom={4}
                >
                    <Background color="#555" gap={20} size={1} />
                    {showDebugStats && <DebugOverlay mode={mode} />}

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
                                    viewSpecs: () => { },
                                    alignSelectedNodes,
                                    logAction,
                                }, contextMenu.x, contextMenu.y)
                                : (() => {
                                    const node = getNodes().find(n => n.id === contextMenu.nodeId);
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
                                        alignSelectedNodes,
                                        logAction,
                                    }, hasSpecs);
                                })()
                            }
                        />
                    )}
                </ReactFlow>

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

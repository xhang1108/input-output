'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { FlowCanvas } from './FlowCanvas';
import { SettingsPanel } from './ui/SettingsPanel';
import { NPanel } from './ui/NPanel';
import { StatusBar } from './ui/StatusBar';
import { FloatingProjectControls } from './ui/FloatingProjectControls';
import { NodePicker } from './ui/NodePicker';
import { useProjectSave } from '../hooks/useProjectSave';
import { useNodeSpawner } from '../hooks/useNodeSpawner';
import { useAppStore } from '../store/useStore';
import { useEye } from '../hooks/nerves/useEye';
import { useEar } from '../hooks/nerves/useEar';
import { getEarShortcuts, Platform } from '../config/shortcuts';
import { useBrain } from '../context/BrainContext';

interface BodyProps {
    projectId: string;
    onBackToProjects?: () => void;
    onProjectLoaded?: (meta: { title: string; visibility: 'private' | 'public'; userId: string }) => void;
    onForbidden?: () => void;
    visibility: 'private' | 'public' | undefined;
    onVisibilityChange?: (visibility: 'private' | 'public') => void;
}

export function Body({
    projectId,
    onBackToProjects,
    onProjectLoaded,
    onForbidden,
    visibility,
    onVisibilityChange
}: BodyProps) {
    const brain = useBrain();
    const { fitView } = useReactFlow();
    const paletteGuardRef = useRef(false);

    const showPalette = useAppStore(s => s.showPalette);
    const setShowPalette = useAppStore(s => s.setShowPalette);
    const palettePosition = useAppStore(s => s.palettePosition);
    const setPalettePosition = useAppStore(s => s.setPalettePosition);
    const showNPanel = useAppStore(s => s.showNPanel);
    const setShowNPanel = useAppStore(s => s.setShowNPanel);
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

    const {
        saveProject,
        updateVisibility,
        autoSave,
        triggerDirty,
        resetCloudTimer,
        isLoaded,
        projectMeta,
        permissionError,
        forkProject,
        isOwner,
        isReadOnly,
        isCloudDirty,
        navigateWithSave
    } = useProjectSave(projectId, visibility);

    useEffect(() => {
        if (projectMeta && onProjectLoaded) onProjectLoaded(projectMeta);
    }, [projectMeta, onProjectLoaded]);

    useEffect(() => {
        if (permissionError && onForbidden) onForbidden();
    }, [permissionError, onForbidden]);

    // Reactive handles for nodes and edges directly from useReactFlow to ensure
    // we don't pass empty arrows which would break the immediate UI feedback.
    const { setNodes, setEdges } = useReactFlow();

    // Lifted generic UI logics
    const { pendingConnection, setPendingConnection, spawnNode } = useNodeSpawner({
        palettePosition,
        edgeType,
        setNodes,
        setEdges,
        logAction,
    });

    const closePalette = useCallback(() => {
        setShowPalette(false);
        setPendingConnection(null);
    }, [setShowPalette, setPendingConnection]);

    const clearMemory = useCallback(() => {
        if (isReadOnly) return;
        if (confirm('Are you sure you want to wipe all memory? This cannot be undone.')) {
            brain.clearAll();
            // Since we defer to FlowCanvas for ReactFlow state, we can just trigger a re-sync or let the brain handle it.
            // ReactFlow nodes/edges will update via useBrainUpdates.
            logAction('Memory Wiped');
            setTimeout(() => fitView({ duration: 400 }), 100);
        }
    }, [logAction, fitView, brain, isReadOnly]);

    return (
        <div className="h-full w-full bg-zinc-800 relative">
            {!isLoaded && (
                <div className="absolute inset-0 z-[9999] bg-zinc-800 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-zinc-700 border-t-unit rounded-full animate-spin" />
                        <span className="text-xs text-zinc-500">Loading project...</span>
                    </div>
                </div>
            )}

            <FlowCanvas
                isReadOnly={isReadOnly}
                isLoaded={isLoaded}
                saveProject={saveProject}
                autoSave={autoSave}
                triggerDirty={triggerDirty}
                resetCloudTimer={resetCloudTimer}
                setPalettePosition={setPalettePosition}
                setShowPalette={setShowPalette}
                setShowNPanel={setShowNPanel}
                setPendingConnection={setPendingConnection}
                paletteGuardRef={paletteGuardRef}
                closePalette={closePalette}
                showPalette={showPalette}
                showNPanel={showNPanel}
            />

            <SettingsPanel
                isSnapping={manualSnap}
                setSnapping={setManualSnap}
                showDebugStats={showDebugStats}
                setShowDebugStats={setShowDebugStats}
                edgeType={edgeType}
                setEdgeType={setEdgeType}
                layoutAlgorithm={layoutAlgorithm}
                setLayoutAlgorithm={setLayoutAlgorithm}
                panOnScroll={panOnScroll}
                setPanOnScroll={setPanOnScroll}
                onReset={clearMemory}
                onBackToProjects={onBackToProjects || (() => { })}
            />

            <NPanel
                isOpen={showNPanel}
                onClose={() => setShowNPanel(false)}
            />

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

            <FloatingProjectControls
                isOwner={isOwner}
                projectId={projectId}
                onBack={() => navigateWithSave('/dashboard')}
                onFork={forkProject}
                visibility={visibility}
                onVisibilityChange={updateVisibility}
            />

            <StatusBar />
        </div>
    );
}

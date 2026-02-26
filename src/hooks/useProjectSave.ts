import { useEffect, useCallback, useRef, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';
import { Brain } from '../engine/Brain';
import { Serializer } from '../engine/Serializer';
import { SaveManager } from '../services/SaveManager';
import { useAppStore } from '../store/useStore';

function restoreSettings(settings: Record<string, unknown>) {
    const store = useAppStore.getState();
    if (typeof settings.manualSnap === 'boolean') store.setManualSnap(settings.manualSnap);
    if (typeof settings.showGrid === 'boolean') store.setShowGrid(settings.showGrid);
    if (typeof settings.showDebug === 'boolean') store.setShowDebug(settings.showDebug);
    if (typeof settings.edgeType === 'string') store.setEdgeType(settings.edgeType);
    if (typeof settings.layoutAlgorithm === 'string') store.setLayoutAlgorithm(settings.layoutAlgorithm as any);
    if (typeof settings.layoutDirection === 'string') store.setLayoutDirection(settings.layoutDirection as any);
}

export function useProjectSave(projectId: string) {
    const { getViewport, setViewport, fitView } = useReactFlow();
    const [isLoaded, setIsLoaded] = useState(false);
    const currentSlotIdRef = useRef<string | null>(
        projectId === 'new' ? null : projectId
    );

    // Helper: wait N frames then reveal
    const revealAfterPaint = useCallback(() => {
        // Wait 2 frames for React Flow to render nodes at final positions
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setIsLoaded(true);
            });
        });
    }, []);

    const saveProject = useCallback(() => {
        const brain = Brain.getInstance();
        const viewport = getViewport();
        const settings = useAppStore.getState();

        const slotName = currentSlotIdRef.current
            ? (SaveManager.getMeta(currentSlotIdRef.current)?.name ?? 'Untitled')
            : 'Untitled';

        try {
            const id = SaveManager.save(
                slotName,
                brain,
                viewport,
                settings as unknown as Record<string, unknown>,
                currentSlotIdRef.current ?? undefined
            );
            currentSlotIdRef.current = id;
            toast.success('Project saved!');
        } catch (e) {
            toast.error(String(e));
        }
    }, [getViewport]);

    const loadProject = useCallback((encoded: string) => {
        const data = Serializer.deserialize(encoded);
        if (!data) {
            toast.error('Failed to load project from data');
            return;
        }

        if (data.viewport) setViewport(data.viewport, { duration: 0 });
        if (data.settings) restoreSettings(data.settings);

        if (data.graph) {
            const brain = Brain.getInstance();
            brain.injectNodes(data.graph, true).then(() => {
                toast.success('Project loaded successfully');
            });
        }
    }, [setViewport]);

    // Initial Load — delayed to ensure useBrainUpdates listener is registered first
    useEffect(() => {
        setIsLoaded(false);
        const rafId = requestAnimationFrame(() => {
            if (projectId === 'new') {
                const brain = Brain.getInstance();
                brain.injectNodes({ nodes: [], edges: [] }, true).then(() => {
                    setIsLoaded(true);
                });
                return;
            }

            const data = SaveManager.load(projectId);
            if (data) {
                if (data.settings) restoreSettings(data.settings);

                if (data.graph) {
                    const brain = Brain.getInstance();
                    brain.injectNodes(data.graph, true, true).then(() => {
                        // Set viewport AFTER nodes exist, instant (no animation)
                        if (data.viewport) {
                            setViewport(data.viewport, { duration: 0 });
                        } else {
                            fitView({ duration: 0 });
                        }
                        // Let React Flow paint at the correct position, then reveal
                        revealAfterPaint();
                    });
                } else {
                    setIsLoaded(true);
                }
            } else {
                toast.error('Failed to load project');
                setIsLoaded(true);
            }
        });

        return () => cancelAnimationFrame(rafId);
    }, [projectId, setViewport, fitView, revealAfterPaint]);

    return { saveProject, loadProject, currentSlotId: currentSlotIdRef, isLoaded };
}

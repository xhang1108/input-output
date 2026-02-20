import { useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';
import { Brain } from '../engine/Brain';
import { Serializer } from '../engine/Serializer';
import { useAppStore } from '../store/useStore';

export function useProjectSave() {
    const { getViewport, setViewport } = useReactFlow();

    const saveProject = useCallback(() => {
        const brain = Brain.getInstance();
        const viewport = getViewport();
        const settings = useAppStore.getState();

        const encoded = Serializer.serialize(brain, viewport, settings as unknown as Record<string, unknown>);

        // Save to LocalStorage
        localStorage.setItem('calctopus-autocsave', encoded);

        // Also update URL query parameter without reloading page
        const url = new URL(window.location.href);
        url.searchParams.set('data', encoded);
        window.history.replaceState({}, '', url);

        toast.success('Project saved!');
    }, [getViewport]);

    const loadProject = useCallback((encoded: string) => {
        const data = Serializer.deserialize(encoded);
        if (!data) {
            toast.error('Failed to load project from data');
            return;
        }

        // 1. Restore Viewport
        if (data.viewport) {
            setViewport(data.viewport);
        }

        // 2. Restore Settings
        if (data.settings) {
            const store = useAppStore.getState();
            if (typeof data.settings.manualSnap === 'boolean') store.setManualSnap(data.settings.manualSnap);
            if (typeof data.settings.showGrid === 'boolean') store.setShowGrid(data.settings.showGrid);
            if (typeof data.settings.showDebug === 'boolean') store.setShowDebug(data.settings.showDebug);
            if (typeof data.settings.edgeType === 'string') store.setEdgeType(data.settings.edgeType);
            if (typeof data.settings.edgeAnimation === 'boolean') store.setEdgeAnimation(data.settings.edgeAnimation);
            if (typeof data.settings.layoutAlgorithm === 'string') store.setLayoutAlgorithm(data.settings.layoutAlgorithm as any);
            if (typeof data.settings.layoutDirection === 'string') store.setLayoutDirection(data.settings.layoutDirection as any);
        }

        // 3. Restore Graph
        if (data.graph) {
            const brain = Brain.getInstance();
            brain.injectNodes(data.graph, true /* clear existing */).then(() => {
                toast.success('Project loaded successfully');
            });
        }
    }, [setViewport]);

    // Initial Load
    useEffect(() => {
        // Try URL first
        const urlParams = new URLSearchParams(window.location.search);
        const dataFromUrl = urlParams.get('data');
        if (dataFromUrl) {
            loadProject(dataFromUrl);
            return;
        }

        // Fallback to LocalStorage
        const dataFromStorage = localStorage.getItem('calctopus-autocsave');
        if (dataFromStorage) {
            loadProject(dataFromStorage);
        }
    }, [loadProject]);

    return { saveProject, loadProject };
}

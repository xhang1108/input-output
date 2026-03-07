import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ResizeDimensions } from './useFlexibleResize';
import { NODE_DEFINITIONS } from '../../../definitions/nodeDefinitions';
import { Brain } from '../../../engine/Brain';

interface UseNodeDimensionsProps {
    id: string;
    type: string;
    data: any;
    /** Optional function to transform raw dimensions (e.g. for snapping) */
    onProject?: (screenW: number, screenH: number) => { w: number; h: number };
    /** Optional callback on dimension change (e.g. for structural updates like matrix rows) */
    onResize?: (dims: { width: number; height: number }) => void;
}

/**
 * 📐 Unified hook for managing node dimensions during and after resize.
 * Handles local visual state for 120fps updates and syncs with React Flow.
 */
export const useNodeDimensions = ({ id, type, data, onProject, onResize: onResizeCallback }: UseNodeDimensionsProps) => {
    const { updateNodeData } = useReactFlow();
    const [localSize, setLocalSize] = useState<{ w: number; h: number } | null>(null);

    const definition = NODE_DEFINITIONS.find(d => d.id === type);

    // Resolved width/height: local visual state > persisted data > definition default > safe fallback
    const width = localSize?.w ?? (data.width as number) ?? definition?.minWidth ?? 100;
    const height = localSize?.h ?? (data.height as number) ?? definition?.minHeight ?? 40;

    const onResize = useCallback(({ screenW, screenH }: ResizeDimensions) => {
        const projected = onProject ? onProject(screenW, screenH) : null;
        if (projected) {
            setLocalSize(projected);
        } else {
            setLocalSize({ w: screenW, h: screenH });
        }

        // Immediate sync to React Flow for relative positioning of children/handles
        // We don't sync to Brain here to avoid transaction spam
        const nextW = projected?.w ?? screenW;
        const nextH = projected?.h ?? screenH;

        updateNodeData(id, {
            width: nextW,
            height: nextH
        });

        // Trigger optional callback for component-specific logic (e.g. matrix structural change)
        onResizeCallback?.({ width: nextW, height: nextH });
    }, [id, updateNodeData, onProject, onResizeCallback]);

    const onResizeEnd = useCallback(({ screenW, screenH }: ResizeDimensions) => {
        // Clear local override; let React Flow State / Brain take over
        setLocalSize(null);

        // Project the final coordinate bounds
        const projected = onProject ? onProject(screenW, screenH) : null;
        const finalW = projected?.w ?? screenW;
        const finalH = projected?.h ?? screenH;

        // Sync final snapped bounds back to the Engine History
        Brain.getInstance().resizeNode(id, finalW, finalH);
    }, [id, onProject]);

    return {
        width,
        height,
        localSize,
        onResize,
        onResizeEnd
    };
};

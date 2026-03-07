import { useState, useCallback, useRef } from 'react';
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
 * Handles local visual state for 120fps updates and syncs with Brain atomically at resize end.
 *
 * Undo semantics: ONE Ctrl+Z restores both the outer frame AND any data changes
 * (e.g. matrix rows/cols) that occurred during the drag.
 */
export const useNodeDimensions = ({ id, type, data, onProject, onResize: onResizeCallback }: UseNodeDimensionsProps) => {
    const { updateNodeData, getNode } = useReactFlow();
    const [localSize, setLocalSize] = useState<{ w: number; h: number } | null>(null);
    // Captures the size + full data at the START of a drag for correct Undo payload
    const startSizeRef = useRef<{ w: number; h: number } | null>(null);

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
        // Brain.isResizing blocks this from being recorded to history
        const nextW = projected?.w ?? screenW;
        const nextH = projected?.h ?? screenH;

        updateNodeData(id, {
            width: nextW,
            height: nextH
        });

        // Trigger optional callback for component-specific logic (e.g. matrix structural change)
        onResizeCallback?.({ width: nextW, height: nextH });
    }, [id, updateNodeData, onProject, onResizeCallback]);

    // Called by ResizeHandle at the very beginning of a drag
    const onResizeStart = useCallback(() => {
        const curW = (data.width as number) ?? definition?.minWidth ?? 100;
        const curH = (data.height as number) ?? definition?.minHeight ?? 40;
        startSizeRef.current = { w: curW, h: curH };

        // Block useBrainSync UPDATE_NODE_DATA during resize to prevent history spam
        Brain.getInstance().isResizing = true;
    }, [data.width, data.height, definition]);

    const onResizeEnd = useCallback(({ screenW, screenH }: ResizeDimensions) => {
        // Clear local override — let React Flow State / Brain take over
        setLocalSize(null);

        // Project the final coordinate bounds
        const projected = onProject ? onProject(screenW, screenH) : null;
        const finalW = projected?.w ?? screenW;
        const finalH = projected?.h ?? screenH;

        const oldSize = startSizeRef.current
            ? { width: startSizeRef.current.w, height: startSizeRef.current.h }
            : undefined;
        startSizeRef.current = null;

        // --- Atomic Undo Commit ---
        // Get the final React Flow node data (all updateNodeData calls during drag are reflected here)
        const finalNodeData = getNode(id)?.data;
        const brain = Brain.getInstance();

        if (finalNodeData) {
            // Exclude value (managed by Brain) and raw dimension fields (handled by RESIZE_NODE below)
            const { value: _v, width: _dw, height: _dh, ...structuralData } = finalNodeData as Record<string, unknown>;

            // Apply as a single BATCH so 1 Undo restores BOTH data AND frame
            brain.applyTransaction({
                type: 'BATCH',
                payload: [
                    { type: 'UPDATE_NODE_DATA', payload: { id, data: structuralData } },
                    { type: 'RESIZE_NODE', payload: { id, width: finalW, height: finalH, oldSize } }
                ]
            });
        } else {
            // Fallback: just resize (no data changes)
            brain.resizeNode(id, finalW, finalH, oldSize);
        }

        // Reset isResizing AFTER the BATCH's cascade settles (graphChanged → useBrainUpdates → setNodes → useBrainSync)
        // The 50ms window ensures all post-BATCH React re-renders are still blocked from writing to history
        setTimeout(() => { brain.isResizing = false; }, 50);
    }, [id, onProject, getNode]);

    return {
        width,
        height,
        localSize,
        onResizeStart,
        onResize,
        onResizeEnd
    };
};

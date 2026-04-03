import { useState, useCallback, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ResizeDimensions } from './useFlexibleResize';
import { NODE_DEFINITIONS } from '@/types/nodeDefinitions';
import { useHistoryStore } from '../../../store/useHistoryStore';
import { Transaction } from '../../../engine/types/types';
import { Brain } from '../../../engine/Brain';
import { useBrain } from '../../../context/BrainContext';

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
 * Unified hook for managing node dimensions during and after resize.
 * Handles local visual state for smooth updates and syncs with Brain atomically at resize end.
 *
 * Undo semantics: ONE Ctrl+Z restores both the outer frame AND any data changes
 * (e.g. matrix rows/cols) that occurred during the drag.
 */
export const useNodeDimensions = ({ id, type, data, onProject, onResize: onResizeCallback }: UseNodeDimensionsProps) => {
    const brain = useBrain();
    const { updateNodeData, getNode } = useReactFlow();
    const [localSize, setLocalSize] = useState<{ w: number; h: number } | null>(null);
    const pushHistory = useHistoryStore(s => s.push);
    // Captures the size + full data at the START of a drag for correct Undo payload
    const startSizeRef = useRef<{ w: number; h: number } | null>(null);
    const startDataRef = useRef<any>(null);

    const definition = NODE_DEFINITIONS.find(d => d.id === type);

    // Resolved width/height: local visual state > persisted data > definition default > safe fallback
    const width = Math.round(localSize?.w ?? (data.width as number) ?? definition?.minWidth ?? 100);
    const height = Math.round(localSize?.h ?? (data.height as number) ?? definition?.minHeight ?? 40);

    const onResize = useCallback(({ screenW, screenH }: ResizeDimensions) => {
        const projected = onProject ? onProject(screenW, screenH) : null;
        if (projected) {
            setLocalSize(projected);
        } else {
            setLocalSize({ w: screenW, h: screenH });
        }

        // Immediate sync to React Flow for relative positioning of children/handles
        // Brain.isResizing blocks this from being recorded to history
        const nextW = Math.round(projected?.w ?? screenW);
        const nextH = Math.round(projected?.h ?? screenH);

        updateNodeData(id, {
            width: nextW,
            height: nextH
        });

        // Trigger optional callback for component-specific logic (e.g. matrix structural change)
        onResizeCallback?.({ width: nextW, height: nextH });
    }, [id, updateNodeData, onProject, onResizeCallback]);

    // Called by ResizeHandle at the very beginning of a drag
    const onResizeStart = useCallback(() => {
        const node = getNode(id);
        if (node) {
            startSizeRef.current = { w: node.width || 100, h: node.height || 40 };
            // CRITICAL: Deep copy (structuredClone) to avoid the "Mirror Trap" 
            // where live data mutations pollute the history's inverse transaction.
            startDataRef.current = structuredClone(node.data || {});
        }

        // Block useBrainSync UPDATE_NODE_DATA during resize to prevent history spam
        brain.isResizing = true;
    }, [brain, id, getNode]);

    const onResizeEnd = useCallback(({ screenW, screenH }: ResizeDimensions) => {
        // Clear local override — let React Flow State / Brain take over
        setLocalSize(null);

        // Project the final coordinate bounds
        const projected = onProject ? onProject(screenW, screenH) : null;
        const finalW = Math.round(projected?.w ?? screenW);
        const finalH = Math.round(projected?.h ?? screenH);

        const oldSize = startSizeRef.current
            ? { width: startSizeRef.current.w, height: startSizeRef.current.h }
            : undefined;

        const finalNode = getNode(id);
        const finalNodeData = finalNode?.data;

        if (finalNodeData && startDataRef.current && startSizeRef.current) {
            // Exclude non-structural/ephemeral metadata
            const { value: _v, ...currentStructuralData } = finalNodeData as Record<string, unknown>;

            const forward: Transaction[] = [
                { type: 'UPDATE_NODE_DATA', payload: { id, data: structuredClone(currentStructuralData) } },
                { type: 'RESIZE_NODE', payload: { id, width: finalW, height: finalH } }
            ];

            const inverse: Transaction[] = [
                { type: 'UPDATE_NODE_DATA', payload: { id, data: startDataRef.current } },
                { type: 'RESIZE_NODE', payload: { id, width: startSizeRef.current.w, height: startSizeRef.current.h } }
            ];

            // Apply to Brain
            brain.applyTransaction({ type: 'BATCH', payload: forward });

            // Push to History
            pushHistory({
                id: `resize_${id}_${Date.now()}`,
                description: `Resize ${definition?.label || id}`,
                forward: [{ type: 'BATCH', payload: forward }],
                inverse: [{ type: 'BATCH', payload: inverse }]
            });
        } else {
            // Fallback: just resize (no data changes)
            brain.resizeNode(id, finalW, finalH, oldSize);
        }

        startSizeRef.current = null;
        startDataRef.current = null;

        // Reset isResizing AFTER the BATCH's cascade settles
        setTimeout(() => { brain.isResizing = false; }, 50);
    }, [id, onProject, getNode, brain, definition, pushHistory]);

    return {
        width,
        height,
        localSize,
        onResizeStart,
        onResize,
        onResizeEnd
    };
};


import { memo, useCallback } from 'react';
import { useReactFlow, Node } from '@xyflow/react';
import { useFlexibleResize, ResizeDimensions } from './hooks/useFlexibleResize';
import { cn } from '@/lib/utils';
import { NODE_DEFINITIONS } from '../../definitions/nodeDefinitions';
import { Brain } from '../../engine/Brain';

export type ResizeHandlePosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface ResizeHandleProps {
    /** ID of the node being resized */
    id: string;
    /** Ref to the node/container being measured */
    targetRef: React.RefObject<HTMLElement | null>;
    /** Handle placement position */
    position: ResizeHandlePosition;
    /** Resize callback */
    onResize: (dims: ResizeDimensions) => void;
    /** Optional callback on start */
    onResizeStart?: () => void;
    /** Optional callback on end */
    onResizeEnd?: (dims: ResizeDimensions) => void;
    /** Custom styles */
    className?: string;
}

/**
 * 📐 Unified Resize Handle Component
 * Encapsulates the arrow design, cursor logic, and resizing hook.
 */
export const ResizeHandle = memo(({
    id,
    targetRef,
    position,
    onResize,
    onResizeStart,
    onResizeEnd,
    className
}: ResizeHandleProps) => {
    const { getViewport, setNodes, getNode } = useReactFlow();

    // Origin Swapping Logic:
    // When resizing starts, if the node is in Center Origin [0.5, 0.5],
    // we must shift its position to [0, 0] (top-left) to ensure 
    // visual stability while the user drags the handle.
    const injectResizeStart = useCallback(() => {
        const node = getNode(id);
        if (!node) return;

        // Only swap if it's currently at center origin AND definition doesn't specify [0, 0]
        const currentOrigin = node.origin || [0.5, 0.5];
        const definition = NODE_DEFINITIONS.find(d => d.id === node.type);
        const nativeOrigin = definition?.layoutMetadata?.uiOrigin || [0.5, 0.5];

        // Skip swap if it's already top-left anchored natively
        if (nativeOrigin[0] === 0 && nativeOrigin[1] === 0) {
            onResizeStart?.();
            return;
        }

        if (currentOrigin[0] === 0.5 && currentOrigin[1] === 0.5) {
            const w = node.measured?.width ?? node.width ?? 0;
            const h = node.measured?.height ?? node.height ?? 0;

            // Calculate Top-Left position from Center position
            const newPos = {
                x: node.position.x - w * 0.5,
                y: node.position.y - h * 0.5
            };

            setNodes(nds => nds.map(n => n.id === id ? {
                ...n,
                origin: [0, 0] as [number, number],
                position: newPos
            } : n));
        }
        onResizeStart?.();
    }, [id, getNode, setNodes, onResizeStart]);

    const injectResizeEnd = useCallback((dims: ResizeDimensions) => {
        const { zoom } = getViewport();
        const node = getNode(id);
        const definition = NODE_DEFINITIONS.find(d => d.id === node?.type);

        // Use metadata limits if available, otherwise default to reasonable minimums
        const minW = definition?.minWidth ?? 80;
        const minH = definition?.minHeight ?? 40;

        // Compensate dimensions for zoom before passing to consumer
        const compensatedDims = {
            ...dims,
            screenW: Math.max(minW, dims.screenW / zoom),
            screenH: Math.max(minH, dims.screenH / zoom),
            deltaX: dims.deltaX / zoom,
            deltaY: dims.deltaY / zoom
        };

        if (!node) {
            onResizeEnd?.(compensatedDims);
            return;
        }

        // Restore Center Origin [0.5, 0.5] if it was natively centered
        const currentOrigin = node.origin || [0, 0];
        const nativeOrigin = definition?.layoutMetadata?.uiOrigin || [0.5, 0.5];

        if (currentOrigin[0] === 0 && currentOrigin[1] === 0 && nativeOrigin[0] === 0.5) {
            const w = node.measured?.width ?? node.width ?? 0;
            const h = node.measured?.height ?? node.height ?? 0;

            // Calculate Center position from Top-Left position
            const newPos = {
                x: node.position.x + w * 0.5,
                y: node.position.y + h * 0.5
            };

            setNodes(nds => nds.map(n => n.id === id ? {
                ...n,
                origin: [0.5, 0.5] as [number, number],
                position: newPos
            } : n));
        }

        // The actual Brain.getInstance().resizeNode is now handled by useNodeDimensions
        // where it has access to the component-specific snapped dimensions (onProject).

        onResizeEnd?.(compensatedDims);
    }, [id, getNode, getViewport, setNodes, onResizeEnd]);

    const injectOnResize = useCallback((dims: ResizeDimensions) => {
        const { zoom } = getViewport();
        const node = getNode(id);
        const definition = NODE_DEFINITIONS.find(d => d.id === node?.type);

        // Use metadata limits if available, otherwise default to reasonable minimums
        const minW = definition?.minWidth ?? 80;
        const minH = definition?.minHeight ?? 40;

        onResize({
            ...dims,
            screenW: Math.max(minW, dims.screenW / zoom),
            screenH: Math.max(minH, dims.screenH / zoom),
            deltaX: dims.deltaX / zoom,
            deltaY: dims.deltaY / zoom
        });
    }, [id, getNode, onResize, getViewport]);

    const { handleResizeStart, isResizing } = useFlexibleResize({
        targetRef,
        onResize: injectOnResize,
        onResizeStart: injectResizeStart,
        onResizeEnd: injectResizeEnd
    });

    // Determine cursor and rotation based on position
    const getStyles = () => {
        switch (position) {
            case 'bottom-right':
                return {
                    cursor: 'nwse-resize',
                    class: 'bottom-0.5 right-0.5 items-end justify-end',
                    rotate: 'rotate-0'
                };
            case 'bottom-left':
                return {
                    cursor: 'sw-resize',
                    class: 'bottom-0.5 left-0.5 items-end justify-start',
                    rotate: '-scale-x-100' // Flip horizontally
                };
            case 'top-right':
                return {
                    cursor: 'nesw-resize',
                    class: 'top-1.5 right-1.5 items-start justify-end',
                    rotate: '-scale-y-100' // Flip vertically
                };
            case 'top-left':
                return {
                    cursor: 'nwse-resize',
                    class: 'top-1.5 left-1.5 items-start justify-start',
                    rotate: 'rotate-180'
                };
            default:
                return { cursor: 'pointer', class: '', rotate: '' };
        }
    };

    const style = getStyles();

    return (
        <>
            <div
                className={cn(
                    "absolute w-5 h-5 z-50 flex transition-colors rounded-br-md",
                    "text-zinc-500 hover:text-blue-400 group-hover:opacity-100 opacity-0",
                    isResizing && "text-blue-500 opacity-100",
                    style.class,
                    className
                )}
                style={{ cursor: style.cursor }}
                onPointerDown={handleResizeStart}
            >
                <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className={cn(style.rotate, "drop-shadow-sm")}
                >
                    <path d="M 10 22 A 12 12 0 0 0 22 10" />
                </svg>
            </div>

            {/* Transparent overlay while resizing to prevent interaction interference */}
            {isResizing && (
                <div
                    className="fixed inset-0 z-50 bg-transparent"
                    style={{ cursor: style.cursor }}
                />
            )}
        </>
    );
});

ResizeHandle.displayName = 'ResizeHandle';

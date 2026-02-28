import { memo } from 'react';
import { useFlexibleResize, ResizeDimensions } from './hooks/useFlexibleResize';
import { cn } from '@/lib/utils';

export type ResizeHandlePosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface ResizeHandleProps {
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
    targetRef,
    position,
    onResize,
    onResizeStart,
    onResizeEnd,
    className
}: ResizeHandleProps) => {
    const { handleResizeStart, isResizing } = useFlexibleResize({
        targetRef,
        onResize,
        onResizeStart,
        onResizeEnd
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

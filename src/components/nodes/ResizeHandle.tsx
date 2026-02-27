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
                    class: 'bottom-0 right-0 items-end justify-end',
                    rotate: 'rotate-0'
                };
            case 'bottom-left':
                return {
                    cursor: 'sw-resize',
                    class: 'bottom-0 left-0 items-end justify-start',
                    rotate: '-scale-x-100' // Flip horizontally
                };
            case 'top-right':
                return {
                    cursor: 'nesw-resize',
                    class: 'top-0 right-0 items-start justify-end',
                    rotate: '-scale-y-100' // Flip vertically
                };
            case 'top-left':
                return {
                    cursor: 'nwse-resize',
                    class: 'top-0 left-0 items-start justify-start',
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
                    "absolute w-6 h-6 p-1 z-20 flex transition-colors",
                    "text-zinc-500 hover:text-blue-400 group-hover:opacity-100 opacity-0",
                    isResizing && "text-blue-500 opacity-100",
                    style.class,
                    className
                )}
                style={{ cursor: style.cursor }}
                onPointerDown={handleResizeStart}
            >
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={style.rotate}
                >
                    <path d="M22 22L12 12" />
                    <path d="M16 22L22 16" />
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

import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position, useReactFlow } from '@xyflow/react';

import { Brain } from '../../engine/Brain';
import { AbacusRod } from './AbacusRod';
import { useAbacusResize } from './hooks/useAbacusResize';

export const AbacusNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;
    const { updateNodeData, setNodes, getNode } = useReactFlow();
    const containerRef = useRef<HTMLDivElement>(null);
    // Store origin node X when resize starts, to compute position shift
    const originNodeXRef = useRef<number>(0);

    // Custom handles: output value
    const handles = useMemo(() => [
        {
            id: 'val',
            type: 'source' as const,
            position: Position.Right,
            variant: 'single' as const
        }
    ], []);

    const initialDigits: number[] = (data.digits as number[]) || Array(7).fill(0);
    const [digits, setDigits] = useState<number[]>(initialDigits);

    // Dynamic Width Calculation
    const [localWidth, setLocalWidth] = useState<number | null>(null);
    const containerWidth = localWidth || (data.width as number) || (7 * 28 + 24);
    const rodCount = Math.max(1, Math.floor((containerWidth - 24) / 28));

    // Custom Resize Logic (Left-side, extends left)
    const onResizeCallback = useCallback((newWidth: number, deltaX: number) => {
        setLocalWidth(newWidth);
        updateNodeData(id, { width: newWidth });
        // Shift node position: deltaX is negative when dragging left
        setNodes(nodes => nodes.map(n => {
            if (n.id !== id) return n;
            return {
                ...n,
                position: { ...n.position, x: originNodeXRef.current + deltaX }
            };
        }));
    }, [id, updateNodeData, setNodes]);

    const { handleResizeStart: rawResizeStart, isResizing } = useAbacusResize({
        containerRef,
        onResize: onResizeCallback
    });

    // Wrap handleResizeStart to capture node position at start
    const handleResizeStart = useCallback((e: React.PointerEvent) => {
        const node = getNode(id);
        if (node) {
            originNodeXRef.current = node.position.x;
        }
        rawResizeStart(e);
    }, [id, getNode, rawResizeStart]);

    // Reset local width when resizing stops
    useEffect(() => {
        if (!isResizing) {
            setLocalWidth(null);
        }
    }, [isResizing]);

    // Adjust digits array when rodCount changes
    useEffect(() => {
        if (digits.length !== rodCount) {
            setDigits(prev => {
                if (rodCount > prev.length) {
                    return [...Array(rodCount - prev.length).fill(0), ...prev];
                } else {
                    return prev.slice(prev.length - rodCount);
                }
            });
        }
    }, [rodCount]);

    useEffect(() => {
        if (data.digits && Array.isArray(data.digits)) {
            setDigits(data.digits as number[]);
        }
    }, [data.digits]);

    const handleRodChange = (colIdx: number, delta: number) => {
        let newDigits = [...digits];
        let currentIdx = colIdx;
        let carry = delta;

        while (currentIdx >= 0 && currentIdx < newDigits.length && carry !== 0) {
            let newVal = newDigits[currentIdx] + carry;
            if (newVal > 9) {
                newDigits[currentIdx] = newVal - 10;
                carry = 1;
                currentIdx--;
            } else if (newVal < 0) {
                newDigits[currentIdx] = newVal + 10;
                carry = -1;
                currentIdx--;
            } else {
                newDigits[currentIdx] = newVal;
                carry = 0;
            }
        }

        if (carry !== 0) return;

        setDigits(newDigits);
        updateNodeData(id, { digits: newDigits });

        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { digits: newDigits } }
        });
    };

    const nodeData = {
        ...data,
        handles,
        label: `Abacus ${digits.length} Digits`
    };

    return (
        <BaseNode {...props} data={nodeData} style={{ width: `${containerWidth + 24}px` }}>
            <div
                className="p-3 flex justify-center items-center select-none nodrag nowheel nopan relative group"
                style={{ width: `${containerWidth}px` }}
            >
                <div
                    ref={containerRef}
                    className="relative flex gap-1 rounded-lg p-2 bg-zinc-900 border border-zinc-800 shadow-xl w-full h-full"
                >
                    {/* Beam (橫梁) - Minimalist Line */}
                    <div
                        className="absolute top-[39px] left-0 right-0 h-[2px] z-0 bg-zinc-800 border-y border-zinc-700/20"
                    />

                    {/* Rods (列) */}
                    <div className="flex gap-1 w-full justify-center">
                        {digits.map((digit: number, colIdx: number) => (
                            <AbacusRod
                                key={colIdx}
                                value={digit}
                                onChange={(delta: number) => handleRodChange(colIdx, delta)}
                            />
                        ))}
                    </div>
                </div>

                {/* Custom Resize Handle (Bottom Left) */}
                <div
                    className={`absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize 
                              flex items-end justify-start p-1 z-20 
                              text-zinc-500 hover:text-orange-400 transition-colors
                              ${isResizing ? 'text-orange-500' : 'opacity-0 group-hover:opacity-100'}`}
                    onPointerDown={handleResizeStart}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="-scale-x-100">
                        <path d="M22 22L12 12" />
                        <path d="M16 22L22 16" />
                    </svg>
                </div>

                {/* Overlay while resizing to prevent interaction interference */}
                {isResizing && (
                    <div className="absolute inset-0 z-30 bg-transparent cursor-nwse-resize" />
                )}
            </div>
        </BaseNode>
    );
});

AbacusNode.displayName = 'AbacusNode';

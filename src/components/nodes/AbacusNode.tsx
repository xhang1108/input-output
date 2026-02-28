import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position, useReactFlow } from '@xyflow/react';

import { Brain } from '../../engine/Brain';
import { AbacusRod } from './AbacusRod';
import { ResizeHandle } from './ResizeHandle';

export const AbacusNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;
    const { updateNodeData, setNodes, getNode, getViewport } = useReactFlow();
    const containerRef = useRef<HTMLDivElement>(null);

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
    const rodCount = Math.max(7, Math.floor((containerWidth - 24) / 28));

    // Standard Resize Logic (Right-side expansion)
    const handleResizeRight = useCallback(({ screenW }: { screenW: number }) => {
        const { zoom } = getViewport();
        const MIN_WIDTH = 220;
        const nextWidth = Math.max(MIN_WIDTH, screenW / zoom);
        setLocalWidth(nextWidth);
        updateNodeData(id, { width: nextWidth });
    }, [id, updateNodeData, getViewport]);

    const handleResizeEnd = useCallback(() => {
        setLocalWidth(null);
    }, []);

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
            const newVal = newDigits[currentIdx] + carry;
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

                {/* Standard Resize Handle (Bottom Right) */}
                <ResizeHandle
                    targetRef={containerRef}
                    position="bottom-right"
                    onResize={handleResizeRight}
                    onResizeEnd={handleResizeEnd}
                    className="text-zinc-600 hover:text-orange-400"
                />
            </div>
        </BaseNode>
    );
});

AbacusNode.displayName = 'AbacusNode';

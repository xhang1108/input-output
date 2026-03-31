import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position, useReactFlow } from '@xyflow/react';

import { Brain } from '../../engine/Brain';
import { useBrain } from '../../context/BrainContext';
import { AbacusRod } from './AbacusRod';
import { ResizeHandle } from './ResizeHandle';
import { useNodeDimensions } from './hooks/useNodeDimensions';

/**
 * AbacusNode (IN-08)
 * Standard abacus input node with dynamic digit-rod resizing.
 * Anchored to Top-Left (Red-Dot).
 */
export const AbacusNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const { updateNodeData, getNode } = useReactFlow();
    const nodeRef = useRef<HTMLDivElement>(null);

    const initialDigits: number[] = (data.array as number[]) || Array(7).fill(0);
    const [digits, setDigits] = useState<number[]>(initialDigits);

    // Dimension management via unified hook
    const { width: totalWidth, onResize, onResizeStart, onResizeEnd } = useNodeDimensions({
        id,
        type: 'IN-08',
        data,
        onProject: useCallback((screenW: number) => ({
            w: screenW,
            h: (getNode(id)?.measured?.height) || (data.height as number) || 100
        }), [id, data.height, getNode]),
        onResize: useCallback(({ width: _w }: { width: number }) => {
            // Internal state sync if needed
        }, [])
    });

    const contentWidth = totalWidth - 24; // BaseNode padding
    const rodCount = Math.max(7, Math.floor((contentWidth - 24) / 28));

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
    }, [rodCount, digits.length]);

    useEffect(() => {
        if (data.array && Array.isArray(data.array)) {
            setDigits(data.array as number[]);
        }
    }, [data.array]);

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
        updateNodeData(id, { array: newDigits });

        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: { id, data: { array: newDigits } }
        });
    };

    const nodeData = useMemo(() => ({
        ...data,
        label: data.label || 'Abacus',
        width: totalWidth
    }), [data, totalWidth]);

    return (
        <BaseNode {...props} ref={nodeRef} data={nodeData} style={{ width: `${totalWidth}px` }}>
            <div
                className="p-3 flex-1 flex justify-center items-center select-none nodrag nowheel nopan relative group w-full h-full"
                style={{ width: `${contentWidth}px` }}
            >
                <div
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
            </div>

            {/* Standard Resize Handle (Bottom Right) */}
            <ResizeHandle
                id={id}
                targetRef={nodeRef}
                position="bottom-right"
                onResize={onResize}
                onResizeStart={onResizeStart}
                onResizeEnd={onResizeEnd}
                className="text-zinc-600 hover:text-orange-400"
            />
        </BaseNode>
    );
});

AbacusNode.displayName = 'AbacusNode';

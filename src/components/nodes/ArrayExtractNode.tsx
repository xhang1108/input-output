import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';

/**
 * DA-06: ArrayExtractNode
 */
export const ArrayExtractNode = memo((props: NodeProps) => {
    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1 min-w-[120px]">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-(--color-matrix)/20 flex items-center justify-center text-(--color-matrix)">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                    </div>
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Extraction</span>
                </div>
                <div className="text-[11px] text-zinc-500 italic px-1">
                    Extracts element at index from matrix or vector.
                </div>
            </div>
        </BaseNode>
    );
});
ArrayExtractNode.displayName = 'ArrayExtractNode';

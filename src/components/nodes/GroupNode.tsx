'use client';

import { memo, type CSSProperties } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { GroupNodeData } from '../../types/groupNode';

/**
 * Group outer shell (GROUP_NODE_PLAN §5.4).
 * A single collapsed node: `data.handles` derives 1:1 from the boundary
 * (left inputs, right outputs, colors via the shared handleUtils chain in
 * SingleHandle/CapsuleHandle). The subGraph lives in `data` and is evaluated
 * as one node by the P1 interpreter; Tab / double-click drills in.
 */
export const GroupNode = memo((props: NodeProps & { style?: CSSProperties }) => {
    const data = (props.data ?? {}) as Partial<GroupNodeData>;
    const inputs = data.boundary?.inputs ?? [];
    const outputs = data.boundary?.outputs ?? [];
    const innerCount = data.subGraph?.nodes?.length ?? 0;

    return (
        <BaseNode {...props} style={{ minWidth: 200, ...props.style }}>
            <div className="flex flex-col gap-1.5 p-1 w-full text-zinc-100">
                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                        {innerCount} node{innerCount === 1 ? '' : 's'}
                    </span>
                    <span>
                        {inputs.length} in · {outputs.length} out
                    </span>
                </div>
                <div className="text-[9px] text-zinc-600 italic">Tab / double-click to enter</div>
            </div>
        </BaseNode>
    );
});

GroupNode.displayName = 'GroupNode';

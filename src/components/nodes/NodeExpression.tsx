'use client';

import { memo, useCallback, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { MathEngine } from '../../engine/MathEngine';

export const NodeExpression = memo((props: NodeProps) => {
    const { id, data } = props;
    const [code, setCode] = useState<string>((data.code as string) || '');

    // Cleanup lingering handles from previous logic/state
    useEffect(() => {
        if (data.handles && (data.handles as any[]).length > 1) {
            Brain.getInstance().applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: {
                    id,
                    data: { handles: undefined } // Reset to use static definition (output-only)
                }
            }, false, true); // Silent, no undo record for cleanup
        }
    }, [id, data.handles]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setCode(val);
    };

    const handleBlur = () => {
        Brain.getInstance().applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { code }
            }
        });
    };

    return (
        <BaseNode {...props} type="SY-05">
            <div className="flex flex-col gap-2 p-1 min-w-[200px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Senior Expression</label>
                <textarea
                    className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:border-blue-500 outline-none resize-none font-mono"
                    style={{ background: 'var(--node-bg)', minHeight: '60px' }}
                    value={code}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="e.g. sqrt(a^2 + b^2)"
                />
            </div>
        </BaseNode>
    );
});

NodeExpression.displayName = 'NodeExpression';

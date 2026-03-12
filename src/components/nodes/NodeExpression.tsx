import { memo, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { HandleConfig } from '../../types/NodeDefinition';

export const NodeExpression = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const [code, setCode] = useState<string>((data.code as string) || '');

    const handles: HandleConfig[] = [
        { id: 'out', type: 'source', position: Position.Right, variant: 'single', dataType: 'symbolic', color: 'var(--color-symbolic)' }
    ];

    const nodeData = { ...data, handles };

    // Sync if data.code changes from external source (like IOGL load/undo)
    useEffect(() => {
        if (data.code !== undefined && data.code !== code) {
            setCode(data.code as string);
        }
    }, [data.code]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCode(e.target.value);
    };

    const handleBlur = () => {
        brain.applyTransaction({
            type: 'UPDATE_NODE_DATA',
            payload: {
                id,
                data: { code }
            }
        });
    };

    return (
        <BaseNode {...props} data={nodeData} type="IN-09">
            <div className="flex flex-col gap-2 p-1 min-w-[200px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Expression string</label>
                <textarea
                    className="nodrag w-full border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:border-blue-500 outline-none resize-none font-mono"
                    style={{ background: 'var(--node-bg)', minHeight: '60px' }}
                    value={code}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onMouseDown={(e) => e.stopPropagation()}
                    placeholder="e.g. A * sin(omega * t)"
                />
            </div>
        </BaseNode>
    );
});

NodeExpression.displayName = 'NodeExpression';

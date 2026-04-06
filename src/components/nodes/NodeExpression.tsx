import { memo, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Position } from '@xyflow/react';
import { useBrain } from '../../context/BrainContext';
import { HandleConfig } from '../../types/nodeDefinitions';
import { StringInput } from '../common/StringInput';

export const NodeExpression = memo((props: NodeProps) => {
    const { id, data } = props;
    const brain = useBrain();
    const [code, setCode] = useState<string>((data.code as string) || '');

    const handles: HandleConfig[] = [
        { id: 'out_a', type: 'source', position: Position.Right, variant: 'single', dataType: 'any' }
    ];

    const nodeData = { ...data, handles };

    // Sync if data.code changes from external source (like IOGL load/undo)
    useEffect(() => {
        if (data.code !== undefined && data.code !== code) {
            setCode(data.code as string);
        }
    }, [data.code]);

    // Debounced Engine Sync
    useEffect(() => {
        const timer = setTimeout(() => {
            if (code !== data.code) {
                brain.applyTransaction({
                    type: 'UPDATE_NODE_DATA',
                    payload: { id, data: { code } }
                });
            }
        }, 300); // 300ms debounce for expression typing
        return () => clearTimeout(timer);
    }, [code, id, brain, data.code]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCode(e.target.value);
    };

    return (
        <BaseNode {...props} data={nodeData} type="IN-09">
            <div className="flex flex-col gap-2 p-1 min-w-[200px]">
                <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Expression string</label>
                <StringInput
                    multiline
                    monospace
                    value={code}
                    onChange={(val) => setCode(val)}
                    placeholder="e.g. A * sin(omega * t)"
                    minHeight="60px"
                    inputClassName="text-[11px]"
                />
            </div>
        </BaseNode>
    );
});

NodeExpression.displayName = 'NodeExpression';


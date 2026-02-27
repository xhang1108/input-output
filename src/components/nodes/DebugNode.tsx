
import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const DebugNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const value = data.value;

    const handles = [
        {
            id: 'in',
            type: 'target',
            position: Position.Left,
            variant: 'single'
        }
    ];

    const nodeData = { ...data, handles };

    // Safety: Ensure we don't crash on circular references if any
    let debugStr = 'Waiting...';
    try {
        if (value !== undefined) {
            // If it's a Payload, unwrap for cleaner view, or show full structure?
            // User wants to see what they receive. Let's show full payload structure + raw value.
            const payload = (typeof value === 'object' && value !== null && 'type' in value)
                ? value
                : { type: typeof value, value }; // Wrap raw

            debugStr = JSON.stringify(payload, null, 2);
        }
    } catch (e) {
        debugStr = 'Circular/Error';
    }

    const renderFormatted = () => {
        if (!data.value || typeof data.value !== 'object') return null;
        const payload = data.value as import('../../types/payload').NodePayload;
        const meta = payload.meta || {};
        const val = Number(PayloadUtils.unwrap(payload));

        if (meta.unit && ['HEX', 'BIN', 'OCT', 'DEC', 'DUO'].includes(meta.unit)) {
            let formatted = val.toString(10);
            if (meta.unit === 'HEX') formatted = val.toString(16).toUpperCase();
            if (meta.unit === 'BIN') formatted = val.toString(2);
            if (meta.unit === 'OCT') formatted = val.toString(8);

            return (
                <div className="mt-2 pt-2 border-t border-zinc-800">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-wider">Formatted Display</div>
                    <div className="font-mono text-cyan-400 text-sm">
                        {formatted} <span className="text-[9px] text-zinc-600">{meta.unit}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-2 min-w-[200px] max-w-[400px]">
                <div className="flex justify-between items-center">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                        Debug NPanel
                    </div>
                    <button
                        onClick={() => navigator.clipboard.writeText(debugStr)}
                        className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded transition-colors"
                        title="Copy to Clipboard"
                    >
                        Copy
                    </button>
                </div>
                <div className="bg-black/50 p-2 rounded border border-zinc-800 font-mono text-[10px] text-green-400 whitespace-pre-wrap break-all overflow-auto max-h-[300px]">
                    {debugStr}
                </div>
                {renderFormatted()}
            </div>
        </BaseNode>
    );
});

DebugNode.displayName = 'DebugNode';

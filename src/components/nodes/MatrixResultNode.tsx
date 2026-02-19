import { memo, useMemo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps, NodeResizer, Position } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';

export const MatrixResultNode = memo((props: NodeProps) => {
    const { id, data, selected } = props;

    // Custom single input handle + Legacy handles
    const handles = useMemo(() => [
        {
            id: 'in',
            type: 'target' as const,
            position: Position.Left,
            variant: 'single' as const,
            dataType: 'matrix' as const
        }
    ], []);

    const nodeData = { ...data, handles };
    const payload = data.value as import('../../types/payload').NodePayload;

    // Debug
    // console.log('[MatrixResultNode] Payload:', payload);


    let matrixData: unknown[][] = [];
    let isValid = false;
    let rows = 0;
    let cols = 0;
    let errorMessage: string | null = null;

    if (payload) {
        if (payload.type === 'error') {
            errorMessage = payload.meta?.error || 'Error';
        } else {
            const rawValue = PayloadUtils.unwrap(payload);

            // Try to extract matrix data
            if (Array.isArray(rawValue)) {
                matrixData = rawValue;
                isValid = true;
            } else if (typeof rawValue === 'object' && rawValue !== null) {
                const r = rawValue as { isMatrix?: boolean; toArray?: () => unknown[][]; mathjs?: string; data?: unknown[][] };
                if (r.isMatrix && r.toArray) {
                    // Live math.js Matrix
                    matrixData = r.toArray();
                    isValid = true;
                } else if (r.mathjs === 'Matrix') {
                    // Dehydrated JSON
                    matrixData = r.data || [];
                    isValid = true;
                }
            }

            if (!isValid && typeof rawValue === 'number') {
                // Treat scalar as 1x1 matrix
                matrixData = [[rawValue]];
                isValid = true;
            } else {
                errorMessage = "Waiting for Matrix...";
            }
        }
    } else {
        errorMessage = "Waiting for Data...";
    }

    if (isValid) {
        rows = matrixData.length;
        cols = matrixData[0]?.length || 0;
    }

    // Style matching ArrayNode
    if (isValid) {
        return (
            <BaseNode {...props} data={nodeData}>
                <div className="p-2 flex flex-col gap-1 items-center justify-center">
                    {matrixData.map((row, r) => (
                        <div key={r} className="flex gap-1">
                            {row.map((val, c) => (
                                <div
                                    key={c}
                                    className="w-10 h-8 flex items-center justify-center text-xs font-mono 
                                             bg-zinc-800/50 border border-zinc-700/50 rounded 
                                             text-zinc-200 overflow-hidden"
                                    title={String(val)}
                                >
                                    {typeof val === 'number' ? Math.round(val * 1000) / 1000 : String(val)}
                                </div>
                            ))}
                        </div>
                    ))}
                    <div className="text-[10px] text-zinc-500 font-mono mt-1">
                        {rows} × {cols}
                    </div>
                </div>
            </BaseNode>
        );
    }

    // Error / Waiting State
    return (
        <BaseNode {...props} data={nodeData}>
            <div className="p-4 flex flex-col items-center justify-center text-center min-h-[60px] min-w-[120px]">
                <span className="text-xs text-zinc-400 mb-1">{errorMessage}</span>
                {/* Debug Info */}
                {payload && (
                    <div className="text-[8px] text-zinc-600 font-mono break-all max-w-[150px] mt-2 border-t border-zinc-800 pt-1">
                        Type: {payload.type}<br />
                        Value: {JSON.stringify(PayloadUtils.unwrap(payload)).slice(0, 50)}
                    </div>
                )}
            </div>
        </BaseNode>
    );
});

MatrixResultNode.displayName = 'MatrixResultNode';

import { memo } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { PayloadUtils } from '../../utils/PayloadUtils';

/**
 * 📝 FormulaResultNode (IO-17)
 * 
 * A specialized node for displaying the complete symbolic formula
 * behind a calculation. Uses Glassmorphism for a premium look.
 */
export const FormulaResultNode = memo((props: NodeProps) => {
    const { data } = props;

    // Define custom handles: Single Input (Dot)
    const handles = [
        {
            id: 'in',
            type: 'target',
            position: 'left',
            variant: 'single'
        }
    ];

    const nodeData = { ...data, handles };
    const payload = data.value as import('../../types/payload').NodePayload;

    let formula = '';
    if (payload && payload.symbol) {
        formula = PayloadUtils.stringifySymbol(payload.symbol);
    } else if (payload) {
        // Fallback to unwrapped value if no symbol is present
        formula = String(PayloadUtils.unwrap(payload));
    }

    return (
        <BaseNode {...props} data={nodeData}>
            <div className="flex flex-col gap-2 p-2 min-w-[200px] max-w-[400px]">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Calculation Path</label>
                </div>

                {/* Glassmorphism Formula Display */}
                <div className="relative group/formula">
                    <div className="absolute -inset-0.5 bg-linear-to-r from-(--color-scalar) to-(--color-math) opacity-10 blur rounded-lg group-hover/formula:opacity-20 transition-opacity"></div>
                    <div className="relative bg-black/40 backdrop-blur-md border border-zinc-800/50 rounded-lg p-4 font-mono text-sm wrap-break-word leading-relaxed">
                        {!formula ? (
                            <span className="text-zinc-700 italic opacity-50 select-none cursor-default">
                                Wait for input...
                            </span>
                        ) : (
                            <span className="text-(--color-scalar) drop-shadow-[0_0_8px_rgba(var(--color-scalar-rgb),0.3)]">
                                {formula}
                            </span>
                        )}
                    </div>
                </div>

                <div className="text-[9px] text-zinc-600 italic text-right px-1">
                    Symbolic Trace
                </div>
            </div>
        </BaseNode>
    );
});

FormulaResultNode.displayName = 'FormulaResultNode';

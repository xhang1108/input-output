import React, { memo } from 'react';

interface FormulaViewProps {
    formula: string;
}

export const FormulaView: React.FC<FormulaViewProps> = memo(({ formula }) => {
    return (
        <div className="flex flex-col gap-2 p-1 min-w-[200px] max-w-[400px]">
            {/* Glassmorphism Formula Display (Text) */}
            <div className="relative group/formula">
                <div className="absolute -inset-0.5 bg-linear-to-r from-(--color-scalar) to-(--color-math) opacity-10 blur rounded-(--radius-lg) group-hover/formula:opacity-20 transition-opacity"></div>
                <div className="relative bg-black/40 backdrop-blur-md border border-zinc-800/50 rounded-(--radius-lg) p-4 font-mono text-sm wrap-break-word leading-relaxed flex items-center justify-center">
                    {!formula ? (
                        <span className="text-zinc-700 italic opacity-50 select-none cursor-default">
                            Wait for input...
                        </span>
                    ) : (
                        <div className="text-(--color-scalar) drop-shadow-[0_0_8px_rgba(var(--color-scalar-rgb),0.3)]">
                            {formula}
                        </div>
                    )}
                </div>
            </div>

            <div className="text-[9px] text-zinc-600 italic text-right px-1">
                Plain Formula
            </div>
        </div>
    );
});

FormulaView.displayName = 'FormulaView';

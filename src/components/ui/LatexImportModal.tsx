
import { useState, useEffect, useRef } from 'react';
import { X, Check, Calculator } from 'lucide-react';
import { Brain } from '@/engine/Brain';
import { useAppStore } from '@/store/useStore';
import { parseLatexToGraph } from '@/utils/latex/latexToGraph';
import { toast } from 'sonner';

interface LatexImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LatexImportModal({ isOpen, onClose }: LatexImportModalProps) {
    const [latex, setLatex] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus on open
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Get layout settings from store to trigger auto-layout if needed
    // Actually, layout might be handled by the transactions or a separate event
    const { logAction, layoutAlgorithm, layoutDirection } = useAppStore();

    if (!isOpen) return null;

    const handleImport = async () => {
        if (!latex.trim()) return;

        setIsProcessing(true);
        try {
            // Center of screen or standard offset? 
            // We'll place it at a default location, AutoLayout will fix it.
            const startPos = { x: 0, y: 0 };

            const transactions = parseLatexToGraph(latex, startPos);

            if (transactions.length === 0) {
                toast.error('Failed to parse LaTeX. Please check syntax.');
                setIsProcessing(false);
                return;
            }

            // Apply Transactions
            const brain = Brain.getInstance();
            // Batch apply? Brain doesn't have explicit batch yet, but we can loop.
            // Better: Add a multi-transaction method or just loop.
            transactions.forEach(tx => brain.applyTransaction(tx));

            logAction(`Imported LaTeX: ${latex.substring(0, 20)}...`);
            toast.success('LaTeX imported successfully!');

            // Trigger Auto Layout (Global)
            // Ideally we'd only layout the new nodes, but for now global layout is safer to ensure no overlap.
            // We need to access the store's layout trigger or just let the user press 'L'.
            // For now, let's just toast "Press 'L' to arrange".
            // Or if we have access to a layout function... 
            // The hook useAutoLayout is inside Body, not here.
            // We can emit a custom event or just let it pile up.
            // Let's rely on user or a global event if available.

            setLatex('');
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('Error importing LaTeX');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-(--color-unit)" />
                        Import LaTeX
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-xs text-zinc-400 font-medium">LaTeX Equation</label>
                    <textarea
                        ref={textareaRef}
                        value={latex}
                        onChange={(e) => setLatex(e.target.value)}
                        placeholder="e.g. x^2 + 2x + 1"
                        className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-200 focus:border-blue-500 outline-none resize-none font-mono"
                    />
                    <p className="text-[10px] text-zinc-500">
                        Supports standard math notation. Variables will be converted to Input Nodes.
                    </p>
                </div>

                <div className="flex justify-end gap-2 mt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!latex.trim() || isProcessing}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                    >
                        {isProcessing ? 'Parsing...' : (
                            <>
                                <Check className="w-4 h-4" />
                                Import
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

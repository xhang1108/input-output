'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Upload, Check, Copy, Calculator as CalcIcon, FileText } from 'lucide-react';
import { Brain } from '../../engine/Brain';
import { parseLatexToGraph } from '../../utils/latex/latexToGraph';
import { toast } from 'sonner';
import { useMouth } from '../../hooks/useMouth';

interface GraphImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type ImportMode = 'CGL' | 'LaTeX';

export function GraphImportModal({ isOpen, onClose }: GraphImportModalProps) {
    const [mode, setMode] = useState<ImportMode>('CGL');
    const [input, setInput] = useState('');
    const [shouldClear, setShouldClear] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [diagnostics, setDiagnostics] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [copied, setCopied] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { consumeGraph } = useMouth();

    // Auto-focus on open or mode switch
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [isOpen, mode]);

    if (!isOpen) return null;

    const handleImport = async () => {
        setError(null);
        setDiagnostics([]);
        setSuccess(false);
        setIsProcessing(true);

        try {
            const result = await consumeGraph(input, mode, shouldClear);

            if (!result.success) {
                throw new Error(result.error || "Failed to parse or inject data.");
            }

            setDiagnostics(result.diagnostics || []);
            setSuccess(true);
            toast.success(`${mode} imported successfully!`);

            setTimeout(() => {
                setSuccess(false);
                if (result.diagnostics && result.diagnostics.length === 0) {
                    onClose();
                    setInput('');
                } else if (mode === 'LaTeX') {
                    onClose();
                    setInput('');
                }
            }, 1000);

        } catch (err: unknown) {
            console.error("Import failed:", err);
            setError((err as Error).message || "Failed to parse or inject data.");
            toast.error("Import failed");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCopyDiagnostics = () => {
        const text = diagnostics.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div
            className="fixed inset-0 z-1001 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[500px] max-w-[90vw] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-2 text-zinc-100 font-medium text-sm">
                        <Upload className="w-4 h-4 text-(--color-unit)" />
                        Import
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex p-1 bg-zinc-950 border-b border-zinc-800">
                    {(['CGL', 'LaTeX'] as ImportMode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => {
                                setMode(m);
                                setInput('');
                                setError(null);
                                setDiagnostics([]);
                            }}
                            className={`
                                flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all
                                ${mode === m
                                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}
                            `}
                        >
                            {m === 'CGL' ? <FileText className="w-3.5 h-3.5" /> : <CalcIcon className="w-3.5 h-3.5" />}
                            {m}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                            {mode === 'CGL' ? 'CGL Script' : 'LaTeX Equation'}
                        </label>
                        <textarea
                            ref={textareaRef}
                            className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 outline-none focus:border-zinc-600 resize-none placeholder-zinc-700"
                            placeholder={mode === 'CGL' ? '# Node definitions...' : 'e.g. x^2 + 2x + 1'}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            spellCheck={false}
                        />
                    </div>

                    {/* Options */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShouldClear(!shouldClear)}
                            className={`
                                flex items-center gap-2 px-2 py-1.5 rounded border text-[10px] font-bold uppercase tracking-tight transition-colors
                                ${shouldClear
                                    ? 'bg-red-900/20 border-red-800 text-red-300'
                                    : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-600'}
                            `}
                        >
                            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${shouldClear ? 'bg-red-500 border-red-500 text-white' : 'border-zinc-700'}`}>
                                {shouldClear && <Check className="w-2.5 h-2.5" />}
                            </div>
                            Clear canvas before import
                        </button>
                    </div>

                    {/* Status / Error */}
                    {error && (
                        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="text-xs text-green-400 bg-green-950/30 border border-green-900/50 p-2 rounded flex items-center gap-2">
                            <Check className="w-3 h-3" />
                            Successfully imported!
                        </div>
                    )}

                    {diagnostics.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between px-1">
                                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Warnings</div>
                                <button
                                    onClick={handleCopyDiagnostics}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-500 transition-colors group"
                                >
                                    {copied ? 'COPIED!' : 'COPY'}
                                </button>
                            </div>
                            <div className="max-h-32 overflow-y-auto bg-amber-950/20 border border-amber-900/30 rounded p-2 flex flex-col gap-1.5 custom-scrollbar">
                                {diagnostics.map((d, i) => (
                                    <div key={i} className="text-[11px] text-amber-200/80 leading-relaxed flex gap-2">
                                        <span className="text-amber-500 shrink-0">•</span>
                                        {d}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={!input.trim() || isProcessing}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isProcessing ? 'Processing...' : (
                            <>
                                <Upload className="w-3 h-3" />
                                Import
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

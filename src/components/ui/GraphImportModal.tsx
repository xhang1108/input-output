'use client';

import { useState } from 'react';
import { X, Upload, FileJson, Check, Copy } from 'lucide-react';
import { Brain } from '../../engine/Brain';

interface JsonImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GraphImportModal({ isOpen, onClose }: JsonImportModalProps) {
    const [jsonInput, setJsonInput] = useState('');
    const [shouldClear, setShouldClear] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [diagnostics, setDiagnostics] = useState<string[]>([]);
    const [success, setSuccess] = useState(false);
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleImport = async () => {
        setError(null);
        setDiagnostics([]);
        setSuccess(false);

        try {
            if (!jsonInput.trim()) {
                throw new Error("Please enter JSON or CGL data.");
            }

            let graphData: any;

            // Auto-detect format
            const trimmed = jsonInput.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                // JSON
                graphData = JSON.parse(jsonInput);
                if (!graphData.nodes || !Array.isArray(graphData.nodes)) {
                    throw new Error("Invalid JSON format: 'nodes' array is required.");
                }
            } else {
                // CGL
                // Dynamic import to avoid circular dependency issues if any,
                // though standard import is likely fine.
                // But for now let's just use the strict import at top of file.
                // We need to add the import first.
                // Let's assume we added "import { GraphCodec } ..."
                const { GraphCodec } = await import('../../engine/GraphCodec');
                const result = GraphCodec.parse(jsonInput);
                graphData = result.graph;
                setDiagnostics(result.diagnostics);

                if (graphData.nodes.length === 0 && graphData.edges.length === 0 && result.diagnostics.length === 0) {
                    console.warn('[JsonImport] Warning: Parsed graph is empty');
                }
            }

            console.log('[JsonImport] Injecting Graph:', {
                nodes: graphData.nodes?.length,
                edges: graphData.edges?.length,
                nodeIds: graphData.nodes?.map((n: any) => n.id),
                edgeIds: graphData.edges?.map((e: any) => e.targetHandle) // Check target handles
            });

            Brain.getInstance().injectNodes(graphData, shouldClear);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                // Only auto-close if there are no warnings to read
                if (graphData.nodes.length > 0 && diagnostics.length === 0) {
                    onClose();
                    setJsonInput('');
                }
            }, 1000);

        } catch (err: any) {
            console.error("Import failed:", err);
            setError(err.message || "Failed to parse or inject data.");
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
        <div className="fixed inset-0 z-1001 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[500px] max-w-[90vw] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-2 text-zinc-100 font-medium">
                        <FileJson className="w-4 h-4 text-(--color-unit)" />
                        Import Graph
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">JSON Data</label>
                        <textarea
                            className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 outline-none focus:border-zinc-600 resize-none placeholder-zinc-700"
                            placeholder='{ "nodes": [...], "edges": [...] }'
                            value={jsonInput}
                            onChange={e => setJsonInput(e.target.value)}
                            spellCheck={false}
                        />
                    </div>

                    {/* Options */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShouldClear(!shouldClear)}
                            className={`
                                flex items-center gap-2 px-2 py-1.5 rounded border text-xs font-medium transition-colors
                                ${shouldClear
                                    ? 'bg-red-900/20 border-red-800 text-red-300'
                                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'}
                            `}
                        >
                            <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${shouldClear ? 'bg-red-500 border-red-500 text-white' : 'border-zinc-600'}`}>
                                {shouldClear && <Check className="w-2.5 h-2.5" />}
                            </div>
                            Clear existing canvas
                        </button>
                    </div>

                    {/* Status / Error */}
                    {error && (
                        <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 p-2 rounded">
                            Error: {error}
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
                                <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Import Warnings</div>
                                <button
                                    onClick={handleCopyDiagnostics}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-500 transition-colors group"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-2.5 h-2.5" />
                                            <span>COPIED!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-2.5 h-2.5 group-hover:scale-110 transition-transform" />
                                            <span>COPY</span>
                                        </>
                                    )}
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
                    <div className="flex gap-2">

                        <button
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!jsonInput.trim()}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/20"
                        >
                            <Upload className="w-3 h-3" />
                            Import
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

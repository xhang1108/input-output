'use client';

import { useState, useEffect } from 'react';
import { X, Download, Copy, Check } from 'lucide-react';
import { useMouth } from '../../hooks/nerves/useMouth';

interface GraphExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GraphExportModal({ isOpen, onClose }: GraphExportModalProps) {
    const { generateIOGL, downloadIOGL, copyToClipboard } = useMouth();
    const [exportData, setExportData] = useState('');
    const [copied, setCopied] = useState(false);

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setExportData(generateIOGL());
        }
    }

    const handleCopy = async () => {
        const success = await copyToClipboard(exportData);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        downloadIOGL();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-1001 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-surface-base border border-border-dim rounded-xl w-[500px] max-w-[90vw] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-surface-light flex items-center justify-between bg-surface-base/50">
                    <div className="flex items-center gap-2 text-zinc-100 font-medium text-sm">
                        <Download className="w-4 h-4 text-(--color-unit)" />
                        Export
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-surface-light text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">IOGL Script (Human-Readable)</label>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 hover:text-zinc-200 transition-colors group"
                            >
                                {copied ? 'COPIED!' : 'COPY'}
                            </button>
                        </div>
                        <textarea
                            className="w-full h-80 bg-surface-dim border border-surface-light rounded-lg p-3 text-xs font-mono text-zinc-300 outline-none focus:border-focus/50 resize-none custom-scrollbar"
                            readOnly
                            value={exportData}
                            spellCheck={false}
                        />
                    </div>

                    <div className="text-[10px] text-zinc-500 leading-relaxed px-1">
                        Exporting to <span className="text-zinc-200 font-bold">Input-Output Graph Language</span>. This format is optimized for version control and sharing.
                    </div>
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-surface-light bg-surface-base/50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:bg-surface-light hover:text-zinc-200 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleDownload}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cloud text-white hover:bg-cloud/80 transition-colors flex items-center gap-2"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Download .iogl File
                    </button>
                </div>
            </div>
        </div>
    );
}


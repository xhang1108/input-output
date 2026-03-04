import { useCallback } from 'react';
import { Brain } from '../engine/Brain';
import { GraphCodec } from '../engine/GraphCodec';
import { parseLatexToGraph } from '../utils/latex/latexToGraph';

/**
 * useMouth (The Mouth/Speech Organ)
 * Handles all I/O flows: Import (Eating) and Export (Speaking).
 */
export function useMouth() {
    const getBrain = useCallback(() => Brain.getInstance(), []);

    /**
     * Generates a IOGL representation of the current graph.
     */
    const generateIOGL = useCallback(() => {
        const graph = getBrain().toInjectable();
        return GraphCodec.encode(graph);
    }, [getBrain]);

    /**
     * Generates a JSON representation of the current graph.
     */
    const generateJSON = useCallback(() => {
        const graph = getBrain().toInjectable();
        return JSON.stringify(graph, null, 2);
    }, [getBrain]);

    /**
     * Triggers a browser download of a string content.
     */
    const downloadFile = useCallback((content: string, filename: string, mimeType: string = 'text/plain') => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    /**
     * Helper to download the current graph as IOGL.
     */
    const downloadIOGL = useCallback(() => {
        const iogl = generateIOGL();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadFile(iogl, `input-output-graph-${timestamp}.iogl`);
    }, [generateIOGL, downloadFile]);

    /**
     * Helper to copy text to clipboard.
     */
    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            return false;
        }
    }, []);

    /**
     * Consumes Graph data (IOGL or LaTeX) and injects it into the Brain.
     * Returns diagnostics from the parsing and injection steps.
     */
    const consumeGraph = useCallback(async (
        input: string,
        mode: 'IOGL' | 'LaTeX',
        shouldClear: boolean = false,
        onProgress?: (processed: number, total: number) => void
    ): Promise<{ success: boolean; diagnostics: string[]; error?: string }> => {
        try {
            if (!input.trim()) {
                throw new Error(`Please enter ${mode} data.`);
            }

            const brain = getBrain();
            let injectDiagnostics: string[] = [];
            let parseDiagnostics: string[] = [];

            if (mode === 'IOGL') {
                const result = GraphCodec.parse(input);
                const graphData = result.graph;
                parseDiagnostics = result.diagnostics;

                // Inject the graph data
                injectDiagnostics = await brain.injectNodes(graphData, shouldClear, false, onProgress);

                return {
                    success: true,
                    diagnostics: [...parseDiagnostics, ...injectDiagnostics]
                };
            } else {
                // LaTeX Mode
                const transactions = parseLatexToGraph(input, { x: 0, y: 0 });
                if (transactions.length === 0) {
                    throw new Error("Failed to parse LaTeX. Please check syntax.");
                }

                if (shouldClear) {
                    brain.clearAll();
                }

                let processed = 0;
                const CHUNK_SIZE = 50;

                for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
                    const chunk = transactions.slice(i, i + CHUNK_SIZE);
                    chunk.forEach(tx => brain.applyTransaction(tx, true, true));
                    processed += chunk.length;

                    if (onProgress) onProgress(processed, transactions.length);
                    // Yield to browser UI for a paint
                    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
                }

                return {
                    success: true,
                    diagnostics: ['LaTeX imported successfully!']
                };
            }
        } catch (err: unknown) {
            console.error("consumeGraph failed:", err);
            return {
                success: false,
                diagnostics: [],
                error: (err as Error).message || "Failed to parse or inject data."
            };
        }
    }, [getBrain]);

    return {
        generateIOGL,
        generateJSON,
        downloadFile,
        downloadIOGL,
        copyToClipboard,
        consumeGraph
    };
}


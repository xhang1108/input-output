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
     * Generates a CGL representation of the current graph.
     */
    const generateCGL = useCallback(() => {
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
     * Helper to download the current graph as CGL.
     */
    const downloadCGL = useCallback(() => {
        const cgl = generateCGL();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadFile(cgl, `calctopus-graph-${timestamp}.cgl`);
    }, [generateCGL, downloadFile]);

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
     * Consumes Graph data (CGL or LaTeX) and injects it into the Brain.
     * Returns diagnostics from the parsing and injection steps.
     */
    const consumeGraph = useCallback(async (input: string, mode: 'CGL' | 'LaTeX', shouldClear: boolean = false): Promise<{ success: boolean; diagnostics: string[]; error?: string }> => {
        try {
            if (!input.trim()) {
                throw new Error(`Please enter ${mode} data.`);
            }

            const brain = getBrain();
            let injectDiagnostics: string[] = [];
            let parseDiagnostics: string[] = [];

            if (mode === 'CGL') {
                const result = GraphCodec.parse(input);
                const graphData = result.graph;
                parseDiagnostics = result.diagnostics;

                // Inject the graph data
                injectDiagnostics = await brain.injectNodes(graphData, shouldClear);

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

                transactions.forEach(tx => brain.applyTransaction(tx, true, true));

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
        generateCGL,
        generateJSON,
        downloadFile,
        downloadCGL,
        copyToClipboard,
        consumeGraph
    };
}

'use client';

import { useCallback } from 'react';
import { Brain } from '../engine/Brain';
import { GraphCodec } from '../engine/GraphCodec';

/**
 * useMouth (The Tongue/Speech Organ)
 * Handles all outgoing data flows: Export, Sharing, and Downloading.
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

    return {
        generateCGL,
        generateJSON,
        downloadFile,
        downloadCGL,
        copyToClipboard
    };
}

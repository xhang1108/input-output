
import { InjectableGraph } from './types';
import { Parser } from '../iogl/Parser';
import { Encoder } from '../iogl/Encoder';

/**
 * GraphCodec 3.0
 * 
 * High-level API for encoding and decoding Input-Output Graph Language (IOGL) scripts.
 * Now modularized for maximum maintainability and strict 3.0 standard enforcement.
 */
export class GraphCodec {
    /**
     * Parses an IOGL 1.0 script into an InjectableGraph.
     * @param IOGL The IOGL script content.
     * @returns An object containing the graph and any diagnostics/errors.
     */
    public static parse(IOGL: string): { graph: InjectableGraph, diagnostics: string[] } {
        const parser = new Parser(IOGL);
        const result = parser.parse();
        return { 
            graph: result.graph, 
            diagnostics: result.diagnostics.map((d: any) => typeof d === 'string' ? d : d.message) 
        };
    }

    /**
     * Encodes an InjectableGraph into an IOGL 1.0 script.
     * @param graph The graph to encode.
     * @returns A string containing the IOGL 1.0 script.
     */
    public static encode(graph: InjectableGraph): string {
        return Encoder.encode(graph);
    }

    /**
     * Utility method for parsing individual literal values (numbers, booleans, strings).
     * Used by internal components and tests.
     */
    public static parseValue(valStr: string): unknown {
        const trimmed = valStr.trim();
        
        // Booleans
        if (trimmed.toLowerCase() === 'true') return true;
        if (trimmed.toLowerCase() === 'false') return false;

        // Numbers
        const num = parseFloat(trimmed);
        if (!isNaN(num) && String(num) === trimmed) return num;

        // Strings (strip quotes)
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed.slice(1, -1);
        }

        // JSON Fallback (for complex arrays/objects)
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || 
            (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
                return JSON.parse(trimmed);
            } catch (e) {
                return trimmed;
            }
        }

        return trimmed;
    }
}

import { Brain } from './Brain';
import { InjectableGraph } from './types';
import LZString from 'lz-string';

export interface ProjectData {
    version: string;
    mathPrecision: number;
    viewport: { x: number; y: number; zoom: number };
    settings: Record<string, unknown>;
    graph: InjectableGraph;
}

export class Serializer {
    public static readonly VERSION = '1.0.0';

    /**
     * Serializes the current graph, viewport, and settings into a compressed URL-safe string.
     */
    public static serialize(
        brain: Brain,
        viewport: { x: number; y: number; zoom: number },
        settings: Record<string, unknown>,
        mathPrecision: number = 64
    ): string {
        const data: ProjectData = {
            version: this.VERSION,
            mathPrecision,
            viewport,
            settings: this.cleanSettings(settings),
            graph: brain.toInjectable()
        };

        const jsonString = JSON.stringify(data);
        return LZString.compressToEncodedURIComponent(jsonString);
    }

    /**
     * Deserializes a compressed URL-safe string back into a ProjectData object.
     */
    public static deserialize(encoded: string): ProjectData | null {
        if (!encoded) return null;
        try {
            const jsonString = LZString.decompressFromEncodedURIComponent(encoded);
            if (!jsonString) return null;
            return JSON.parse(jsonString) as ProjectData;
        } catch (e) {
            console.error('[Serializer] Failed to deserialize data:', e);
            return null;
        }
    }

    private static cleanSettings(settings: Record<string, unknown>): Record<string, unknown> {
        // Strip out non-serializable or transient settings (like functions)
        const cleaned: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(settings)) {
            if (typeof value !== 'function' && key !== 'actionLog' && key !== 'saveStatus') {
                cleaned[key] = value;
            }
        }
        return cleaned;
    }
}

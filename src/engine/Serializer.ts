import { Brain } from './Brain';
import { InjectableGraph } from './types';
import LZString from 'lz-string';
import { GeometryUtils } from '../utils/GeometryUtils';

export interface ProjectData {
    version: string;
    mathPrecision: number;
    settings: Record<string, unknown>;
    graph: InjectableGraph;
}

export class Serializer {
    public static readonly VERSION = '1.1.0';

    /**
     * Serializes the current graph and settings into a compressed URL-safe string.
     */
    public static serialize(
        brain: Brain,
        settings: Record<string, unknown>,
        mathPrecision: number = 64
    ): string {
        return this.serializeData({
            version: this.VERSION,
            mathPrecision,
            settings: this.cleanSettings(settings),
            graph: brain.toInjectable()
        });
    }

    /**
     * Serializes a ProjectData object into a compressed URL-safe string.
     */
    public static serializeData(data: ProjectData): string {
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
            const data = JSON.parse(jsonString) as ProjectData;

            // ─── Coordinate Migration (Version 1.0.0 -> 1.1.0) ───
            // If the version is below 1.1.0, we assume positions are Center-based.
            // We need to migrate them to Top-Left ([0, 0]).
            const version = data.version || '1.0.0';
            if (this.isLegacyVersion(version, '1.1.0')) {
                console.log(`[Serializer] Migrating graph from ${version} to ${this.VERSION} (Coordinate Refactor)`);
                if (data.graph && data.graph.nodes) {
                    data.graph.nodes = data.graph.nodes.map(node => {
                        const measured = {
                            width: typeof node.data?.width === 'number' ? node.data.width : undefined,
                            height: typeof node.data?.height === 'number' ? node.data.height : undefined
                        };
                        const newPos = GeometryUtils.migratePosition(node.position, measured);
                        return { ...node, position: newPos };
                    });
                }
                data.version = this.VERSION;
            }

            return data;
        } catch (e) {
            console.error('[Serializer] Failed to deserialize data:', e);
            return null;
        }
    }

    private static isLegacyVersion(current: string, target: string): boolean {
        const c = current.split('.').map(Number);
        const t = target.split('.').map(Number);
        for (let i = 0; i < Math.max(c.length, t.length); i++) {
            const cv = c[i] || 0;
            const tv = t[i] || 0;
            if (cv < tv) return true;
            if (cv > tv) return false;
        }
        return false;
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

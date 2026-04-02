import LZString from 'lz-string';
import { ProjectData } from './types';

/**
 * ️ [V1.0] Master Serializer & Deserializer
 * 
 * Handles state persistence for the Input-Output platform.
 * Legacy migration logic has been removed as per V1.0 stabilization.
 */
export class Serializer {
    public static readonly VERSION = '1.0.0';

    /**
     * ️ [V1.0] Serializes the project data into a compressed URL-safe string.
     */
    public static serialize(data: ProjectData): string {
        try {
            // [V4.0] Lean Payload: Prune redundant metadata before storage
            const pruned = this.prune(data);
            return LZString.compressToEncodedURIComponent(JSON.stringify(pruned));
        } catch (e) {
            console.error('[Serializer] Failed to serialize data:', e);
            throw new Error('Serialization failed.');
        }
    }

    /**
     * ️ [v4.0] Strips redundant UI metadata, settings, and viewport info to keep saves lean.
     */
    public static prune(data: ProjectData | any): ProjectData {
        if (!data) return data;
        
        return {
            nodes: (data.nodes || []).map((n: any) => {
                // Prune internal React Flow state and local animation ticks
                const { 
                    handles, 
                    measured, 
                    selected, 
                    dragging, 
                    visualTick,
                    zIndex,
                    ...leanData 
                } = (n.data || {}) as any;

                return {
                    id: n.id,
                    type: n.type || 'io:val',
                    position: n.position,
                    data: leanData,
                    parentId: n.parentId,
                    width: n.width !== undefined ? Math.round(n.width) : undefined,
                    height: n.height !== undefined ? Math.round(n.height) : undefined
                };
            }),
            edges: (data.edges || []).map((e: any) => ({
                id: e.id,
                source: e.source,
                sourceHandle: e.sourceHandle || '',
                target: e.target,
                targetHandle: e.targetHandle || '',
                type: e.type
            })),
            version: data.version || this.VERSION,
            mathPrecision: data.mathPrecision || 64
            // Note: 'settings' and 'viewport' are intentionally omitted per V4.0 Lean Spec
        } as ProjectData;
    }

    /**
     * @deprecated Use Serializer.serialize() instead. [V1.0 Backward Compatibility]
     */
    public static serializeData(data: ProjectData): string {
        return this.serialize(data);
    }

    /**
     * ️ [V1.0] Deserializes a compressed string back into ProjectData.
     * No longer performs legacy migrations.
     */
    public static deserialize(encoded: string): ProjectData | null {
        if (!encoded) return null;
        try {
            const jsonString = LZString.decompressFromEncodedURIComponent(encoded);
            if (!jsonString) return null;

            const data = JSON.parse(jsonString) as ProjectData;
            return data;
        } catch (e) {
            console.error('[Serializer] Critical Error: Failed to parse graph data.', e);
            return null;
        }
    }
}

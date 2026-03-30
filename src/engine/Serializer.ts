import LZString from 'lz-string';
import { ProjectData } from './types';

/**
 * 🛡️ [V1.0] Master Serializer & Deserializer
 * 
 * Handles state persistence for the Input-Output platform.
 * Legacy migration logic has been removed as per V1.0 stabilization.
 */
export class Serializer {
    private static readonly VERSION = '1.0.0';

    /**
     * 🛡️ [V1.0] Serializes the project data into a compressed URL-safe string.
     */
    public static serialize(data: ProjectData): string {
        try {
            const payload = {
                ...data,
                version: this.VERSION,
                timestamp: Date.now()
            };
            return LZString.compressToEncodedURIComponent(JSON.stringify(payload));
        } catch (e) {
            console.error('[Serializer] Failed to serialize data:', e);
            throw new Error('Serialization failed.');
        }
    }

    /**
     * @deprecated Use Serializer.serialize() instead. [V1.0 Backward Compatibility]
     */
    public static serializeData(data: ProjectData): string {
        return this.serialize(data);
    }

    /**
     * 🛡️ [V1.0] Deserializes a compressed string back into ProjectData.
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

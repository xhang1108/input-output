import { nanoid } from 'nanoid';

/**
 * Generates a semantic ID for a node.
 * Rule #5: Semantic IDs (Nodes must have readable IDs like 'MathNode_x7z')
 * 
 * @param type The node type (e.g., 'MA-01', 'MathNode', 'IO-01')
 * @returns A string in the format `${Type}_${ShortHash}`
 */
export function generateNodeId(type: string): string {
    // Clean type string (remove spaces, special chars if any) but keep it readable
    const cleanType = type.replace(/[^a-zA-Z0-9-]/g, '');

    // Use first 8 chars of nanoid for ShortHash (collision resistant enough for client-side graph)
    const shortHash = nanoid(8);

    return `${cleanType}_${shortHash}`;
}

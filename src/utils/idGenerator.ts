import { customAlphabet } from 'nanoid';

// Custom alphabet: 23456789abcdefghjkmnpqrstuvwxyz
// Exclusions:
// - 0, O (Zero vs Uppercase O)
// - 1, I, l (One vs Uppercase I vs Lowercase L)
const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 8);

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

    // Use custom nanoid for ShortHash (collision resistant enough for client-side graph)
    const shortHash = nanoid();

    return `${cleanType}_${shortHash}`;
}

/**
 * Generates an ID for an edge.
 */
export function generateEdgeId(): string {
    return `e_${nanoid()}`;
}


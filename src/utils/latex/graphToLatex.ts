import { Node, Edge } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { SoulRenderer } from '../SoulRenderer';
import { PayloadUtils } from '../PayloadUtils';
import { DataType } from '../../types/payload';

/**
 * Converts the output of a specific node into a LaTeX string by leveraging
 * its fully evaluated AST (Symbol) from the Brain.
 */
export async function exportGraphToLatex(nodeId: string, _nodes: Node[], _edges: Edge[]): Promise<string> {
    const brain = Brain.getInstance();

    // Attempt to get the latest evaluated payload from the Brain
    const result = await brain.getValue(nodeId);

    if (result && result.type !== DataType.Error && result.symbol) {
        // We have a fully built AST (Soul) for this node! Render it perfectly.
        return SoulRenderer.render(result.symbol);
    }

    if (result && result.type !== DataType.Error && result.value !== undefined) {
        // Fallback to literal value if no symbol is attached
        return String(PayloadUtils.unwrap(result));
    }

    return '\\text{?}';
}

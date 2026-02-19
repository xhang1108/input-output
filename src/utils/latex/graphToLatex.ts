import { Node, Edge } from '@xyflow/react';

// Operator Precedence (Higher binds tighter)
const PRECEDENCE: Record<string, number> = {
    'POW': 4,
    'MUL': 3,
    'DIV': 3,
    'ADD': 2,
    'SUB': 2,
    'FUNC': 5, // sin, cos, etc.
    'ATOM': 6  // numbers, variables
};

/**
 * Converts a connected graph branch (ending at rootNodeId) into a LaTeX string.
 */
export function exportGraphToLatex(rootNodeId: string, nodes: Node[], edges: Edge[]): string {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const edgeMap = new Map<string, Edge[]>(); // TargetNodeId -> Edges[]

    // Index edges by target for fast lookup
    edges.forEach(e => {
        if (!edgeMap.has(e.target)) edgeMap.set(e.target, []);
        edgeMap.get(e.target)!.push(e);
    });

    const getPrecedence = (op: string): number => {
        return PRECEDENCE[op] || 0;
    };

    const buildTex = (nodeId: string): { tex: string, prec: number } => {
        const node = nodeMap.get(nodeId);
        if (!node) return { tex: '?', prec: 6 };

        // Handle Input Nodes
        if (node.type === 'IO-01' || node.type === 'MA-03') { // Number or Constant
            const label = node.data.label as string;
            return { tex: label || 'x', prec: 6 };
        }

        // Handle Math Nodes
        if (node.type === 'MA-01' || node.type === 'MA-16') {
            const op = (node.data.op as string) || 'ADD';

            // Find inputs
            const inputEdges = edgeMap.get(nodeId) || [];
            const inputs: Record<string, { tex: string, prec: number }> = {};
            inputEdges.forEach(e => {
                inputs[e.targetHandle || 'in'] = buildTex(e.source);
            });

            // Helper to wrap in parens if child precedence < current precedence
            // Or if equal and right-associative (like pow), or non-associative (sub/div).
            // For simplicity: Wrap if child < current. 
            // For sub/div (A - B), B needs parens if B has same precedence (A - (B-C)).
            const wrap = (child: { tex: string, prec: number }, currentOpPrec: number, isRight: boolean = false): string => {
                if (child.prec < currentOpPrec) return `\\left(${child.tex}\\right)`;
                if (child.prec === currentOpPrec && isRight && ['SUB', 'DIV', 'POW'].includes(op)) {
                    // Special cases for non-associative
                    // e.g. 2 - (3 - 4) -> Needs parens
                    // 2 ^ (3 ^ 4) -> Right associative? specialized.
                    return `\\left(${child.tex}\\right)`;
                }
                return child.tex;
            };

            const currentPrec = getPrecedence(op);

            if (op === 'ADD') {
                const a = inputs['in_a'] || { tex: 'a', prec: 6 };
                const b = inputs['in_b'] || { tex: 'b', prec: 6 };
                return { tex: `${wrap(a, currentPrec)} + ${wrap(b, currentPrec)}`, prec: currentPrec };
            }
            if (op === 'SUB') {
                const a = inputs['in_a'] || { tex: 'a', prec: 6 };
                const b = inputs['in_b'] || { tex: 'b', prec: 6 };
                return { tex: `${wrap(a, currentPrec)} - ${wrap(b, currentPrec, true)}`, prec: currentPrec };
            }
            if (op === 'MUL') {
                const a = inputs['in_a'] || { tex: 'a', prec: 6 };
                const b = inputs['in_b'] || { tex: 'b', prec: 6 };
                // Use dot or implicit? Let's use \cdot
                return { tex: `${wrap(a, currentPrec)} \\cdot ${wrap(b, currentPrec)}`, prec: currentPrec };
            }
            if (op === 'DIV') {
                const a = inputs['in_a'] || { tex: 'a', prec: 6 };
                const b = inputs['in_b'] || { tex: 'b', prec: 6 };
                // Frac always handles grouping visually, so precedence inside is loose? 
                // Actually \frac{a}{b} isolates them.
                return { tex: `\\frac{${a.tex}}{${b.tex}}`, prec: currentPrec };
            }
            if (op === 'POW') {
                const a = inputs['in_a'] || { tex: 'a', prec: 6 };
                const b = inputs['in_b'] || { tex: 'b', prec: 6 };
                return { tex: `${wrap(a, currentPrec)}^${b.tex}`, prec: currentPrec }; // Exponent usually self-contained or braced
            }
            if (op === 'SQRT') {
                const i = inputs['in'] || inputs['in_a'] || { tex: 'x', prec: 6 };
                return { tex: `\\sqrt{${i.tex}}`, prec: 6 }; // Functions act like atoms
            }
            if (['SIN', 'COS', 'TAN', 'LOG', 'LN', 'ABS'].includes(op)) {
                const i = inputs['in'] || inputs['in_a'] || { tex: 'x', prec: 6 };
                const funcName = op.toLowerCase();
                // ABS special
                if (op === 'ABS') return { tex: `\\left|${i.tex}\\right|`, prec: 6 };
                return { tex: `\\${funcName}\\left(${i.tex}\\right)`, prec: 6 };
            }
        }

        return { tex: node.data.label as string || '?', prec: 6 };
    };

    try {
        const result = buildTex(rootNodeId);
        return result.tex;
    } catch (e) {
        console.error('LaTeX Export Error:', e);
        return '\\text{Error}';
    }
}

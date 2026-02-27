import { ASTNode } from '../types/payload';

/**
 * 🎨 FormulaRenderer: Phase 3 Formula Generator
 * 
 * Converts a symbolic ASTNode into a LaTeX string.
 */
export class FormulaRenderer {
    public static render(node: ASTNode | null): string {
        if (!node) return '';

        switch (node.type) {
            case 'Literal':
                return this.renderLiteral(node.value);
            case 'Identifier':
                return node.name || this.renderLiteral(node.value);
            case 'BinaryExpression':
                return this.renderBinary(node.operator!, node.left!, node.right!);
            case 'UnaryExpression':
                return this.renderUnary(node.operator!, node.argument!);
            case 'FunctionCall':
                return this.renderFunction(node.name!, node.args || []);
            case 'TemplateLiteral':
                return this.renderTemplate(node.parts || []);
            default:
                return '';
        }
    }

    private static renderLiteral(val: any): string {
        if (typeof val === 'number') {
            // Future: Handle big numbers / precision
            return String(val);
        }
        return String(val);
    }

    private static renderBinary(op: string, left: ASTNode, right: ASTNode): string {
        const l = this.render(left);
        const r = this.render(right);

        switch (op) {
            case 'ADD': return `${l} + ${r}`;
            case 'SUB': return `${l} - ${r}`;
            case 'MUL': return `${l} \\cdot ${r}`;
            case 'DIV': return `\\frac{${l}}{${r}}`;
            case 'POW': return `{${l}}^{${r}}`;
            case 'EQ': return `${l} = ${r}`;
            default: return `${l} \\text{ ${op} } ${r}`;
        }
    }

    private static renderUnary(op: string, arg: ASTNode): string {
        const a = this.render(arg);
        switch (op) {
            case 'NEG': return `-${a}`;
            case 'SQRT': return `\\sqrt{${a}}`;
            default: return `${op}(${a})`;
        }
    }

    private static renderFunction(name: string, args: ASTNode[]): string {
        const renderedArgs = args.map(arg => this.render(arg));

        // Handle special LaTeX functions
        const lowerName = name.toLowerCase();
        if (lowerName === 'sqrt') return `\\sqrt{${renderedArgs[0]}}`;
        if (lowerName === 'sin') return `\\sin{${renderedArgs[0]}}`;
        if (lowerName === 'cos') return `\\cos{${renderedArgs[0]}}`;
        if (lowerName === 'tan') return `\\tan{${renderedArgs[0]}}`;
        if (lowerName === 'log') return `\\log{${renderedArgs[0]}}`;
        if (lowerName === 'ln') return `\\ln{${renderedArgs[0]}}`;

        // Calculus: If name already contains LaTeX commands (starts with \),
        // render it directly — don't wrap in \text{}
        if (name.startsWith('\\')) {
            return `${name}\\left(${renderedArgs.join(', ')}\\right)`;
        }

        return `\\text{${name}}(${renderedArgs.join(', ')})`;
    }

    private static renderTemplate(parts: (string | ASTNode)[]): string {
        return parts.map(part => {
            if (typeof part === 'string') {
                return `\\text{${part}}`;
            }
            return this.render(part);
        }).join('');
    }
}

import { ASTNode } from '../types/payload';

/**
 * FormulaRenderer: Phase 3 Formula Generator
 * 
 * Converts a symbolic ASTNode into a LaTeX string.
 */
export class FormulaRenderer {
    // Operator Precedence (Higher = Binds tighter)
    private static PRECEDENCE: Record<string, number> = {
        'OR': 10,
        'AND': 20,
        'EQ': 30, 'NEQ': 30, 'LT': 30, 'LTE': 30, 'GT': 30, 'GTE': 30,
        'ADD': 40, 'SUB': 40,
        'MUL': 50, 'DIV': 50,
        'NEG': 60,
        'POW': 70,
        'CALL': 80 // Function calls bind tightest
    };

    public static render(node: ASTNode | null, options: { expandSymbols?: boolean } = {}): string {
        if (!node) return '';

        switch (node.type) {
            case 'Literal':
                return this.renderLiteral(node.value);
            case 'Identifier':
                // Expand if requested and value exists
                if (options.expandSymbols && node.value !== undefined && node.value !== null) {
                    return this.renderLiteral(node.value);
                }
                return node.name || this.renderLiteral(node.value);
            case 'BinaryExpression':
                return this.renderBinary(node.operator!, node.left!, node.right!, options);
            case 'UnaryExpression':
                return this.renderUnary(node.operator!, node.argument!, options);
            case 'FunctionCall':
                return this.renderFunction(node, options);
            case 'TemplateLiteral':
                return this.renderTemplate(node.parts || [], options);
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

    private static renderBinary(op: string, left: ASTNode, right: ASTNode, options: { expandSymbols?: boolean }): string {
        const parentPrec = this.PRECEDENCE[op] || 0;

        const renderChild = (child: ASTNode) => {
            const childPrec = (child.type === 'BinaryExpression' || child.type === 'UnaryExpression')
                ? (this.PRECEDENCE[child.operator!] || 0)
                : (child.type === 'FunctionCall' ? this.PRECEDENCE['CALL'] : 100);

            let rendered = this.render(child, options);

            // Rule: If child precedence is strictly lower than parent, wrap in parens
            // Exception: DIV (Fractions) and POW (Superscript) have natural visual grouping
            if (childPrec < parentPrec && op !== 'DIV' && op !== 'POW') {
                return `\\left(${rendered}\\right)`;
            }
            return rendered;
        };

        const l = renderChild(left);
        const r = renderChild(right);

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

    private static renderUnary(op: string, arg: ASTNode, options: { expandSymbols?: boolean }): string {
        const a = this.render(arg, options);
        switch (op) {
            case 'NEG': return `-${a}`;
            case 'SQRT': return `\\sqrt{${a}}`;
            default: return `${op}(${a})`;
        }
    }

    private static renderFunction(node: ASTNode, options: { expandSymbols?: boolean }): string {
        const name = node.name!;
        const args = node.args || [];
        const renderedArgs = args.map(arg => this.render(arg, options));
        const lowerName = name.toLowerCase();

        // 1. Calculus Symbols
        if (lowerName === 'diff' || lowerName === 'derivative') {
            const variable = renderedArgs[1] || 'x';
            const expr = renderedArgs[0];
            return `\\frac{d}{d${variable}}\\left(${expr}\\right)`;
        }
        if (lowerName === 'int' || lowerName === 'integral') {
            const variable = renderedArgs[1] || 'x';
            const expr = renderedArgs[0];
            return `\\int ${expr} \\, d${variable}`;
        }

        // 2. Linear Algebra: Matrices & Determinants
        if (lowerName === 'mat' || lowerName === 'matrix') {
            return this.renderArrayAsMatrix(args[0], 'pmatrix', options);
        }
        if (lowerName === 'det' || lowerName === 'determinant') {
            if (args[0] && (args[0] as any).isMatrix) {
                return this.renderArrayAsMatrix(args[0], 'vmatrix', options);
            }
            return `\\det\\left(${renderedArgs[0]}\\right)`;
        }

        // 3. Trigonometry & Standard Functions
        if (lowerName === 'sqrt') return `\\sqrt{${renderedArgs[0]}}`;
        if (lowerName === 'sin') return `\\sin{${renderedArgs[0]}}`;
        if (lowerName === 'cos') return `\\cos{${renderedArgs[0]}}`;
        if (lowerName === 'tan') return `\\tan{${renderedArgs[0]}}`;
        if (lowerName === 'abs') return `\\left|${renderedArgs[0]}\\right|`;

        // 4. Advanced Math (Log/Ln/Round)
        if (lowerName === 'log') {
            const baseNode = node.meta?.base;
            if (baseNode) {
                const b = this.render(baseNode, options);
                return `\\log_{${b}}{${renderedArgs[0]}}`;
            }
            return `\\log{${renderedArgs[0]}}`;
        }
        if (lowerName === 'ln') return `\\ln{${renderedArgs[0]}}`;
        if (lowerName === 'round') return `\\text{round}(${renderedArgs.join(', ')})`;

        // 5. Custom LaTeX Commands
        if (name.startsWith('\\')) {
            return `${name}\\left(${renderedArgs.join(', ')}\\right)`;
        }

        return `\\text{${name}}(${renderedArgs.join(', ')})`;
    }

    private static renderArrayAsMatrix(node: ASTNode, env: 'pmatrix' | 'vmatrix', options: { expandSymbols?: boolean }): string {
        const val = node.value as any;
        if (!val || typeof val !== 'object') return this.render(node, options);

        let data: any[][] = [];
        if (Array.isArray(val)) {
            data = val;
        } else if (val.mathjs === 'Matrix' && Array.isArray(val.data)) {
            data = val.data;
        }

        if (data.length === 0) return this.render(node, options);

        const rows = data.map(row => {
            if (Array.isArray(row)) {
                return row.map(cell => this.renderLiteral(cell)).join(' & ');
            }
            return this.renderLiteral(row);
        });

        return `\\begin{${env}} ${rows.join(' \\\\ ')} \\end{${env}}`;
    }

    private static renderTemplate(parts: (string | ASTNode)[], options: { expandSymbols?: boolean }): string {
        return parts.map(part => {
            if (typeof part === 'string') {
                return `\\text{${part}}`;
            }
            return this.render(part, options);
        }).join('');
    }
}


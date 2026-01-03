import { MathNode } from 'mathjs';

export type Language = 'python' | 'javascript' | 'glsl';

/**
 * Generates code from a MathJS AST node.
 */
export function generateCode(ast: MathNode | undefined, language: Language = 'javascript'): string {
    if (!ast) return '';

    try {
        // We can use mathjs's own toString with a custom handler, 
        // or recursively traverse. MathJS has a limited toTex, but to code needs specific syntax.
        // Luckily, mathjs syntax is very close to JS/Python for basic ops.

        // Strategy: Recursively traverse and build string based on language rules.
        return recurse(ast, language);

    } catch (e) {
        console.error("Codegen failed", e);
        return `// Error generating code: ${e}`;
    }
}

function recurse(node: any, lang: Language): string {
    if (!node) return '';

    // 1. OperatorNode (e.g. +, *, /)
    if (node.isOperatorNode) {
        const args = node.args.map((arg: any) => recurse(arg, lang));

        switch (node.op) {
            case '+': return `(${args[0]} + ${args[1]})`;
            case '-': return `(${args[0]} - ${args[1]})`;
            case '*': return `(${args[0]} * ${args[1]})`;
            case '/': return `(${args[0]} / ${args[1]})`;
            case '^':
                if (lang === 'python') return `(${args[0]} ** ${args[1]})`;
                if (lang === 'javascript') return `Math.pow(${args[0]}, ${args[1]})`;
                if (lang === 'glsl') return `pow(${args[0]}, ${args[1]})`;
                return `(${args[0]} ^ ${args[1]})`;
            default: return `(${args[0]} ${node.op} ${args[1]})`;
        }
    }

    // 2. FunctionNode (e.g. sin, cos, max)
    if (node.isFunctionNode) {
        const args = node.args.map((arg: any) => recurse(arg, lang));
        const name = node.fn.name;

        // Map standard functions
        switch (name) {
            case 'sin':
            case 'cos':
            case 'tan':
            case 'asin':
            case 'acos':
            case 'atan':
            case 'sqrt':
            case 'exp':
            case 'floor':
            case 'ceil':
            case 'abs':
                if (lang === 'javascript') return `Math.${name}(${args.join(', ')})`;
                if (lang === 'python') return `math.${name}(${args.join(', ')})`;
                if (lang === 'glsl') return `${name}(${args.join(', ')})`;
                break;
            case 'log':
                if (lang === 'javascript') return `Math.log(${args.join(', ')})`; // Natural log by default
                if (lang === 'python') return `math.log(${args.join(', ')})`;
                if (lang === 'glsl') return `log(${args.join(', ')})`;
                break;
            default:
                return `${name}(${args.join(', ')})`;
        }
    }

    // 3. ConstantNode (Numbers)
    if (node.isConstantNode) {
        return node.value.toString();
    }

    // 4. SymbolNode (Variables)
    if (node.isSymbolNode) {
        return node.name;
    }

    // 5. ParenthesisNode
    if (node.isParenthesisNode) {
        return `(${recurse(node.content, lang)})`;
    }

    return node.toString();
}

/**
 * Returns a template wrapper for the generated expression
 */
export function generateFullScript(expression: string, lang: Language): string {
    switch (lang) {
        case 'python':
            return `import math\n\ndef calculate():\n    return ${expression}\n\nprint(calculate())`;
        case 'javascript':
            return `function calculate() {\n    return ${expression};\n}\n\nconsole.log(calculate());`;
        case 'glsl':
            return `float calculate() {\n    return ${expression};\n}`;
    }
    return expression;
}

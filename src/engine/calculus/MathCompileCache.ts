import { MathNode } from 'mathjs';

/**
 * 💡 MathCompileCache: Centralized String-to-Code Optimization
 * 
 * Compiling raw formula strings is computationally expensive in Mathjs.
 * Node evaluators are called frequently (up to 120fps during slide sweeps).
 * This global cache intercepts identical math expressions and returns pre-compiled
 * native executable Javascript objects. 
 */
export class MathCompileCache {
    /** 
     * Key: raw expression string
     * Value: Compiled Mathjs functional node
     */
    private static cache: Map<string, any> = new Map();

    /**
     * Retrieve the cached compiled function of an expression string.
     */
    public static getCompiled(exprText: string, mathInstance: any): any {
        if (!exprText) return null;

        if (this.cache.has(exprText)) {
            return this.cache.get(exprText);
        }

        // Safety guard: prevent memory leak from millions of generated random strings
        if (this.cache.size > 2000) {
            this.cache.clear();
        }

        try {
            const parsed = mathInstance.parse(exprText);
            const compiled = parsed.compile();
            this.cache.set(exprText, compiled);
            return compiled;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Syntactic sugar for getting and immediately evaluating an expression block.
     */
    public static evaluate(exprText: string, scope: Record<string, unknown>, mathInstance: any): unknown {
        const compiled = this.getCompiled(exprText, mathInstance);
        if (!compiled) return 0;
        return compiled.evaluate(scope);
    }
}

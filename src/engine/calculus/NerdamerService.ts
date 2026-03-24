import nerdamer from 'nerdamer';
import 'nerdamer/all';
import { create, all } from 'mathjs';
import { MATH_CONFIG } from '../mathConfig';

const math = create(all, { number: 'number' });

/**
 * 🧮 NerdamerService: Symbolic Math Engine Facade
 */

// LRU Cache implementation for compiled math functions
class LRUCache<K, V> {
    private capacity: number;
    private cache: Map<K, V>;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.cache = new Map();
    }

    get(key: K): V | undefined {
        if (!this.cache.has(key)) return undefined;
        // Move to end (most recently used)
        const value = this.cache.get(key)!;
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key: K, value: V): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            // Evict oldest (first entry)
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    get size(): number {
        return this.cache.size;
    }

    clear(): void {
        this.cache.clear();
    }
}

export class NerdamerService {
    private static instance: NerdamerService;
    private nerdamer: any;
    private compiledFnCache: LRUCache<string, Function>;

    private constructor() {
        // 💡 Fix: Use globalThis for safe universal scope access (Worker/Window/Node)
        const globalNerd = (globalThis as any).nerdamer;
        
        if (globalNerd) {
            this.nerdamer = globalNerd;
        } else {
            // Server-side / Node / Standard Bundled Client
            // 💡 Fix: Handle ESM default export vs CommonJS
            this.nerdamer = (nerdamer as any).default || nerdamer;
        }

        this.compiledFnCache = new LRUCache(256);
    }

    public static getInstance(): NerdamerService {
        if (!NerdamerService.instance) {
            NerdamerService.instance = new NerdamerService();
        }
        return NerdamerService.instance;
    }

    /**
     * 💡 Reset for Testing
     * Used to clear singleton state in test suites to prevent pollution.
     */
    public static reset() {
        NerdamerService.instance = new NerdamerService();
    }

    /** Raw nerdamer access for advanced operations */
    public getNerdamer(): any {
        return this.nerdamer;
    }

    // ─── Core Symbolic Operations ──────────────────────────────────

    /** Compute symbolic derivative: diff(expr, variable, order) */
    public differentiate(expr: string, variable: string, order: number = 1): any {
        let result = this.nerdamer(`(${expr})`);
        for (let i = 0; i < order; i++) {
            result = this.nerdamer(`diff(${result.text()}, ${variable})`);
        }
        return result;
    }

    /** Compute symbolic integral: integrate(expr, variable) */
    public integrate(expr: string, variable: string): any {
        return this.nerdamer(`integrate((${expr}), ${variable})`);
    }

    /** Compute definite integral: defint(expr, lower, upper, variable) */
    public definiteIntegral(expr: string, variable: string, lower: string | number, upper: string | number): any {
        // Standard Nerdamer syntax: defint(expression, from, to, variable)
        const cleanExpr = String(expr).trim();
        const cleanVar = String(variable).trim();
        const cmd = `defint((${cleanExpr}),${lower},${upper},${cleanVar})`;
        return this.nerdamer(cmd);
    }

    /** Compute symbolic limit */
    public limit(expr: string, variable: string, approach: string): any {
        return this.nerdamer(`limit((${expr}), ${variable}, ${approach})`);
    }

    // ─── AST-to-JS Compiler with LRU Cache ────────────────────────

    /**
     * Compile a symbolic expression to a callable JS function.
     * Uses LRU cache keyed by formula structure (not parameter values).
     *
     * @param expr - The symbolic expression string (e.g., "2*x + 3")
     * @param vars - Array of variable names (e.g., ["x"])
     * @returns A function that takes a scope object and returns a number
     */
    public compileToFunction(expr: string, vars: string[]): Function {
        // Cache key is the expression + variable list
        const cacheKey = `${expr}|${vars.sort().join(',')}`;

        const cached = this.compiledFnCache.get(cacheKey);
        if (cached) return cached;

        // Build the JS function from nerdamer expression
        try {
            const nExpr = this.nerdamer(expr);
            const textExpr = nExpr.text();

            // 💡 Use MathJS for robust evaluation (handles ^ and math functions natively)
            // Using 'number' mode for performance and compatibility with plotting.
            const compiled = math.compile(textExpr);
            const fn = (scope: any) => {
                try {
                    const res = compiled.evaluate(scope);
                    return Number(res);
                } catch {
                    return NaN;
                }
            };

            this.compiledFnCache.set(cacheKey, fn);
            return fn;
        } catch (e) {
            // Fallback: return a function that returns NaN
            const fallback = () => NaN;
            this.compiledFnCache.set(cacheKey, fallback);
            return fallback;
        }
    }

    // ─── Terminal-Only Simplification ──────────────────────────────

    /**
     * Simplify an expression ONLY for display purposes.
     * This should NEVER be called in the computation pipeline.
     * Only use at the UI output layer (ResultNode, LaTeX rendering).
     */
    public simplifyForDisplay(expr: string): string {
        try {
            return this.nerdamer(`simplify(${expr})`).text();
        } catch {
            return expr; // Return unsimplified on failure
        }
    }

    /** Convert expression to LaTeX for display */
    public toLatex(expr: string): string {
        try {
            return this.nerdamer(expr).toTeX();
        } catch {
            return expr;
        }
    }

    /** Evaluate a nerdamer expression to a numeric string */
    public evaluate(expr: string): string {
        try {
            return this.nerdamer(expr).text('decimals');
        } catch {
            return 'NaN';
        }
    }

    /** Extract variables from a nerdamer expression */
    public getVariables(expr: string): string[] {
        try {
            return this.nerdamer(expr).variables();
        } catch {
            return [];
        }
    }

    /** Get current cache size (for testing/debugging) */
    public getCacheSize(): number {
        return this.compiledFnCache.size;
    }

    /** Clear the compiled function cache */
    public clearCache(): void {
        this.compiledFnCache.clear();
    }
}

import { create, all } from 'mathjs';
import { InputOutputEngineInterface } from '@/engine/types/InputOutputEngineInterface';
import { MATH_CONFIG } from './mathConfig';
import { MATH_ALIASES } from './mathAliases';

export class InputOutputEngine implements InputOutputEngineInterface {
    private static instance: InputOutputEngine;
    private math: any;

    private constructor() {
        console.log('[InputOutputEngine] Constructor starting... [V2-FIXED]');
        try {
            // In a module worker, we strongly prefer the bundled 'mathjs' import
            // to ensure consistency and availability of BigNumber/Units.

            console.log('[InputOutputEngine] Creating local math instance with bundled all/create...');
            this.math = create(all, MATH_CONFIG);

            if (typeof this.math.bignumber !== 'function') {
                console.error('[InputOutputEngine] Created math instance is missing bignumber! Trying fallback...');
                // Emergency attempt if 'all' didn't include it for some reason
                this.math = create(all, MATH_CONFIG);
            }

            console.log('[InputOutputEngine] Math instance ready. bignumber check:', typeof this.math.bignumber);

            // Register First-Class Math Aliases
            // These are not "patches" but standard international/mathematical alternatives.
            const aliases: any = {};
            for (const [alias, primary] of Object.entries(MATH_ALIASES)) {
                if (typeof this.math[primary] === 'function') {
                    aliases[alias] = this.math[primary];
                }
            }

            this.math.import(aliases, { override: true });
            console.log(`[InputOutputEngine] Registered ${Object.keys(aliases).length} math aliases.`);
        } catch (error) {
            console.error('[InputOutputEngine] Initialization failed CRITICALLY:', error);
            // Last resort: try to create without config
            try { this.math = create(all); } catch { this.math = {}; }
        }
    }

    public static getInstance(): InputOutputEngine {
        if (!InputOutputEngine.instance) {
            InputOutputEngine.instance = new InputOutputEngine();
        }
        return InputOutputEngine.instance;
    }

    /**
     * Reset for Testing
     * Used to clear singleton state in test suites to prevent pollution.
     */
    public static reset() {
        InputOutputEngine.instance = new InputOutputEngine();
    }

    public getMathInstance(): any {
        return this.math;
    }

    public async getMathInstanceAsync(): Promise<any> {
        return this.math;
    }

    public evaluate(op: string, ...args: unknown[]): unknown {
        const m = this.math;
        const fnMap: Record<string, string> = {
            'ADD': 'add', 'SUB': 'subtract', 'MUL': 'multiply', 'DIV': 'divide',
            'SIN': 'sin', 'COS': 'cos', 'TAN': 'tan', 'LOG': 'log', 'SQRT': 'sqrt', 'POW': 'pow'
        };
        const fn = fnMap[op];
        if (fn && typeof m[fn] === 'function') {
            return m[fn](...args);
        }
        throw new Error(`Unknown operation: ${op}`);
    }

    public processInput(val: unknown, unit?: string): unknown {
        if (unit) {
            try {
                // NEW: Lazy Unit Registration
                // If mathjs doesn't know this unit, try to create it as a base unit
                // to allow it to participate in basic arithmetic and formatting.
                try {
                    this.math.unit(unit);
                } catch {
                    // Only register if it looks like a valid identifier (no spaces/weird chars)
                    if (/^[a-zA-Z][a-zA-Z0-9_/]*$/.test(unit)) {
                        console.log(`[InputOutputEngine] Registering custom unit: ${unit}`);
                        this.math.createUnit(unit);
                    }
                }

                return this.math.unit(val as any, unit);
            } catch (e) {
                // console.warn(`[InputOutputEngine] Failed to create/register unit ${val} ${unit}`, e);
                return val;
            }
        }
        return val;
    }

    public convertUnit(val: number, fromUnit: string, toUnit: string): number {
        try {
            return this.math.unit(val, fromUnit).to(toUnit).toNumber(toUnit);
        } catch (e: any) {
            const msg = e.message || '';
            // If mathjs knows both units but they are incompatible (e.g. m to kg)
            if (msg.includes('Units do not match') || msg.includes('Unexpected type')) {
                throw e;
            }
            // Otherwise it's likely an unknown unit (like 'apple'), so just relay
            return val;
        }
    }
}


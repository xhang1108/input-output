import { create, all } from 'mathjs';
import { InputOutputEngineInterface } from './interfaces/InputOutputEngineInterface';
import { MATH_CONFIG } from './mathConfig';

export class InputOutputEngine implements InputOutputEngineInterface {
    private static instance: InputOutputEngine;
    private math: any;

    private constructor() {
        console.log('[InputOutputEngine] Constructor starting... [V2-FIXED]');
        try {
            // 💡 In a module worker, we strongly prefer the bundled 'mathjs' import
            // to ensure consistency and availability of BigNumber/Units.
            
            console.log('[InputOutputEngine] Creating local math instance with bundled all/create...');
            this.math = create(all, MATH_CONFIG);
            
            if (typeof this.math.bignumber !== 'function') {
                console.error('[InputOutputEngine] Created math instance is missing bignumber! Trying fallback...');
                // Emergency attempt if 'all' didn't include it for some reason
                this.math = create(all, MATH_CONFIG);
            }

            console.log('[InputOutputEngine] Math instance ready. bignumber check:', typeof this.math.bignumber);
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
     * 💡 Reset for Testing
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
                return this.math.unit(val as any, unit);
            } catch (e) {
                console.warn(`[InputOutputEngine] Failed to create unit ${val} ${unit}`, e);
                return val;
            }
        }
        return val;
    }

    public convertUnit(val: number, fromUnit: string, toUnit: string): number {
        return this.math.unit(val, fromUnit).to(toUnit).toNumber(toUnit);
    }
}

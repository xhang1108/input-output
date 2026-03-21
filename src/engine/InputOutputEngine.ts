// Phase 4.1: Externalize mathjs to CDN for client-side to bypass build timeouts
// We no longer statically import mathjs to prevent it from being bundled.
import { InputOutputEngineInterface } from './interfaces/InputOutputEngineInterface';
import { MATH_CONFIG } from './mathConfig';

export class InputOutputEngine implements InputOutputEngineInterface {
    private static instance: InputOutputEngine;
    private math: any;

    private constructor() {
        // Phase 4.1: Externalize mathjs to CDN for client-side to bypass build timeouts
        if (typeof window !== 'undefined' && (window as any).math) {
            this.math = (window as any).math;
        } else {
            // Server-side / Build-time: Use eval('require') to hide from bundler
            // This ensures mathjs is never scanned during client-side bundling
            const m = eval('require')('mathjs');
            this.math = m.create(m.all, MATH_CONFIG);
        }
    }

    public static getInstance(): InputOutputEngine {
        if (!InputOutputEngine.instance) {
            InputOutputEngine.instance = new InputOutputEngine();
        }
        return InputOutputEngine.instance;
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

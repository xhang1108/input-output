import {
    create,
    all,
} from 'mathjs';
import { IMathEngine } from './interfaces/IMathEngine';

export class MathEngine implements IMathEngine {
    private static instance: MathEngine;
    private math: any;

    private constructor() {
        // Correct initialization for mathjs factory functions
        this.math = create(all, {
            number: 'BigNumber',
            precision: 64
        });
    }

    public static getInstance(): MathEngine {
        if (!MathEngine.instance) {
            MathEngine.instance = new MathEngine();
        }
        return MathEngine.instance;
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
                console.warn(`[MathEngine] Failed to create unit ${val} ${unit}`, e);
                return val;
            }
        }
        return val;
    }

    public convertUnit(val: number, fromUnit: string, toUnit: string): number {
        return this.math.unit(val, fromUnit).to(toUnit).toNumber(toUnit);
    }
}

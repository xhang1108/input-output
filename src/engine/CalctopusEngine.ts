import {
    create,
    all,
} from 'mathjs';
import { CalctopusEngineInterface } from './interfaces/CalctopusEngineInterface';
import { MATH_CONFIG } from './mathConfig';

export class CalctopusEngine implements CalctopusEngineInterface {
    private static instance: CalctopusEngine;
    private math: any;

    private constructor() {
        // Use shared MATH_CONFIG to guarantee parity with Web Worker
        this.math = create(all, MATH_CONFIG);
    }

    public static getInstance(): CalctopusEngine {
        if (!CalctopusEngine.instance) {
            CalctopusEngine.instance = new CalctopusEngine();
        }
        return CalctopusEngine.instance;
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
                console.warn(`[CalctopusEngine] Failed to create unit ${val} ${unit}`, e);
                return val;
            }
        }
        return val;
    }

    public convertUnit(val: number, fromUnit: string, toUnit: string): number {
        return this.math.unit(val, fromUnit).to(toUnit).toNumber(toUnit);
    }
}

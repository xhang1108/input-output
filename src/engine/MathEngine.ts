import {
    create,
    addDependencies,
    subtractDependencies,
    multiplyDependencies,
    divideDependencies,
    bignumberDependencies,
    numberDependencies,
    sinDependencies,
    cosDependencies,
    tanDependencies,
    logDependencies,
    sqrtDependencies,
    powDependencies,
    piDependencies,
    eDependencies,
    MathJsStatic
} from 'mathjs';
import { ComputationMode } from './types';
import { IMathEngine } from './interfaces/IMathEngine';

export class MathEngine implements IMathEngine {
    private static instance: MathEngine;
    private math: MathJsStatic;
    private mode: ComputationMode = 'scientific'; // Default

    private constructor() {
        // Rule #3: Tree Shaking
        // We import specific dependencies to construct the math instance.
        this.math = create({
            addDependencies,
            subtractDependencies,
            multiplyDependencies,
            divideDependencies,
            bignumberDependencies,
            numberDependencies,
            sinDependencies,
            cosDependencies,
            tanDependencies,
            logDependencies,
            sqrtDependencies,
            powDependencies,
            piDependencies,
            eDependencies
        }, {
            number: 'BigNumber', // Default to high precision
            precision: 64
        }) as MathJsStatic;
    }

    public static getInstance(): MathEngine {
        if (!MathEngine.instance) {
            MathEngine.instance = new MathEngine();
        }
        return MathEngine.instance;
    }

    public setMode(mode: ComputationMode) {
        this.mode = mode;
        console.log(`[MathEngine] Mode set to ${mode}`);
    }

    public evaluate(op: string, ...args: any[]): any {
        try {
            switch (op) {
                case 'ADD': return this.math.add(args[0], args[1]);
                case 'SUB': return this.math.subtract(args[0], args[1]);
                case 'MUL': return this.math.multiply(args[0], args[1]);
                case 'DIV': return this.math.divide(args[0], args[1]);
                case 'SIN': return this.math.sin(args[0]);
                case 'COS': return this.math.cos(args[0]);
                case 'TAN': return this.math.tan(args[0]);
                case 'LOG': return this.math.log(args[0]);
                case 'SQRT': return this.math.sqrt(args[0]);
                case 'POW': return this.math.pow(args[0], args[1]);
                default:
                    throw new Error(`Unknown operation: ${op}`);
            }
        } catch (e: any) {
            console.error(`[MathEngine] Error evaluating ${op}:`, e);
            return 0; // Error fallback
        }
    }

    public processInput(val: any): any {
        if (this.mode === 'scientific') {
            return this.math.bignumber(val);
        } else {
            return this.math.number(val);
        }
    }
}

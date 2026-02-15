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
    phiDependencies,
    unitDependencies, // Added for Phase 2.4
    randomDependencies, // Added for Random Node
    randomIntDependencies, // Explicitly added for randomInt
    matrixDependencies,
    onesDependencies,
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
            eDependencies,
            phiDependencies,
            unitDependencies, // Added for Phase 2.4
            randomDependencies, // Added for Random Node
            randomIntDependencies, // Explicitly added for randomInt
            matrixDependencies,
            onesDependencies
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

    public getMathInstance(): MathJsStatic {
        return this.math;
    }

    public setMode(mode: ComputationMode) {
        this.mode = mode;
        console.log(`[MathEngine] Mode set to ${mode}`);
    }

    public getComputationMode(): ComputationMode {
        return this.mode;
    }

    public evaluate(op: string, ...args: any[]): any {
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
    }

    public processInput(val: any, unit?: string): any {
        if (unit) {
            // If unit is present, create a Unit object
            // e.g. math.unit(5, 'cm')
            // Note: BigNumber + Unit support in mathjs might be tricky.
            // Let's try flexible parsing.
            try {
                // math.unit(value, unit) might work if value is number/BigNumber
                return this.math.unit(val, unit);
            } catch (e) {
                console.warn(`[MathEngine] Failed to create unit ${val} ${unit}`, e);
                return this.processInput(val); // Fallback to scalar
            }
        }

        if (this.mode === 'scientific') {
            return this.math.bignumber(val);
        } else {
            return this.math.number(val);
        }
    }

    public convertUnit(val: number, fromUnit: string, toUnit: string): number {
        // e.g. math.unit(100, 'cm').to('m').toNumber('m') -> 1
        return this.math.unit(val, fromUnit).to(toUnit).toNumber(toUnit);
    }
}

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
    unitDependencies,
    randomDependencies,
    randomIntDependencies,
    matrixDependencies,
    onesDependencies,
    largerDependencies,
    smallerDependencies,
    largerEqDependencies,
    smallerEqDependencies,
    equalDependencies,
    unequalDependencies,
    gcdDependencies,
    lcmDependencies,
    modDependencies,
    isPrimeDependencies,
    MathJsStatic
} from 'mathjs';
import { ComputationMode } from './types';
import { IMathEngine } from './interfaces/IMathEngine';

export class MathEngine implements IMathEngine {
    private static instance: MathEngine;
    private math: MathJsStatic;
    // Mode removed: Always Scientific (BigNumber)

    private constructor() {
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
            unitDependencies,
            randomDependencies,
            randomIntDependencies,
            matrixDependencies,
            onesDependencies,
            largerDependencies,
            smallerDependencies,
            largerEqDependencies,
            smallerEqDependencies,
            equalDependencies,
            unequalDependencies,
            gcdDependencies,
            lcmDependencies,
            modDependencies,
            isPrimeDependencies
        }, {
            number: 'BigNumber',
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

    public async getMathInstanceAsync(): Promise<MathJsStatic> {
        return this.math;
    }

    // Mode methods removed

    public evaluate(op: string, ...args: unknown[]): unknown {
        const m = this.math as unknown as Record<string, (...args: unknown[]) => unknown>;
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
        const v = val as number | string;
        if (unit) {
            try {
                const mathWithUnit = this.math as MathJsStatic & { unit: (v: number | string, u: string) => unknown };
                return mathWithUnit.unit(v, unit);
            } catch (e) {
                console.warn(`[MathEngine] Failed to create unit ${val} ${unit}`, e);
                return this.processInput(val);
            }
        }

        // Always promote to BigNumber for precision
        const mathWithBN = this.math as MathJsStatic & { bignumber: (v: number | string) => unknown };
        return mathWithBN.bignumber(v);
    }

    public convertUnit(val: number, fromUnit: string, toUnit: string): number {
        return this.math.unit(val, fromUnit).to(toUnit).toNumber(toUnit);
    }
}

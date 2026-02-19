import { ComputationMode } from '../types';

export interface IMathEngine {
    evaluate(op: string, ...args: unknown[]): unknown;
    processInput(val: unknown, unit?: string): unknown;
    getMathInstance(): unknown;
    convertUnit(val: number, fromUnit: string, toUnit: string): number;
    getComputationMode?(): string; // Optional or removed, but let's clean it up fully.
}

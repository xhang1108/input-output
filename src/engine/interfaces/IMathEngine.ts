import { ComputationMode } from '../types';

export interface IMathEngine {
    setMode(mode: ComputationMode): void;
    evaluate(op: string, ...args: any[]): any;
    processInput(val: any): any;
}

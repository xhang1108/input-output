

export interface InputOutputEngineInterface {
    evaluate(op: string, ...args: unknown[]): unknown;
    processInput(val: unknown, unit?: string): unknown;
    getMathInstance(): unknown;
    convertUnit(val: number, fromUnit: string, toUnit: string): number;
}


import * as math from 'mathjs';

export const checkIsMatrix = (val: any): boolean => {
    return val && (val.isMatrix || Array.isArray(val) || (typeof val === 'object' && val !== null && val.mathjs));
};

export const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '—';

    // 1. Matrix/Array Summary
    const isMatrix = checkIsMatrix(val);
    if (isMatrix) {
        const cleanVal = val.toArray ? val.toArray() : val;
        if (Array.isArray(cleanVal)) {
            if (Array.isArray(cleanVal[0])) {
                return `${cleanVal.length}×${cleanVal[0].length}`;
            }
            return `[${cleanVal.length}]`;
        }
        return 'Matrix';
    }

    // 2. Number Formatting
    if (typeof val === 'number') {
        const formatted = math.format(val, { precision: 14, lowerExp: -12, upperExp: 15 });
        return /^-?\d+\.?\d*$/.test(formatted)
            ? Number(formatted).toLocaleString('en-US', { maximumFractionDigits: 10 })
            : formatted;
    }

    // 3. String/Other
    return String(val);
};

export const normalizeMatrixData = (val: any): any[] | null => {
    if (!checkIsMatrix(val)) return null;
    return val.toArray ? val.toArray() : val;
};

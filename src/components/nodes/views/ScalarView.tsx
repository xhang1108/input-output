import React from 'react';
import { DisplayUtils } from '../../../utils/DisplayUtils';
import { UnitAlgebra } from '../../../utils/UnitAlgebra';

interface ScalarViewProps {
    rawValue: unknown;
    precision: number;
    unitStr?: string;
    dataTypeColor: string;
    isError: boolean;
}

export const ScalarView: React.FC<ScalarViewProps> = ({ rawValue, precision, unitStr, dataTypeColor, isError }) => {
    let displayString = DisplayUtils.formatValue(rawValue, precision);
    let displayValue: React.ReactNode = displayString;

    // Handle units and bases
    const finalUnit = unitStr;
    const isBaseUnit = finalUnit && ['BIN', 'OCT', 'HEX', 'DUO', 'DEC'].includes(finalUnit);
    const numValue = typeof rawValue === 'number' ? rawValue : (typeof rawValue === 'string' && !isNaN(Number(rawValue)) ? Number(rawValue) : null);

    if (isBaseUnit && numValue !== null) {
        let formatted = '';
        let prefix = '';
        switch (finalUnit) {
            case 'BIN': formatted = Math.abs(numValue).toString(2); prefix = '0b'; break;
            case 'OCT': formatted = Math.abs(numValue).toString(8); prefix = '0o'; break;
            case 'HEX': formatted = Math.abs(numValue).toString(16).toUpperCase(); prefix = '0x'; break;
            case 'DUO': formatted = toBase12(Math.abs(numValue)); prefix = '0z'; break;
            default: formatted = Math.abs(numValue).toString(10);
        }
        if (numValue < 0) prefix = '-' + prefix;
        const combined = `${prefix}${formatted}`;
        displayValue = (
            <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-1.5 leading-none">
                    <span className={`font-mono transition-all duration-200 text-2xl text-(--color-scalar)`}>{combined}</span>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-1 rounded-sm">{finalUnit}</span>
                </div>
            </div>
        );
    } else if (finalUnit) {
        const unitSuffix = UnitAlgebra.prettify(finalUnit);
        displayValue = (
            <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-1.5 leading-none">
                    <span className={`font-mono transition-all duration-200 text-2xl ${dataTypeColor}`}>{displayString}</span>
                    <span className="text-xs font-bold text-zinc-500 italic">{unitSuffix}</span>
                </div>
            </div>
        );
    } else {
        displayValue = displayString;
    }

    return (
        <div className={`font-mono break-all whitespace-pre-wrap ${isError ? 'text-red-500 text-sm' : `text-2xl ${dataTypeColor}`}`}>
            {displayValue}
        </div>
    );
};

function toBase12(num: number): string {
    const integerPart = Math.floor(num);
    const fractionalPart = num - integerPart;
    let result = integerPart.toString(12).toUpperCase();
    if (fractionalPart > 0) {
        result += '.';
        let f = fractionalPart;
        for (let i = 0; i < 4; i++) {
            f *= 12;
            const digit = Math.floor(f);
            result += digit.toString(12).toUpperCase();
            f -= digit;
            if (f === 0) break;
        }
    }
    return result;
}

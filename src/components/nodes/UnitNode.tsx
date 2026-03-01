import { memo, useCallback, useState, useEffect } from 'react';
import { BaseNode } from './BaseNode';
import { NodeProps } from '@xyflow/react';
import { Brain } from '../../engine/Brain';
import { InputOutputEngine } from '../../engine/InputOutputEngine';

const UNITS = [
    // Length
    'm', 'cm', 'mm', 'km', 'ft', 'in',
    // Mass
    'kg', 'g', 'lb',
    // Time
    's', 'min', 'h',
    // Physics
    'N', 'J', 'W', 'Pa', 'V', 'A', 'C', 'degC', 'degF',
    // Common Compounds
    'm/s', 'km/h', 'm/s^2', 'N*m'
];

export const UnitNode = memo((props: NodeProps) => {
    const { id, data } = props;
    const initialUnit = data.unit as string || 'm';

    const [mode, setMode] = useState<'select' | 'custom'>(
        UNITS.includes(initialUnit) ? 'select' : 'custom'
    );
    const [localUnit, setLocalUnit] = useState(initialUnit);
    const [isValid, setIsValid] = useState(true);

    // Sync local state with remote data
    useEffect(() => {
        if (data.unit && data.unit !== localUnit) {
            setLocalUnit(data.unit as string);
            setIsValid(true);
            // Auto-switch to custom if loaded data is a custom unit
            if (!UNITS.includes(data.unit as string)) {
                setMode('custom');
            }
        }
    }, [data.unit]);

    const validateAndApply = (unit: string) => {
        const math = InputOutputEngine.getInstance().getMathInstance();
        try {
            math.unit(unit);
            setIsValid(true);
            Brain.getInstance().applyTransaction({
                type: 'UPDATE_NODE_DATA',
                payload: { id, data: { unit } }
            });
        } catch (e) {
            setIsValid(false);
        }
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        if (value === 'CUSTOM_ENTRY') {
            setMode('custom');
        } else {
            setLocalUnit(value);
            validateAndApply(value);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocalUnit(value);
        validateAndApply(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') validateAndApply(localUnit);
    };

    const toggleMode = () => setMode(mode === 'select' ? 'custom' : 'select');

    return (
        <BaseNode {...props}>
            <div className="flex flex-col gap-2 p-1">
                <div className="flex items-center justify-center">
                    <div className={`relative group flex items-center bg-zinc-900 border ${isValid ? 'border-zinc-700/50' : 'border-red-500/50'
                        } rounded-md px-1 py-0.5 transition-all duration-200`}>

                        {mode === 'select' ? (
                            <div className="flex items-center">
                                <select
                                    className="nodrag bg-transparent text-zinc-100 text-[11px] px-1 py-0.5 outline-none min-w-[70px] appearance-none cursor-pointer"
                                    value={UNITS.includes(localUnit) ? localUnit : 'CUSTOM_ENTRY'}
                                    onChange={handleSelectChange}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    {UNITS.map(u => (
                                        <option key={u} value={u} className="bg-zinc-800">{u}</option>
                                    ))}
                                    <option value="CUSTOM_ENTRY" className="bg-zinc-800 text-blue-400 font-bold">Custom...</option>
                                </select>
                                <div className="text-zinc-600 ml-0.5 pointer-events-none pr-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m6 9 6 6 6-6" />
                                    </svg>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center">
                                <button
                                    onClick={toggleMode}
                                    className="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    title="Back to predefined list"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10 18H5V13M19 13V18H14M5 11V6H10M14 6V11H19" />
                                    </svg>
                                </button>
                                <input
                                    autoFocus
                                    className="nodrag bg-transparent text-zinc-100 text-[11px] px-1 py-0.5 outline-none w-20 text-center font-mono placeholder:text-zinc-600"
                                    value={localUnit}
                                    onChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="e.g. m/s"
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}

                        {/* Floating Identification */}
                        {!isValid ? (
                            <div className="absolute -top-3.5 left-0 right-0 text-[8px] text-red-500 text-center font-bold animate-pulse uppercase">
                                Invalid
                            </div>
                        ) : mode === 'custom' && (
                            <div className="absolute -top-3.5 left-0 right-0 text-[8px] text-blue-400/60 text-center font-bold uppercase">
                                Manual Entry
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </BaseNode>
    );
});
UnitNode.displayName = 'UnitNode';

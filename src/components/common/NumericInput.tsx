import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * NumericInput (Shared)
 * 
 * A standardized numeric input component that handles:
 * - Leading Minus Support (Typing '-', '.', '-.')
 * - Keyboard Controls (ArrowUp/Down) with Shift (x10) and Alt (x0.1) modifiers.
 * - Auto-select on Focus.
 * - Precision guarding (toFixed(10)).
 */
interface NumericInputProps {
    value: number;
    onChange: (val: number) => void;
    label?: string;
    className?: string;
    inputClassName?: string;
    placeholder?: string;
    inputMode?: 'decimal' | 'numeric';
    /** Optional precision for keyboard adjustment rounding */
    precision?: number;
    /** Whether to hide the label */
    hideLabel?: boolean;
    /** Optional focus callback */
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    /** Optional blur callback */
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const NumericInput = ({
    value,
    onChange,
    label,
    className = "",
    inputClassName = "",
    placeholder = "0.0",
    inputMode = "decimal",
    precision = 10,
    hideLabel = false,
    onFocus,
    onBlur
}: NumericInputProps) => {
    const [localStr, setLocalStr] = useState(String(value ?? 0));
    const isFocused = useRef(false);

    // Sync local string with prop value when not focused
    useEffect(() => {
        if (!isFocused.current) {
            setLocalStr(String(value ?? 0));
        }
    }, [value]);

    const handleChange = (val: string) => {
        setLocalStr(val);
        
        const isLeadingToken = val === '-' || val === '.' || val === '-.' || val === '+';
        if (isLeadingToken || val === '') return;

        const num = parseFloat(val);
        if (!isNaN(num)) {
            onChange(num);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const currentVal = parseFloat(localStr) || 0;
            const direction = e.key === 'ArrowUp' ? 1 : -1;
            const stepMultiplier = e.shiftKey ? 10 : (e.altKey ? 0.1 : 1);
            const nextVal = parseFloat((currentVal + direction * stepMultiplier).toFixed(precision));
            
            setLocalStr(String(nextVal));
            onChange(nextVal);
        } else {
            e.stopPropagation();
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        isFocused.current = true;
        e.currentTarget.select();
        onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        isFocused.current = false;
        // Snap back to a clean string representation of the actual value
        setLocalStr(String(value ?? 0));
        onBlur?.(e);
    };

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {!hideLabel && label && (
                <label className="text-[9px] text-zinc-500 uppercase font-black tracking-widest pl-0.5">
                    {label}
                </label>
            )}
            <input
                type="text"
                inputMode={inputMode}
                className={`bg-black/40 border border-zinc-800 rounded px-1.5 py-1 text-xs text-zinc-100 nodrag outline-none focus:border-focus/50 transition-colors font-mono ${inputClassName}`}
                value={localStr}
                placeholder={placeholder}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPointerDown={(e) => e.stopPropagation()}
            />
        </div>
    );
};

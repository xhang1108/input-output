import React, { useState, useEffect, useRef, forwardRef } from 'react';

/**
 * StringInput (Shared)
 * 
 * A standardized text input component that handles:
 * - Single-line (input) and Multi-line (textarea) modes.
 * - Monospace vs Sans font styles.
 * - Auto-select on Focus.
 * - Common standardized styling (borders, backgrounds, focus states).
 * - Keyboard behavior (Escape, Enter, stopPropagation).
 */
interface StringInputProps {
    value: string;
    onChange: (val: string) => void;
    label?: string;
    hideLabel?: boolean;
    layout?: 'vertical' | 'horizontal';
    multiline?: boolean;
    monospace?: boolean;
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    autoSelect?: boolean;
    onFocus?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    minHeight?: string | number;
    variant?: 'standard' | 'ghost';
    autoFocus?: boolean;
    rows?: number;
}

export const StringInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, StringInputProps>(({
    value,
    onChange,
    label,
    hideLabel = false,
    layout = 'vertical',
    multiline = false,
    monospace = false,
    placeholder = "Type here...",
    className = "",
    inputClassName = "",
    autoSelect = true,
    variant = 'standard',
    onFocus,
    onBlur,
    onKeyDown,
    minHeight,
    autoFocus = false,
    rows
}, ref) => {
    const [localStr, setLocalStr] = useState(value || '');
    const isFocused = useRef(false);

    // Sync local string with prop value when not focused
    useEffect(() => {
        if (!isFocused.current) {
            setLocalStr(value || '');
        }
    }, [value]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        isFocused.current = true;
        if (autoSelect) {
            e.currentTarget.select();
        }
        onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        isFocused.current = false;
        onBlur?.(e);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // Standardize escaping and submission
        if (e.key === 'Escape') {
            e.currentTarget.blur();
        } else if (e.key === 'Enter' && !multiline) {
            e.currentTarget.blur();
        }

        // Prevent React Flow from dragging while typing
        e.stopPropagation();
        onKeyDown?.(e);
    };

    const isHorizontal = layout === 'horizontal' && !hideLabel;
    
    const variantClasses = variant === 'ghost' 
        ? 'bg-transparent border-none p-0' 
        : 'border border-zinc-700 rounded-md px-2 py-1 focus:border-focus/50';

    const commonClasses = `${variantClasses} text-xs text-zinc-100 nodrag outline-none transition-colors ${monospace ? 'font-mono' : ''} ${inputClassName}`;
    const inlineStyle = { 
        background: variant === 'standard' ? 'var(--node-bg)' : undefined, 
        minHeight: multiline ? minHeight : undefined 
    };

    return (
        <div className={`flex ${isHorizontal ? 'flex-row items-center gap-2' : 'flex-col gap-1'} ${className}`}>
            {!hideLabel && label && (
                <label className={`text-[9px] text-zinc-500 uppercase font-black tracking-widest ${isHorizontal ? 'whitespace-nowrap shrink-0' : 'text-center w-full'}`}>
                    {label}
                </label>
            )}
            {multiline ? (
                <textarea
                    ref={ref as React.Ref<HTMLTextAreaElement>}
                    className={`${commonClasses} resize-none`}
                    style={inlineStyle}
                    value={localStr}
                    rows={rows}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={(e) => {
                        setLocalStr(e.target.value);
                        onChange(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    onPointerDown={(e) => e.stopPropagation()}
                />
            ) : (
                <input
                    ref={ref as React.Ref<HTMLInputElement>}
                    type="text"
                    className={commonClasses}
                    style={inlineStyle}
                    value={localStr}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={(e) => {
                        setLocalStr(e.target.value);
                        onChange(e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    onPointerDown={(e) => e.stopPropagation()}
                />
            )}
        </div>
    );
});

StringInput.displayName = 'StringInput';

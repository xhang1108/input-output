'use client';

import { ReactNode } from 'react';

interface NodeHeaderProps {
    label: string;
    icon?: ReactNode;
    badge?: string | number;
    badgeColor?: string;
    symbolInput?: {
        value: string;
        onChange: (val: string) => void;
        placeholder?: string;
        title?: string;
    };
    editableLabel?: {
        value: string;
        onChange: (val: string) => void;
        placeholder?: string;
    };
    className?: string;
    textColor?: string;
}

export const NodeHeader = ({
    label,
    icon,
    badge,
    badgeColor = 'text-indigo-500',
    symbolInput,
    editableLabel,
    className = '',
    textColor = 'text-zinc-400'
}: NodeHeaderProps) => {
    return (
        <div className={`flex items-center justify-between mb-2 w-full ${className}`}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {icon && <div className="shrink-0">{icon}</div>}

                {editableLabel ? (
                    <input
                        className={`text-[10px] font-bold uppercase tracking-wider bg-transparent border-none p-0 focus:ring-0 w-full placeholder-zinc-300 ${textColor}`}
                        value={editableLabel.value}
                        onChange={(e) => editableLabel.onChange(e.target.value)}
                        placeholder={editableLabel.placeholder || label}
                        onKeyDown={(e) => e.stopPropagation()}
                        autoFocus={false}
                    />
                ) : (
                    <span className={`text-[10px] font-bold uppercase tracking-wider truncate ${textColor}`}>
                        {label}
                    </span>
                )}
                {badge !== undefined && (
                    <span className={`text-[10px] font-bold bg-zinc-50 px-1 rounded ${badgeColor}`}>
                        {badge}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2">
                {symbolInput && (
                    <input
                        className="w-8 text-[10px] bg-zinc-100 border-none rounded text-center text-purple-600 font-bold focus:ring-1 focus:ring-purple-400 placeholder-zinc-300"
                        placeholder={symbolInput.placeholder || 'var'}
                        value={symbolInput.value}
                        onChange={(e) => symbolInput.onChange(e.target.value)}
                        title={symbolInput.title || 'Variable Name'}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                )}
            </div>
        </div>
    );
};

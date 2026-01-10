'use client';

import { ReactNode } from 'react';

interface NodeHeaderProps {
    label: string;
    icon?: ReactNode;
    statusIndicator?: 'success' | 'warning' | 'error' | 'neutral';
    statusCustomColor?: string;
    badge?: string | number;
    badgeColor?: string;
    symbolInput?: {
        value: string;
        onChange: (val: string) => void;
        placeholder?: string;
        title?: string;
    };
    className?: string;
    textColor?: string;
}

export const NodeHeader = ({
    label,
    icon,
    statusIndicator,
    statusCustomColor,
    badge,
    badgeColor = 'text-indigo-500',
    symbolInput,
    className = '',
    textColor = 'text-zinc-400'
}: NodeHeaderProps) => {
    return (
        <div className={`flex items-center justify-between mb-2 w-full ${className}`}>
            <div className="flex items-center gap-2">
                {icon && <div className="shrink-0">{icon}</div>}
                <span className={`text-[10px] font-bold uppercase tracking-wider ${textColor}`}>
                    {label}
                </span>
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
                {statusIndicator && (
                    <div className={`w-2.5 h-2.5 rounded-full shadow-sm transition-colors duration-300 ${statusIndicator === 'success' ? 'bg-green-500' :
                        statusIndicator === 'error' ? 'bg-red-500' :
                            statusIndicator === 'warning' ? 'bg-yellow-500' :
                                'bg-zinc-300'
                        }`} style={statusCustomColor ? { backgroundColor: statusCustomColor } : undefined} />
                )}
            </div>
        </div>
    );
};

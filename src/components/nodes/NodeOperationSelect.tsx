'use client';

import { memo } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface Operation {
    value: string;
    label: string;
}

interface NodeOperationSelectProps {
    value: string;
    options: Operation[];
    onValueChange: (value: string) => void;
    className?: string;
    triggerClassName?: string;
    valueClassName?: (val: string) => string; // Optional function for per-value classes
    colorTheme?: 'orange' | 'indigo' | 'teal' | 'purple';
    variant?: 'default' | 'centered' | 'hero';
}

const themes = {
    orange: {
        trigger: "text-orange-700 bg-orange-50 border-orange-100 focus:bg-orange-100",
        item: "text-orange-700 focus:bg-orange-50",
    },
    indigo: {
        trigger: "text-indigo-700 bg-indigo-50 border-indigo-100 focus:bg-indigo-100",
        item: "text-indigo-700 focus:bg-indigo-50",
    },
    teal: {
        trigger: "text-teal-700 bg-teal-50 border-teal-100 focus:bg-teal-100",
        item: "text-teal-700 focus:bg-teal-50",
    },
    purple: {
        trigger: "text-purple-700 bg-purple-50 border-purple-100 focus:bg-purple-100",
        item: "text-purple-700 focus:bg-purple-50",
    }
};

export const NodeOperationSelect = memo(({
    value,
    options,
    onValueChange,
    className,
    triggerClassName,
    valueClassName,
    colorTheme = 'indigo',
    variant = 'default'
}: NodeOperationSelectProps) => {
    const theme = themes[colorTheme];

    const variantTriggerClasses = variant === 'centered'
        ? "justify-center relative w-20 px-2 [&>svg]:absolute [&>svg]:right-1"
        : variant === 'hero'
            ? "w-16 h-16 text-4xl font-black rounded-2xl [&>svg]:hidden p-0"
            : "";

    const variantValueClasses = variant === 'centered'
        ? "flex justify-center items-center"
        : variant === 'hero'
            ? "flex justify-center items-center relative"
            : "";

    return (
        <div className={cn("nodrag", className)}>
            <Select value={value} onValueChange={onValueChange}>
                <SelectTrigger className={cn(
                    "h-7 text-xs font-bold justify-center px-0", // Center and remove default padding
                    theme.trigger,
                    variantTriggerClasses,
                    triggerClassName
                )}>
                    <div className={cn("relative leading-none flex items-center justify-center w-full h-full", variantValueClasses, valueClassName?.(value))}>
                        <SelectValue />
                    </div>
                </SelectTrigger>
                <SelectContent className="bg-white border-zinc-200">
                    {options.map((opt) => (
                        <SelectItem
                            key={opt.value}
                            value={opt.value}
                            className={cn("text-xs font-bold", theme.item)}
                        >
                            {opt.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
});

NodeOperationSelect.displayName = 'NodeOperationSelect';

"use client";

import React from 'react';

interface DynamicSectionHeaderProps {
    id: string;
    title: string;
    level?: number;
}

export const DynamicSectionHeader: React.FC<DynamicSectionHeaderProps> = ({ id, title, level = 2 }) => {
    // Instead of H2/H3 tags that carry browser baseline baggage, 
    // we use a clean div/span structure for absolute geometric control.
    // We still keep the ID on the main container for linking.
    
    // DIFFERENTIATE H2 AND H3
    const isH2 = level === 2;
    const height = isH2 ? "h-[24px]" : "h-[22px]";
    const padding = isH2 ? "px-3" : "px-2.5";
    const tracking = isH2 ? "tracking-[0.12em]" : "tracking-[0.08em]";
    const fontSize = isH2 ? "text-[12px]" : "text-[11px]";
    const bgOpacity = isH2 ? "bg-(--color-primary)/20" : "bg-zinc-700/60";
    const borderOpacity = isH2 ? "border-(--color-primary)/30" : "border-white/10";

    return (
        <div id={id} className={`group relative ${isH2 ? 'mt-12' : 'mt-8'} mb-0 flex flex-col items-start not-prose scroll-mt-24`}>
            {/* THE CAPSULE HEADER CONTAINER */}
            <div className={`relative flex items-center justify-center ${height} ${padding} min-w-[80px]`}>
                {/* BACKDROP CAPSULE */}
                <div className={`absolute inset-0 ${bgOpacity} border ${borderOpacity} rounded-[4px] backdrop-blur-sm pointer-events-none`} />
                
                {/* THE TEXT - Force clean baseline alignment */}
                <span 
                    className={`relative block ${isH2 ? 'text-(--color-primary)' : 'text-(--color-secondary)'} font-black uppercase ${tracking} ${fontSize} select-text`}
                    style={{ 
                        fontFamily: "'Inter', sans-serif",
                        fontWeight: 900,
                        lineHeight: '1',     /* Force line height to match font size */
                        display: 'block',    /* Block for precise height control */
                        paddingTop: isH2 ? '1px' : '0.5px' /* Optical correction */
                    }}
                >
                    {title}
                </span>

            </div>
        </div>
    );
};

"use client";

import React from 'react';

interface WikiDemoCanvasProps {
    children: React.ReactNode;
    height?: number;
}

/**
 * A strongly isolated wrapper for ReactFlow instances inside the Wiki.
 * 
 * Tailwind's `prose` typography plugin aggressively cascades font sizes (em/rem)
 * and margins down to all descendants. Even with `not-prose`, many inherited
 * properties bleed through and cause ReactFlow nodes to calculate incorrect,
 * bloated bounding boxes.
 * 
 * This component acts as a physical CSS firewall, forcibly resetting all text
 * sizing, line heights, and margins to native UI application scale (10px base),
 * ensuring nodes look exactly identical to the main workspace.
 */
export const WikiDemoCanvas: React.FC<WikiDemoCanvasProps> = ({ children, height = 160 }) => {
    return (
        <div 
            className="not-prose relative mt-2 mb-8 w-full overflow-hidden transition-[height] duration-300 ease-in-out bg-transparent! border-none! shadow-none!" 
            style={{ 
                height: `${height}px`,
            }}
        >
            {/* ROOT REM SCALING ISOLATION */}
            <div 
                className="absolute inset-0 z-10 react-flow-sandbox bg-transparent! border-none! shadow-none!" 
                style={{ 
                    fontSize: '16px', 
                    lineHeight: '1.5',
                    letterSpacing: 'normal',
                    color: 'white'
                }}
            >
                {children}
            </div>
        </div>
    );
};

import { memo, useCallback } from 'react';

interface AbacusRodProps {
    value: number; // 0-9
    onChange: (delta: number) => void;
}

export const AbacusRod = memo(({ value, onChange }: AbacusRodProps) => {

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
        if (e.deltaY < 0) {
            onChange(1);
        } else if (e.deltaY > 0) {
            onChange(-1);
        }
    }, [onChange]);

    // Top bead (value 5)
    const isTopBeadDown = value >= 5;

    // Bottom beads (value 1 eeach)
    const bottomValue = value % 5;

    return (
        <div
            className="relative w-6 h-[116px] flex flex-col items-center cursor-ns-resize nodrag nowheel nopan"
            onWheel={handleWheel}
        >
            {/* The physical rod - Minimalist Line */}
            <div className="absolute top-0 bottom-0 w-[2px] bg-zinc-800 border-r border-zinc-700/20 z-0" />

            {/* Top section (1 bead) */}
            <div className="relative w-full h-8 flex flex-col items-center pt-0.5 z-10">
                <Bead
                    isTop={true}
                    isActive={isTopBeadDown}
                    onClick={() => onChange(isTopBeadDown ? -5 : 5)}
                    travelDistance={16}
                />
            </div>

            {/* Beam separator space */}
            <div className="h-2 w-full shrink-0" />

            {/* Bottom section (4 beads) */}
            <div className="relative w-full h-[74px] flex flex-col items-center justify-end pb-0.5 gap-0.5 z-10">
                {[1, 2, 3, 4].map((beadVal) => {
                    const isActive = bottomValue >= beadVal;
                    const handleClick = () => {
                        const newValue = isTopBeadDown ? 5 + (isActive ? beadVal - 1 : beadVal) : (isActive ? beadVal - 1 : beadVal);
                        onChange(newValue - value); // Send the delta
                    };

                    return (
                        <Bead
                            key={beadVal}
                            isTop={false}
                            isActive={isActive}
                            onClick={handleClick}
                            beadIndex={beadVal}
                            travelDistance={16}
                        />
                    );
                })}
            </div>
        </div>
    );
});

AbacusRod.displayName = 'AbacusRod';

// --- Inner Component: Bead ---

interface BeadProps {
    isTop: boolean;
    isActive: boolean;
    onClick: () => void;
    beadIndex?: number; // 1-4 for bottom beads
    travelDistance: number;
}

const Bead = memo(({ isActive, onClick, isTop, travelDistance }: BeadProps) => {
    // Movement logic (天珠往下 travelDistance, 地珠往上 travelDistance)
    const translateY = isTop
        ? (isActive ? `${travelDistance}px` : '0px')
        : (isActive ? `-${travelDistance}px` : '0px');

    return (
        <div
            className={`
                w-[22px] h-[12px] cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] 
                relative nodrag nowheel nopan border-t border-b overflow-hidden
                ${isActive
                    ? 'bg-orange-600 border-t-orange-400 border-b-orange-850'
                    : 'bg-zinc-800 border-t-zinc-700 border-b-zinc-950'}
            `}
            style={{
                transform: `translateY(${translateY})`,
                borderRadius: '3px'
            }}
            onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
        >
            {/* Minimal line highlight for edge lighting */}
            <div className={`absolute top-0 left-0 right-0 h-px ${isActive ? 'bg-white/20' : 'bg-white/5'}`} />
        </div>
    );
});

Bead.displayName = 'Bead';

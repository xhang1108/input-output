import { useState, useCallback } from 'react';
import { type XYPosition } from '@xyflow/react';

export function useKnifeTool(keys: any, eyes: any, hands: any, screenToFlowPosition: (p: XYPosition) => XYPosition) {
    const [knifePath, setKnifePath] = useState<XYPosition[]>([]);
    const [isCutting, setIsCutting] = useState(false);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (keys.ctrl && e.button === 2) {
            setIsCutting(true);
            setKnifePath([{ x: e.clientX, y: e.clientY }]);
        }
    }, [keys.ctrl]);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isCutting) return;
        setKnifePath(prev => [...prev, { x: e.clientX, y: e.clientY }]);
    }, [isCutting]);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
        if (!isCutting) return;
        if (knifePath.length > 1) {
            const flowPath = knifePath.map(p => screenToFlowPosition(p));
            const victims = eyes.seeCuts(flowPath);
            if (victims.length > 0) {
                hands.sever(victims);
            }
        }
        setIsCutting(false);
        setKnifePath([]);
    }, [isCutting, knifePath, hands, eyes, screenToFlowPosition]);

    return {
        isCutting,
        knifePath,
        onMouseDown,
        onMouseMove,
        onMouseUp,
    };
}

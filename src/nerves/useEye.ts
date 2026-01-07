import { useCallback, useMemo } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';

export const useEye = () => {
    const { fitView } = useReactFlow();

    // Focus on specific nodes or the whole graph if empty
    const focus = useCallback((nodes: Node[] = []) => {
        if (nodes.length > 0) {
            fitView({ nodes, duration: 800, padding: 0.2 });
        } else {
            // If no nodes specified, fit everything
            fitView({ duration: 800, padding: 0.2 });
        }
    }, [fitView]);

    const eyes = useMemo(() => ({
        focus
    }), [focus]);

    return {
        eyes
    };
};

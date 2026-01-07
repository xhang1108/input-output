import { useState, useCallback, useMemo } from 'react';
import { type Node, type Edge, useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

interface HistorySnapshot {
    nodes: Node[];
    edges: Edge[];
}

export const useMemory = () => {
    const { setNodes, setEdges, getNodes, getEdges } = useReactFlow();
    const { triggerLogicUpdate } = useAppStore();

    const [past, setPast] = useState<HistorySnapshot[]>([]);
    const [future, setFuture] = useState<HistorySnapshot[]>([]);

    // Take a snapshot of the CURRENT state and push it to 'past'
    // Should be called BEFORE an action changes the state, or AFTER?
    // Standard Undo: Push CURRENT state to Past. Then do action. 
    // If we undo, we restore the top of Past.
    const remember = useCallback(() => {
        const currentSnapshot: HistorySnapshot = {
            nodes: getNodes(),
            edges: getEdges()
        };

        setPast(prev => [...prev, currentSnapshot]);
        setFuture([]); // New timeline branch, clear future

        // Console log for debug
        console.log('Brain remembered state.', currentSnapshot.nodes.length, 'nodes');
    }, [getNodes, getEdges]);

    const undo = useCallback(() => {
        setPast(prevPast => {
            if (prevPast.length === 0) {
                // toast.info('Nothing to undo');
                return prevPast;
            }

            const newPast = [...prevPast];
            const snapshotToRestore = newPast.pop();

            if (!snapshotToRestore) return prevPast;

            // Before restoring, save CURRENT state to Future so we can Redo
            const currentSnapshot: HistorySnapshot = {
                nodes: getNodes(),
                edges: getEdges()
            };

            setFuture(prevFuture => [currentSnapshot, ...prevFuture]);

            // Restore
            setNodes(snapshotToRestore.nodes);
            setEdges(snapshotToRestore.edges);
            triggerLogicUpdate();

            toast.success('Undid last action');

            return newPast;
        });
    }, [getNodes, getEdges, setNodes, setEdges, triggerLogicUpdate]);

    const redo = useCallback(() => {
        setFuture(prevFuture => {
            if (prevFuture.length === 0) {
                // toast.info('Nothing to redo');
                return prevFuture;
            }

            const newFuture = [...prevFuture];
            const snapshotToRestore = newFuture.shift(); // Take from front (stack top)

            if (!snapshotToRestore) return prevFuture;

            // Before restoring, save CURRENT state to Past
            const currentSnapshot: HistorySnapshot = {
                nodes: getNodes(),
                edges: getEdges()
            };

            setPast(prevPast => [...prevPast, currentSnapshot]);

            // Restore
            setNodes(snapshotToRestore.nodes);
            setEdges(snapshotToRestore.edges);
            triggerLogicUpdate();

            toast.success('Redid action');

            return newFuture;
        });
    }, [getNodes, getEdges, setNodes, setEdges, triggerLogicUpdate]);

    const memories = useMemo(() => ({
        remember,
        undo,
        redo,
        canUndo: past.length > 0,
        canRedo: future.length > 0
    }), [remember, undo, redo, past.length, future.length]);

    return {
        memories
    };
};

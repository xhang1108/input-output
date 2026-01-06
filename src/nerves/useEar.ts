import { useEffect, useRef, useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { toast } from 'sonner';

/**
 * useEar (Sensory Nerve)
 * 
 * Responsibility: Listens to the outside world (Keyboard interactions, Mouse position).
 * It triggers the 'Hands' to perform actions based on what it hears.
 */

interface Eyes {
    focus: (nodes?: any[]) => void;
}

interface Hands {
    grabAll: () => void;
    discard: () => void;
    copy: () => void;
    cut: () => void;
    paste: (position: { x: number; y: number }) => any[] | undefined;
    duplicate: (position: { x: number; y: number }) => any[] | undefined;
}

interface UseEarProps {
    hands: Hands;
    eyes: Eyes;
    memories: any;
    setNodes: any;
    onOpenMenu: (position: { x: number; y: number }) => void;
}

export const useEar = ({ hands, eyes, memories, setNodes, onOpenMenu }: UseEarProps) => {
    const { screenToFlowPosition, getNodes } = useReactFlow();
    const mousePosRef = useRef({ x: 0, y: 0 });

    // --- Mouse Tracking ---
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // --- Placement / Grab Logic ---
    const [placingNodeIds, setPlacingNodeIds] = useState<Set<string> | null>(null);
    const placementRef = useRef<{
        startMousePos: { x: number, y: number },
        nodeOffsets: Record<string, { x: number, y: number }>
    } | null>(null);

    // --- Placement Helper ---
    const startPlacing = (nodeIds: string[]) => {
        if (!nodeIds || nodeIds.length === 0) return;

        const currentNodes = getNodes();
        const nodesToMove = currentNodes.filter(n => nodeIds.includes(n.id));

        if (nodesToMove.length === 0) return;

        // Select the new nodes
        setNodes((nds: any[]) => nds.map(node => ({
            ...node,
            selected: nodeIds.includes(node.id)
        })));

        // Capture initial offsets
        const nodeOffsets: Record<string, { x: number, y: number }> = {};
        nodesToMove.forEach(node => {
            nodeOffsets[node.id] = { x: node.position.x, y: node.position.y };
        });

        setPlacingNodeIds(new Set(nodeIds));
        placementRef.current = {
            startMousePos: mousePosRef.current,
            nodeOffsets: nodeOffsets
        };
    };

    // --- Keyboard Listening ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Escape: Blur Input
            if (e.code === 'Escape') {
                if (document.activeElement instanceof HTMLElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                    document.activeElement.blur();
                    e.preventDefault();
                    return;
                }
            }

            // Global Ignore for Inputs
            if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                return;
            }

            // Shift + A: Open Add Menu
            if (e.shiftKey && e.code === 'KeyA') {
                e.preventDefault();
                onOpenMenu(mousePosRef.current);
                return;
            }

            // A: Select All -> Grab All
            if (e.code === 'KeyA' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                hands.grabAll();
                return;
            }

            // Period (.): Focus Selected
            if (e.key === '.' || e.code === 'Period') {
                e.preventDefault();
                const selected = getNodes().filter(n => n.selected);
                eyes.focus(selected);
                return;
            }

            // Delete / Backspace / X
            if ((e.code === 'KeyX' && !e.ctrlKey) || e.code === 'Delete' || e.code === 'Backspace') {
                e.preventDefault();
                hands.discard();
                return;
            }

            // Ctrl + C: Copy
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
                e.preventDefault();
                hands.copy();
                return;
            }

            // Ctrl + X: Cut
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
                e.preventDefault();
                hands.cut();
                return;
            }

            // Ctrl + V: Paste
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
                e.preventDefault();
                const newNodes = hands.paste(mousePosRef.current);
                if (newNodes) startPlacing(newNodes);
                return;
            }

            // Shift + D: Duplicate
            if (e.shiftKey && e.code === 'KeyD') {
                e.preventDefault();
                const newNodes = hands.duplicate(mousePosRef.current);
                if (newNodes) startPlacing(newNodes);
                return;
            }

            // Ctrl + Z: Undo
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                memories.undo();
                return;
            }

            // Ctrl + Shift + Z OR Ctrl + Y: Redo
            if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') ||
                ((e.ctrlKey || e.metaKey) && e.code === 'KeyY')) {
                e.preventDefault();
                memories.redo();
                return;
            }

            // G: Grab
            if (e.code === 'KeyG') {
                e.preventDefault();
                const currentNodes = getNodes();
                let targetNodes = currentNodes.filter(n => n.selected);

                // Hover Fallback
                if (targetNodes.length === 0) {
                    const mouseFlowPos = screenToFlowPosition({ x: mousePosRef.current.x, y: mousePosRef.current.y });
                    for (let i = currentNodes.length - 1; i >= 0; i--) {
                        const n = currentNodes[i];
                        const w = n.measured?.width ?? n.width ?? 200;
                        const h = n.measured?.height ?? n.height ?? 50;
                        if (mouseFlowPos.x >= n.position.x && mouseFlowPos.x <= n.position.x + w &&
                            mouseFlowPos.y >= n.position.y && mouseFlowPos.y <= n.position.y + h) {
                            targetNodes = [{ ...n, selected: true }];
                            // Optimization: No need to set selected state in global store for temporary grab unless clicked
                            // But for simplicity, let's select it
                            setNodes((nds: any[]) => nds.map(node => node.id === n.id ? { ...node, selected: true } : node));
                            break;
                        }
                    }
                }

                if (targetNodes.length > 0) {
                    startPlacing(targetNodes.map(n => n.id));
                    toast.success('Grabbed');
                }
            }
            return;
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hands, eyes, getNodes, setNodes, screenToFlowPosition, onOpenMenu, startPlacing]);


    // --- Placement Movement Effect (The "Hand" acting on "Ear" input) ---
    useEffect(() => {
        if (!placingNodeIds) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!placementRef.current) return;

            const currentFlowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            const startFlowPos = screenToFlowPosition(placementRef.current.startMousePos);

            const dx = currentFlowPos.x - startFlowPos.x;
            const dy = currentFlowPos.y - startFlowPos.y;

            setNodes((nds: any[]) => nds.map(n => {
                if (placingNodeIds.has(n.id)) {
                    const originalPos = placementRef.current!.nodeOffsets[n.id];
                    if (originalPos) {
                        return {
                            ...n,
                            position: {
                                x: originalPos.x + dx,
                                y: originalPos.y + dy
                            }
                        };
                    }
                }
                return n;
            }));
        };

        const handleMouseDown = (e: MouseEvent) => {
            // Commit placement
            e.stopPropagation();
            e.preventDefault();
            setPlacingNodeIds(null);
            placementRef.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);

        // Safety: Delay attaching mousedown to prevent instant drops if event is leaking
        const timer = setTimeout(() => {
            window.addEventListener('mousedown', handleMouseDown, { capture: true });
        }, 100);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown, { capture: true });
            clearTimeout(timer);
        };
    }, [placingNodeIds, screenToFlowPosition, setNodes]);

    return {
        mousePosition: mousePosRef.current
    };
};

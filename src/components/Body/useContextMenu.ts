import { useState, useCallback, useEffect, useRef } from 'react';
import { type XYPosition, addEdge, type Node as FlowNode } from '@xyflow/react';
import { nanoid } from 'nanoid';

export function useContextMenu(
    menuPosition: XYPosition | null,
    setMenuPosition: (pos: XYPosition | null) => void,
    screenToFlowPosition: (p: XYPosition) => XYPosition,
    setNodes: (nds: any) => void,
    setEdges: (eds: any) => void,
    getNodes: () => FlowNode[],
    triggerLogicUpdate: () => void,
    onConnectBase: (params: any) => void,
    onReconnectStartBase: () => void,
    onReconnectEndBase: (event: MouseEvent | TouchEvent, edge: any) => void
) {
    const [pendingConnection, setPendingConnection] = useState<{ source: string; sourceHandle: string | null } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // --- Connection/Menu Logic Refs ---
    const connectionStartRef = useRef<{ nodeId: string | null; handleId: string | null; handleType: string | null } | null>(null);
    const justConnectedRef = useRef(false);
    const isReconnectingRef = useRef(false);

    // --- Wrapped Connection Handlers ---
    const onConnect = useCallback((params: any) => {
        justConnectedRef.current = true;
        onConnectBase(params);
    }, [onConnectBase]);

    const onConnectStart = useCallback((_: any, params: any) => {
        justConnectedRef.current = false;
        // Only track for menu if we are NOT in a reconnection process
        if (!isReconnectingRef.current) {
            connectionStartRef.current = params;
        }
    }, []);

    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
        // 1. If we just successfully connected, suppress menu
        if (justConnectedRef.current) {
            justConnectedRef.current = false;
            connectionStartRef.current = null;
            return;
        }

        // 2. If we were reconnecting (moving existing line), suppress menu
        if (isReconnectingRef.current) {
            return;
        }

        // 3. Otherwise, if it was a valid source drag into space, open menu
        const startParams = connectionStartRef.current;
        if (startParams && startParams.handleType === 'source') {
            const clientX = (event instanceof TouchEvent) ? event.changedTouches[0]?.clientX : event.clientX;
            const clientY = (event instanceof TouchEvent) ? event.changedTouches[0]?.clientY : event.clientY;

            if (clientX !== undefined && clientY !== undefined) {
                setMenuPosition({ x: clientX, y: clientY });
                setPendingConnection({
                    source: startParams.nodeId!,
                    sourceHandle: startParams.handleId
                });
            }
        }
        connectionStartRef.current = null;
    }, [setMenuPosition]);

    const onReconnectStart = useCallback(() => {
        isReconnectingRef.current = true;
        onReconnectStartBase();
    }, [onReconnectStartBase]);

    const onReconnectEnd = useCallback((event: MouseEvent | TouchEvent, edge: any) => {
        isReconnectingRef.current = false;
        onReconnectEndBase(event, edge);
    }, [onReconnectEndBase]);

    const closeMenu = useCallback(() => setMenuPosition(null), [setMenuPosition]);

    const handleClickOutside = useCallback((e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
            closeMenu();
        }
    }, [closeMenu]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') closeMenu();
    }, [closeMenu]);

    useEffect(() => {
        if (menuPosition) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [menuPosition, handleClickOutside, handleKeyDown]);

    const [adjustedPosition, setAdjustedPosition] = useState<XYPosition | null>(null);

    // Effect to adjust menu position when menuPosition is set
    useEffect(() => {
        if (!menuPosition) {
            setAdjustedPosition(null);
            return;
        }

        // We use a small timeout to let the menu render so we can measure it
        // but it's better to do it immediately if possible or use a safer approach.
        // For now, let's just use the ref in the next tick.
        const timer = setTimeout(() => {
            if (menuRef.current) {
                const { offsetWidth, offsetHeight } = menuRef.current;
                const { innerWidth, innerHeight } = window;

                let x = menuPosition.x;
                let y = menuPosition.y;

                if (x + offsetWidth > innerWidth) {
                    x = innerWidth - offsetWidth - 10; // 10px padding
                }
                if (y + offsetHeight > innerHeight) {
                    y = innerHeight - offsetHeight - 10;
                }

                setAdjustedPosition({ x, y });
            } else {
                // Fallback if ref not ready
                setAdjustedPosition(menuPosition);
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [menuPosition]);

    const addNodeAtCursor = useCallback((type: string) => {
        if (!menuPosition) return;

        const position = screenToFlowPosition({ x: menuPosition.x, y: menuPosition.y });
        const id = nanoid(8);
        const newNode: FlowNode = {
            id,
            type,
            position,
            data: type === 'inputNode' ? { label: 'Value', value: 0 }
                : type === 'mathNode' ? { operation: 'add' }
                    : type === 'unaryNode' ? { operation: 'sqrt' }
                        : type === 'solverNode' ? { targetVar: 'x' }
                            : { value: 0 }
        };

        if (pendingConnection) {
            let targetHandle = 'inputA';
            const sourceNode = getNodes().find(n => n.id === pendingConnection.source);
            const isFormula = sourceNode?.type !== 'inputNode';

            setEdges((eds: any) => addEdge({
                id: nanoid(6),
                source: pendingConnection.source,
                sourceHandle: pendingConnection.sourceHandle,
                target: id,
                targetHandle: targetHandle,
                type: 'customEdge',
                data: { isFormula }
            }, eds));
        }

        setNodes((nds: any) => nds.concat(newNode));
        setMenuPosition(null);
        setPendingConnection(null);
        triggerLogicUpdate();
    }, [menuPosition, screenToFlowPosition, pendingConnection, getNodes, setEdges, setNodes, triggerLogicUpdate, setMenuPosition]);

    return {
        pendingConnection,
        setPendingConnection,
        menuRef,
        closeMenu,
        addNodeAtCursor,
        adjustedPosition,
        // Export wrapped handlers for Body.tsx
        connectionHandlers: {
            onConnect,
            onConnectStart,
            onConnectEnd,
            onReconnectStart,
            onReconnectEnd
        }
    };
}

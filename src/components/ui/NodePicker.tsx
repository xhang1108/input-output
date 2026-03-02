'use client';

import { useMemo } from 'react';
import { getDefinitionsByCategory } from '../../definitions/nodeDefinitions';
import { CategorizedMenu, CategorizedMenuItem } from './CategorizedMenu';

interface NodePickerProps {
    isOpen: boolean;
    position?: { x: number, y: number };
    onClose: () => void;
    onSelect: (type: string, label: string, data?: unknown, isContinuous?: boolean) => void;
    pendingConnection?: { nodeId: string; handleId: string | null; handleType: 'source' | 'target' } | null;
}

// Transform NodeDefinitions → CategorizedMenuItem format
function buildMenuItems(): CategorizedMenuItem[] {
    const categories = getDefinitionsByCategory();
    const items: CategorizedMenuItem[] = [];

    for (const cat of categories) {
        for (const def of cat.items) {
            items.push({
                id: def.id,
                label: def.label,
                category: cat.category,
                aliases: def.aliases || [],
                data: {
                    ...def.defaultData,
                    handles: def.handles,
                }
            });
        }
    }
    return items;
}

const ALL_MENU_ITEMS = buildMenuItems();

export function NodePicker({ isOpen, position, onClose, onSelect, pendingConnection }: NodePickerProps) {
    // Filter items based on pending connection (Smart Link)
    const filteredItems = useMemo(() => {
        if (!pendingConnection) return ALL_MENU_ITEMS;

        const requiredHandleType = pendingConnection.handleType === 'source' ? 'target' : 'source';

        return ALL_MENU_ITEMS.filter(item => {
            // Check if node definition has a compatible handle
            const nodeHandles = (item.data as any)?.handles || [];
            const hasCompatibleHandle = nodeHandles.some((h: any) => h.type === requiredHandleType);
            return hasCompatibleHandle;
        });
    }, [pendingConnection]);

    const handleSelect = (item: CategorizedMenuItem, isContinuous: boolean) => {
        onSelect(item.id, item.label, item.data, isContinuous);
    };

    return (
        <CategorizedMenu
            isOpen={isOpen}
            items={filteredItems}
            position={position}
            onClose={onClose}
            onSelect={handleSelect}
            placeholder="Add Node..."
            followZoom={false}
        />
    );
}

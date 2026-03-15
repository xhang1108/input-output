'use client';

import { useMemo } from 'react';
import { getDefinitionsByCategory } from '../../definitions/nodeDefinitions';
import { CategorizedMenu, CategorizedMenuItem } from './CategorizedMenu';
import { getHandleColorByConfig, isGenericColor } from '../../utils/handleUtils';

interface NodePickerProps {
    isOpen: boolean;
    position?: { x: number, y: number };
    onClose: () => void;
    onSelect: (type: string, label: string, data?: unknown, isContinuous?: boolean) => void;
    pendingConnection?: { nodeId: string; handleId: string | null; handleType: 'source' | 'target'; handleColor: string } | null;
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
        const searchColor = (pendingConnection.handleColor || '').trim().toLowerCase();

        const filtered = ALL_MENU_ITEMS.filter(item => {
            const nodeHandles = (item.data as any)?.handles || [];
            if (nodeHandles.length === 0) return false;

            return nodeHandles.some((h: any) => {
                if (h.type !== requiredHandleType) return false;
                
                const hColor = getHandleColorByConfig(h);

                if (isGenericColor(searchColor)) {
                    // Contextual Match:
                    // 1. If dragging from an INPUT handle -> it can accept ANY output Node.
                    if (pendingConnection.handleType === 'target') return true;
                    // 2. If dragging from an OUTPUT handle -> only match other Any inputs to keep specialized nodes clean.
                    return isGenericColor(hColor);
                }
                
                // Specific handles match same color OR any
                return hColor === searchColor || isGenericColor(hColor);
            });
        });

        return filtered;
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
            placeholder={pendingConnection ? "Filtered Search..." : "Add Node..."}
            followZoom={false}
        />
    );
}

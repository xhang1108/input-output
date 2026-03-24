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
            // 1. Add the base node as-is
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

            // 2. Discover sub-variants from select params
            // A parameter is "spread" if its options have aliases defined.
            const subParams = def.params?.filter(p => p.type === 'select' && p.options?.some(opt => opt.aliases && opt.aliases.length > 0));
            
            if (subParams) {
                for (const param of subParams) {
                    if (!param.options) continue;

                    for (const opt of param.options) {
                        // Only create variant if it has aliases (prevents over-spreading)
                        if (!opt.aliases || opt.aliases.length === 0) continue;

                        const cleanLabel = opt.label.split(' (')[0].trim();
                        
                        // Deduplication: If this variant's value is already the default for the node,
                        // and they share a similar name, we can skip it to avoid "Add" vs "Add" noise.
                        // However, we usually want these to show up specifically when searched.
                        // Better check: if the base node's label and defaultData already match this variant, skip.
                        const isDefaultVariant = def.defaultData?.[param.id] === opt.value;
                        if (isDefaultVariant && (def.label.toLowerCase() === cleanLabel.toLowerCase())) continue;

                        items.push({
                            id: `${def.id}:${param.id}:${opt.value}`,
                            label: cleanLabel,
                            category: cat.category,
                            isVariant: true,
                            // Variants only match their OWN aliases and labels to avoid noise
                            // (e.g. searching "Math" shouldn't show 50 math sub-operations)
                            aliases: Array.from(new Set([
                                ...(opt.aliases || []),
                                cleanLabel.toLowerCase()
                            ])),
                            data: {
                                ...def.defaultData,
                                [param.id]: opt.value,
                                label: cleanLabel,
                                handles: def.handles,
                            }
                        });
                    }
                }
            }
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
        // If it's a variant (id contains ':'), the node type is the first part
        const nodeType = item.id.includes(':') ? item.id.split(':')[0] : item.id;
        onSelect(nodeType, item.label, item.data, isContinuous);
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
            showCategories={true}
            showSearch={true}
        />
    );
}

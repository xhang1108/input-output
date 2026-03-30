/**
 * CommandRegistry
 * Centralized definition of all shortcuts and commands in Input-Output.
 */

export type Platform = 'mac' | 'win';

export interface ShortcutDefinition {
    id: string;
    label: string;
    description?: string;
    category: 'Creation' | 'Transform' | 'Selection' | 'Clipboard' | 'Utility' | 'System';
    keys: {
        default: string;
        mac?: string;
    };
}

export const COMMAND_REGISTRY: ShortcutDefinition[] = [
    // --- Creation & Layout ---
    {
        id: 'palette:open',
        label: 'Open Palette',
        category: 'Creation',
        keys: { default: 'shift+a' }
    },
    {
        id: 'nodes:swap-inputs',
        label: 'Swap Inputs',
        category: 'Creation',
        keys: { default: 'alt+s' }
    },
    {
        id: 'layout:auto',
        label: 'Auto Layout',
        category: 'Creation',
        keys: { default: 'l' }
    },
    {
        id: 'canvas:focus-selected',
        label: 'Focus on Selected',
        category: 'Utility',
        keys: { default: '.' }
    },

    // --- Transform ---
    {
        id: 'transform:grab',
        label: 'Grab',
        category: 'Transform',
        keys: { default: 'g' }
    },
    {
        id: 'transform:scale',
        label: 'Scale',
        category: 'Transform',
        keys: { default: 's' }
    },
    {
        id: 'transform:rotate',
        label: 'Rotate',
        category: 'Transform',
        keys: { default: 'r' }
    },
    {
        id: 'nodes:duplicate',
        label: 'Duplicate',
        category: 'Transform',
        keys: { default: 'shift+d' }
    },
    {
        id: 'nodes:bundle',
        label: 'Frame Selected',
        category: 'Transform',
        keys: { default: 'f' }
    },

    // --- Selection & Deletion ---
    {
        id: 'nodes:delete',
        label: 'Delete Selected',
        category: 'Selection',
        keys: { default: 'delete' }
    },
    {
        id: 'nodes:delete-alt',
        label: 'Delete Selected (X)',
        category: 'Selection',
        keys: { default: 'x' }
    },
    {
        id: 'selection:all',
        label: 'Select All',
        category: 'Selection',
        keys: { default: 'a' }
    },

    // --- Clipboard ---
    {
        id: 'clipboard:copy',
        label: 'Copy',
        category: 'Clipboard',
        keys: { default: 'ctrl+c', mac: 'cmd+c' }
    },
    {
        id: 'clipboard:paste',
        label: 'Paste',
        category: 'Clipboard',
        keys: { default: 'ctrl+v', mac: 'cmd+v' }
    },

    // --- System ---
    {
        id: 'system:save',
        label: 'Save Project',
        category: 'System',
        keys: { default: 'ctrl+s', mac: 'cmd+s' }
    },
    {
        id: 'system:toggle-n-panel',
        label: 'Toggle N-Panel',
        category: 'System',
        keys: { default: 'n' }
    },
    {
        id: 'system:confirm',
        label: 'Confirm Action',
        category: 'System',
        keys: { default: 'enter' }
    },
    {
        id: 'system:cancel',
        label: 'Cancel/Deselect',
        category: 'System',
        keys: { default: 'escape' }
    },
    {
        id: 'system:undo',
        label: 'Undo',
        category: 'System',
        keys: { default: 'ctrl+z', mac: 'cmd+z' }
    },
    {
        id: 'system:redo',
        label: 'Redo',
        category: 'System',
        keys: { default: 'ctrl+y', mac: 'cmd+y' }
    },
    {
        id: 'system:redo-alt',
        label: 'Redo (Alt)',
        category: 'System',
        keys: { default: 'ctrl+shift+z', mac: 'cmd+shift+z' }
    },
];

/**
 * Gets the actual key string to use based on the platform.
 */
export function getShortcutKey(id: string, platform: Platform = 'win'): string {
    const def = COMMAND_REGISTRY.find(d => d.id === id);
    if (!def) return '';

    if (platform === 'mac' && def.keys.mac) return def.keys.mac;
    return def.keys.default;
}

/**
 * Maps a list of command IDs to their respective keys for use in useEar.
 * This handles the Ctrl vs Cmd duplication.
 */
export function getEarShortcuts(platform: Platform, handlers: Record<string, (e: KeyboardEvent) => void>) {
    const result: Record<string, (e: KeyboardEvent) => void> = {};

    Object.entries(handlers).forEach(([id, handler]) => {
        const def = COMMAND_REGISTRY.find(d => d.id === id);
        if (def) {
            result[def.keys.default] = handler;
            if (platform === 'mac' && def.keys.mac) {
                result[def.keys.mac] = handler;
            }
        } else {
            // Allow manual overrides if not in registry
            result[id] = handler;
        }
    });

    return result;
}

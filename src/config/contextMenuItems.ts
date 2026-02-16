import { Node } from '@xyflow/react';

export interface ContextMenuItemDef {
    label: string;
    shortcut?: string;
    danger?: boolean;
    action: () => void;
}

interface ContextMenuActions {
    openPalette: (x: number, y: number) => void;
    resetView: () => void;
    pasteFromClipboard: () => void;
    selectAll: () => void;
    rename: () => void;
    duplicateAndGrab: () => void;
    copyToClipboard: () => void;
    detachSelected: () => void;
    deleteSelected: () => void;
    logAction: (msg: string) => void;
}

export function getCanvasMenuItems(actions: ContextMenuActions, x: number, y: number): ContextMenuItemDef[] {
    return [
        { label: 'Command Palette', shortcut: 'Shift+A', action: () => actions.openPalette(x, y) },
        { label: 'Reset View', action: () => actions.resetView() },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => actions.pasteFromClipboard() },
        { label: 'Select All', shortcut: 'A', action: () => actions.selectAll() },
    ];
}

export function getNodeMenuItems(actions: ContextMenuActions): ContextMenuItemDef[] {
    return [
        { label: 'Rename', shortcut: 'Enter', action: () => actions.rename() },
        { label: 'Duplicate', shortcut: 'Shift+D', action: () => actions.duplicateAndGrab() },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => actions.copyToClipboard() },
        { label: 'Colors', action: () => actions.logAction('Colors via Menu (Todo)') },
        { label: 'Detach', shortcut: 'Alt+Drag', action: () => actions.detachSelected() },
        { label: 'Delete', shortcut: 'Del', danger: true, action: () => actions.deleteSelected() },
    ];
}

import { Node } from '@xyflow/react';

export interface ContextMenuItemDef {
    label: string;
    shortcut?: string;
    danger?: boolean;
    action: () => void;
}

export interface ContextMenuActions {
    openPalette: (x: number, y: number) => void;
    resetView: () => void;
    pasteFromClipboard: () => void;
    selectAll: () => void;
    rename: () => void;
    duplicateAndGrab: () => void;
    copyToClipboard: () => void;
    detachSelected: () => void;
    deleteSelected: () => void;
    viewSpecs: () => void;
    traceUpstream: () => void;
    toggleMute: () => void;
    logAction: (msg: string) => void;
}

export function getCanvasMenuItems(actions: ContextMenuActions, x: number, y: number): ContextMenuItemDef[] {
    return [
        { label: 'Command Palette', shortcut: 'Shift+A', action: () => actions.openPalette(x, y) },
        { label: 'Trace Upstream', shortcut: 'Alt+T', action: () => actions.traceUpstream() },
        { label: 'Reset View', action: () => actions.resetView() },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => actions.pasteFromClipboard() },
        { label: 'Select All', shortcut: 'A', action: () => actions.selectAll() },
    ];
}

export function getNodeMenuItems(actions: ContextMenuActions, hasSpecs: boolean = false, isMuted: boolean = false): ContextMenuItemDef[] {
    const items: ContextMenuItemDef[] = [
        { label: 'Rename', shortcut: 'Enter', action: () => actions.rename() },
        { label: isMuted ? 'Unmute' : 'Mute', shortcut: 'M', action: () => actions.toggleMute() },
        { label: 'Trace Upstream', shortcut: 'Alt+T', action: () => actions.traceUpstream() },
    ];

    if (hasSpecs) {
        items.push({ label: 'View Specs', shortcut: 'F1', action: () => actions.viewSpecs() });
    }

    items.push(
        { label: 'Duplicate', shortcut: 'Shift+D', action: () => actions.duplicateAndGrab() },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => actions.copyToClipboard() },
        { label: 'Detach', shortcut: 'Alt+Drag', action: () => actions.detachSelected() },
        { label: 'Delete', shortcut: 'Del', danger: true, action: () => actions.deleteSelected() },
    );

    return items;
}


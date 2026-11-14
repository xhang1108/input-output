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
    cutSelected: () => void;
    detachSelected: () => void;
    detachFromFrame?: () => void;
    fitToFrame?: () => void;
    deleteSelected: () => void;
    viewSpecs: () => void;
    traceUpstream: () => void;
    toggleMute: () => void;
    logAction: (msg: string) => void;
    undo?: () => void;
    redo?: () => void;
    // Group (Blender-style; GROUP_NODE_PLAN §5.4). All optional so existing
    // canvas/node menus keep working; FlowCanvas wires these when available.
    groupSelected?: () => void;
    ungroupSelected?: () => void;
    enterGroup?: () => void;
    // Scope-editor draft delete (Delete key is wired separately in FlowCanvas).
    deleteInScope?: () => void;
}

export function getCanvasMenuItems(actions: ContextMenuActions, x: number, y: number): ContextMenuItemDef[] {
    const items: ContextMenuItemDef[] = [];

    // Only present when the canvas reports undo/redo is available and writable.
    if (actions.undo) {
        items.push({ label: 'Undo', shortcut: 'Ctrl+Z', action: () => actions.undo!() });
    }
    if (actions.redo) {
        items.push({ label: 'Redo', shortcut: 'Ctrl+Y', action: () => actions.redo!() });
    }

    items.push(
        { label: 'Command Palette', shortcut: 'Shift+A', action: () => actions.openPalette(x, y) },
        { label: 'Trace Upstream', shortcut: 'Alt+T', action: () => actions.traceUpstream() },
        { label: 'Reset View', action: () => actions.resetView() },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => actions.pasteFromClipboard() },
        { label: 'Select All', shortcut: 'A', action: () => actions.selectAll() },
    );

    return items;
}

export function getNodeMenuItems(actions: ContextMenuActions, hasSpecs: boolean = false, isMuted: boolean = false, hasParent: boolean = false, isFrame: boolean = false, groupOpts?: { isGroup?: boolean; inScope?: boolean }): ContextMenuItemDef[] {
    const items: ContextMenuItemDef[] = [
        { label: 'Rename', shortcut: 'Enter', action: () => actions.rename() },
        { label: isMuted ? 'Unmute' : 'Mute', shortcut: 'M', action: () => actions.toggleMute() },
        { label: 'Trace Upstream', shortcut: 'Alt+T', action: () => actions.traceUpstream() },
    ];

    // Group drill wiring (mobile path to Enter Group lives here; §8.7).
    if (!groupOpts?.inScope) {
        if (groupOpts?.isGroup) {
            if (actions.enterGroup) {
                items.push({ label: 'Enter Group', shortcut: 'Tab', action: () => actions.enterGroup!() });
            }
            if (actions.ungroupSelected) {
                items.push({ label: 'Ungroup', shortcut: 'Ctrl+Shift+G', action: () => actions.ungroupSelected!() });
            }
        } else if (!isFrame) {
            if (actions.groupSelected) {
                items.push({ label: 'Group', shortcut: 'Ctrl+G', action: () => actions.groupSelected!() });
            }
        }
    }

    // Scope editor: only draft-safe actions (rename/mute/trace/delete);
    // structural canvas actions would hit the Brain main graph, so the menu
    // below is skipped entirely while drilled in.
    if (groupOpts?.inScope) {
        if (actions.deleteInScope) {
            items.push({ label: 'Delete', shortcut: 'Del', danger: true, action: () => actions.deleteInScope!() });
        }
        return items;
    }

    if (hasSpecs) {
        items.push({ label: 'View Specs', shortcut: 'F1', action: () => actions.viewSpecs() });
    }

    if (hasParent && actions.detachFromFrame) {
        items.push({ label: 'Detach from Frame', action: () => actions.detachFromFrame!() });
    }

    if (isFrame && actions.fitToFrame) {
        items.push({ label: 'Fit to contents', action: () => actions.fitToFrame!() });
    }

    items.push(
        { label: 'Duplicate', shortcut: 'Shift+D', action: () => actions.duplicateAndGrab() },
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => actions.cutSelected() },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => actions.copyToClipboard() },
        { label: 'Disconnect Edges', shortcut: 'Alt+Drag', action: () => actions.detachSelected() },
        { label: 'Delete', shortcut: 'Del', danger: true, action: () => actions.deleteSelected() },
    );

    return items;
}


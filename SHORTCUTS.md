# Shortcut Registry & Rules

This document serves as the Single Source of Truth for all keyboard interactions. Use this to check for key conflicts or find available keys.

## 1. Key Binding Registry (By Key)
*Quickly check if a key is already "taken" and what it does.*

| Key / Input | Context | Action | Conflicts / blocking |
| :--- | :--- | :--- | :--- |
| Esc | Global | Blur Input | Exits typing mode. |
| A | Object Mode | Select All | Disabled if typing. |
| G | Object Mode | Grab (Move) | Disabled if typing. |
| X | Object Mode | Delete | Disabled if typing. |
| M | Object Mode | Mute Selected | Toggles "muted" state on nodes. |
| . (Period) | Object Mode | Focus View | Disabled if typing. |
| Del / Backspace| Global | Delete Object / Text | Text delete if typing; Object delete if not. |
| Shift + A | Object Mode | Add Menu | Disabled if typing. |
| Shift + D | Object Mode | Duplicate | Creates copy & starts move. |
| Ctrl + C | Global | Copy | Text copy if typing; Object copy if not. |
| Ctrl + V | Global | Paste | Text paste if typing; Object copy if not. |
| Ctrl + X | Global | Cut | Text cut if typing; Object cut if not. |
| Ctrl + Z | Global | Undo | Reverts last structural change. |
| Ctrl + Shift + Z| Global | Redo | Re-applies reverted change. |
| Ctrl + Y | Global | Redo | Alternative for Redo. |
| LMB (Click) | Global | Select / Confirm | |
| MMB (Drag) | Global | Pan View | |
| Ctrl+RMB(Drag) | Global | Knife (Sever) | Cuts edges intersected by the line. |
| Shift + L | Object Mode | Auto Layout | Organizes nodes using Elk.js algorithm. |

## 2. Command Reference (By Function)
*Find all ways to trigger a specific command.*

| Function | Primary Key | Alternate Keys | Behavior |
| :--- | :--- | :--- | :--- |
| Delete | X | Delete, Backspace | Removes selected nodes. |
| Duplicate | Shift + D | Ctrl + C -> Ctrl + V | Creates copy & starts move. |
| Move / Grab | G | (Mouse Drag) | 'G' works without clicking first (Hover). |
| Undo | Ctrl + Z | | Reverts structural changes. |
| Redo | Ctrl + Shift + Z | Ctrl + Y | Re-applies changes. |
| Mute | M | | Prevents node from contributing to logic. |
| Sever (Knife) | Ctrl + RMB | (Knife Tool) | Drag across wires to delete them. |
| Add Node | Shift + A | (Right Click Context Menu) | Opens search/add menu. |
| Select All | A | | |
| Focus View | . | | Centers view on selection. |
| Auto Layout | Shift + L | (Layout Button) | Arranges nodes left-to-right using Elk.js. |

## 3. Interaction Principles
1.  **Typing Priority**: If the cursor is in a text box, Text Input wins. All single-letter shortcuts (G, A, X, M) are disabled.
2.  **Escape Hatch**: Esc key is the universal way to exit "Typing Mode" and return to "Object Mode".
3.  **Mouse Stickiness**: Operations like Paste, Duplicate, and Grab immediately attach objects to the mouse cursor.
4.  **Auto-Insert**: Dragging a node (except Input nodes) onto an existing wire will automatically split the wire and insert the node into the chain.
5.  **Perception -> Action**: The Knife tool uses the "Eye" to detect intersected edges before the "Hand" severs them.

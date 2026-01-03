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
| . (Period) | Object Mode | Focus View | Disabled if typing. |
| Del | Global | Delete Object / Text | Text delete if typing; Object delete if not. |
| Backspace | Global | Delete Object / Text | Text delete if typing; Object delete if not. |
| Shift + A | Object Mode | Add Menu | Disabled if typing (allows 'A'). |
| Shift + D | Object Mode | Duplicate | Disabled if typing (allows 'D'). |
| Ctrl + C | Global | Copy | Text copy if typing; Object copy if not. |
| Ctrl + V | Global | Paste | Text paste if typing; Object paste if not. |
| Ctrl + X | Global | Cut | Text cut if typing; Object cut if not. |
| LMB (Click) | Global | Select / Confirm | |
| MMB (Drag) | Global | Pan View | |

## 2. Command Reference (By Function)
*Find all ways to trigger a specific command.*

| Function | Primary Key | Alternate Keys | Behavior |
| :--- | :--- | :--- | :--- |
| Delete | X | Delete, Backspace | Removes selected nodes. |
| Duplicate | Shift + D | Ctrl + C -> Ctrl + V | Creates copy & starts move. |
| Move / Grab | G | (Mouse Drag) | 'G' works without clicking first (Hover). |
| Copy | Ctrl + C | | Internal clipboard. |
| Paste | Ctrl + V | | Auto-enters Grab mode. |
| Add Node | Shift + A | (Right Click Context Menu - Future) | Opens search/add menu. |
| Select All | A | | |
| Focus View| . | | Centers view on selection. |

## 3. Interaction Principles
1.  Typing Priority: If the cursor is in a text box, Text Input wins. All single-letter shortcuts (G, A, X) are strictly disabled to allow generic typing.
2.  Escape Hatch: Esc key is the universal way to exit "Typing Mode" and return to "Object Mode".
3.  Mouse Stickiness: Operations that create/move objects (Paste, Duplicate, Grab) immediately attach the object to the mouse cursor to save clicks.

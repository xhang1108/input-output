---
title: Keyboard Shortcuts
order: 2
icon: Wrench
---

# Keyboard Shortcuts

Speed is the foundation of Input-Output. Our interface is designed for high-density engineering, where every keypress translates to an atomic operation.

## Core Actions

These shortcuts manage the overall state of your canvas and project.

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Shift + A` | **Add Node** | Opens the Node Palette to search and spawn operators. |
| `N` | **N-Panel** | Toggles the side property panel for fine-tuning selected nodes. |
| `Ctrl + Z` | **Undo** | Reverts the last atomic transaction. |
| `Ctrl + Shift + Z` | **Redo** | Re-applies the last undone transaction. |
| `Ctrl + S` | **Save** | Manually persists the current project state. |
| `Esc` | **Cancel** | Cancels any active transform or deselects all nodes. |
| `L` | **Layout** | Triggers the A* auto-layout engine to organize your graph. |

## Selection & Manipulation

Manage your workflow and node topology with precision.

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `A` | **Select All** | Selects every node currently on the canvas. |
| `Shift + Drag` | **Box Select** | Select multiple nodes by dragging a selection box. |
| `Ctrl + C` | **Copy** | Copies selected nodes to the internal clipboard. |
| `Ctrl + V` | **Paste** | Pastes nodes at the current mouse position. |
| `Shift + D` | **Duplicate** | Copies and executes a Grab on the new selection. |
| `F` | **Frame** | Wraps the selected nodes in a new Frame container. |
| `Delete` | **Delete** | Removes selected nodes and cascading edges. |
| `M` | **Mute** | Toggles the active state of a node (Muted nodes stop computing). |
| `Alt + S` | **Swap** | Swaps the input connections of two selected sibling nodes. |

## Transform Mode

When a node is being moved, scaled, or rotated, you enter **Transform Mode**.

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `G` | **Grab** | Start moving the current selection. |
| `S` | **Scale** | Start resizing (Frames and Matrices only). |
| `R` | **Rotate** | Rotate the selection. |
| `X` | **X-Axis Lock** | Constrains movement or scaling to the horizontal axis. |
| `Y` | **Y-Axis Lock** | Constrains movement or scaling to the vertical axis. |
| `0-9` | **Numeric Input** | Type exact numbers to set precise coordinates or dimensions. |
| `Enter` | **Confirm** | Commits the transform to the transaction history. |

---

> [!TIP]
> You can combine **Numeric Input** with **Axis Locks**. For example: Press `G`, then `X`, then type `500` and press `Enter` to move a node exactly 500 pixels to the right.

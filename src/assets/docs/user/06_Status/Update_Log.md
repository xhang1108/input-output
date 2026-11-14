---
title: Update Log
order: 1
---

# Update Log

> [!LOG]
> ## 2026-11-14
> ### V1.2.0 - Frames & History Release
> - **Save Format**: Unchanged (schema 1.0.0); existing projects load as-is.
> - **Frames**: Group with `F`, attach on drop, manual resize, live expand-only auto-fit, `Fit to contents`, and `Detach from Frame`; children keep parent-local coordinates.
> - **Undo / Redo**: History clears on project change, read-only is enforced in the command hooks, node values and mute are undoable, and visible Undo/Redo controls were added.
> - **Duplicate**: `Shift+D` now follows the mouse and drops on click; the whole gesture is one undo step.
> - **Import**: `Undo import` restores the previous graph, including measured node sizes.

> [!LOG]
> ## 2026-11-13
> ### V1.1.0 - Stability & Performance Release
> - **Save Format**: Unchanged (schema 1.0.0); existing projects load as-is.
> - **React Flow Integration**: Snapping now works in all three transform modes (grab 20px, scale 0.05, rotate 15°), and the manual snap toggle takes effect.
> - **Edge Performance**: `MagneticEdge` memoized and edge slot lookup moved to an O(1) `WeakMap`; relink no longer re-renders on every edge change.
> - **Hygiene**: Deleted demo `as any`, removed `hideAttribution`, and made the lint baseline runnable again.
> - **Version Display**: Status bar, footer and manual header now read the app version from a single source.

> [!LOG]
> ## 2026-04-11
> ### V1.0 - Official Production Release
> - **System Overview**: The I/O System is a visual computing platform designed to bridge the gap between human logic and machine execution.
> - **Core Engine**: Built for hybrid symbolic and numerical computation, supporting complex calculus and array geometry.
> - **LaTeX Integration**: Native **LaTeX Import** and high-fidelity **Formula Export** (LaTeX & Symbolic formats).
> - **Visual Synthesis**: Real-time **Graph Plotting** and interactive signal visualization.
> - **Node Ecosystem**: A robust library of 47 atomic nodes spanning 8 functional categories, enabling infinite system combinations.
> - **IOGL Language**: A first-of-its-kind graph language for scriptable nodes.


> [!LOG]
> ## 2026-01-02
> ### First Commit
> - **Project Start**: Created this project. I wanted to start this for a long time, but my previous web project took me three months.

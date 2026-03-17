---
title: Interaction Physics
order: 1
icon: MousePointer2
---

# Interaction Physics

The I/O System operates on a **Fixed Coordinate Plane** where precision is the primary directive.

## 1. The Infinite Canvas
- **Translation**: [Middle Mouse] to pan the view.
- **Scaling**: [Scroll Wheel] to zoom towards the cursor.
- **Recenter**: Press `.` (Dot) to focus on the selected node or origin.

### Coordinate System
The Canvas uses a standard Cartesian coordinate system where the origin `(0,0)` is situated at the absolute center.
- **X-Axis**: Positive values move **Right**, negative values move **Left**.
- **Y-Axis**: Positive values move **Down**, negative values move **Up**. *(Screen-space standard)*


## 2. Node Lifecycle
- **Creation**: `Shift + A` to open the search menu.
- **Manipulation**: 
  - `G`: Grab & Move
  - `S`: Scale Dimensions
  - `R`: Rotate (Visual only)
- **Deletion**: Press `X`.

## 3. Atomic Operations
- **Undo / Redo**: Managed by the `Brain` transaction log.
- **Muting**: Temporarily disabling a node's computation.
- **Framing**: Grouping nodes into a persistent logical container.

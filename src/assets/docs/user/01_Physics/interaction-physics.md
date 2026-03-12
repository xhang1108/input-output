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

#### Live Demo: Visualizing Coordinates
Try dragging the sliders to see how mathematical operations mirror spatial relationships on the canvas.

```iogl-circuit
{
  "label": "Coordinate Transformer",
  "height": 280,
  "iogl": {
    "nodes": [
      { "id": "x-pos", "type": "IN-02", "position": { "x": -150, "y": -40 }, "data": { "value": 150, "min": -500, "max": 500, "step": 1, "label": "X Coordinate" } },
      { "id": "y-pos", "type": "IN-02", "position": { "x": -150, "y": 80 }, "data": { "value": 80, "min": -500, "max": 500, "step": 1, "label": "Y Coordinate" } },
      { "id": "distance", "type": "MA-01", "position": { "x": 100, "y": 20 }, "data": { "op": "hypot", "label": "Distance from Origin" } },
      { "id": "res", "type": "OT-01", "position": { "x": 320, "y": 20 }, "data": { "label": "Radius" } }
    ],
    "edges": [
      { "id": "e1", "source": "x-pos", "sourceHandle": "out", "target": "distance", "targetHandle": "in_a" },
      { "id": "e2", "source": "y-pos", "sourceHandle": "out", "target": "distance", "targetHandle": "in_b" },
      { "id": "e3", "source": "distance", "sourceHandle": "out", "target": "res", "targetHandle": "in" }
    ]
  }
}
```

### Basic Node Circuit
This simple amplifier circuit shows how data flows purely from left to right.

```iogl-circuit
{
  "label": "Signal Amplifier",
  "height": 220,
  "iogl": {
    "nodes": [
      { "id": "slider-1", "type": "IN-02", "position": { "x": -150, "y": -40 }, "data": { "value": 0.5, "min": 0, "max": 1, "step": 0.01, "label": "Gain Control" } },
      { "id": "in-1", "type": "IN-01", "position": { "x": -150, "y": 80 }, "data": { "value": 100, "label": "Base Signal" } },
      { "id": "math-1", "type": "MA-01", "position": { "x": 100, "y": 20 }, "data": { "op": "multiply", "label": "Amplifier" } },
      { "id": "res-1", "type": "OT-01", "position": { "x": 320, "y": 20 }, "data": { "label": "Output" } }
    ],
    "edges": [
      { "id": "e1", "source": "slider-1", "sourceHandle": "out", "target": "math-1", "targetHandle": "in_a" },
      { "id": "e2", "source": "in-1", "sourceHandle": "out", "target": "math-1", "targetHandle": "in_b" },
      { "id": "e3", "source": "math-1", "sourceHandle": "out", "target": "res-1", "targetHandle": "in" }
    ]
  }
}
```

## 2. Node Lifecycle
- **Creation**: `Shift + A` to open the search menu.
- **Manipulation**: 
  - `G`: Grab & Move
  - `S`: Scale Dimensions
  - `R`: Rotate (Visual only)
- **Deletion**: `Backspace` or `Delete`.

## 3. Atomic Operations
- **Undo / Redo**: Managed by the `Brain` transaction log.
- **Muting**: Temporarily disabling a node's computation.
- **Framing**: Grouping nodes into a persistent logical container.

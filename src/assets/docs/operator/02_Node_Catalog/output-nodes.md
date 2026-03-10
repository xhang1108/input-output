---
title: Output Nodes
order: 6
icon: Monitor
---

# 📺 Output Nodes

The Output category contains nodes designed to visualize, debug, and format the final results of your computations. These nodes are the end-points of your data flow.

## 1. Result (OT-01)
The primary display node for rendering any data type. It automatically formats the output based on the incoming data or allows manual overrides to enforce a specific visual representation.

| Display Mode | Description |
| :--- | :--- |
| `Auto` | Infers best format (scalar as text, arrays as grids) |
| `Text` | Forces raw string or numeric output |
| `Grid / Matrix` | Renders a table for 2D Arrays |
| `Formula` | Outputs raw symbolic math `LaTeX`-style |
| `Color` | Interprets values as a hex/RGB color swatch |

```playground
{
  "nodeType": "OT-01",
  "initialData": { "label": "Final Result" }
}
```

## 2. Graph Plot (OT-03)
A plotting utility that accepts an expression or symbolic formula and evaluates it over a defined domain.

- **Min X / Max X**: Defines the bounds of the X-axis mapping.
- **Sampling Points**: The resolution of the curve. Higher values yield smoother lines but consume more CPU cycles.

```playground
{
  "nodeType": "OT-03",
  "initialData": { "label": "Sine Wave", "minX": -5, "maxX": 5, "points": 100 },
  "width": 300,
  "height": 260
}
```

## 3. Status Board (OT-02)
A simple boolean indicator used for monitoring conditions. Often paired with conditionals (e.g., `Less Than` node) to visually flag limits or thresholds being broken in an industrial pipeline.
The node glows Green for `True` and Red for `False`.

## 4. Debug (OT-04)
A technical diagnostic node. It accepts any incoming payload and spits out the raw JSON representation inside a terminal-like interface. Use this when you suspect a type mismatch or corrupted tensor data.

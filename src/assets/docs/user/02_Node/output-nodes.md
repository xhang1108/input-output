---
title: Output Nodes
order: 2
icon: Monitor
---

# Output Nodes

Visualization and technical diagnostics.

## 1. Result (OT-01)
Primary display node for any data type (Scalar, Array, Symbolic).

- **Input**: The data value to display.
- **Output**: The input value.

```playground
{
  "nodeType": "OT-01",
  "initialData": { "label": "Final Result" }
}
```

## 2. Status Board (OT-02)
Boolean indicator for monitoring thresholds or conditions.

- **Input**: Boolean trigger.
- **Output**: The input boolean.

```playground
{
  "nodeType": "OT-02",
  "initialData": { "label": "Pipeline Status" },
  "height": 140
}
```

## 3. Graph Plot (OT-03)
A high-performance visualization terminal that renders mathematical data into interactive charts.

- **Input**: The data to visualize. Supported formats:
  - **Symbolic Functions**: Strings like `sin(x)` or `y = x^2`.
  - **Line Plots**: 1D Arrays `[y1, y2, ...]` (automatically indexed against X).
  - **Scatter Plots**: Nx2 Arrays/Matrices `[[x1, y1], [x2, y2], ...]`.
  - **Bubble Charts**: Nx3 Arrays/Matrices `[[x1, y1, size], ...]`.
  - **Vector Fields**: Nx4 Arrays/Matrices `[[x, y, u, v], ...]`.
- **Output**: The processed plot data object.

```playground
{
  "nodeType": "OT-03",
  "initialData": { "label": "Plotter", "minX": -10, "maxX": 10, "points": 100 },
  "width": 300,
  "height": 260
}
```

## 4. Debug (OT-04)
Technical terminal for raw JSON payload inspection.

- **Input**: The raw data object to inspect.
- **Output**: The input value.

```playground
{
  "nodeType": "OT-04",
  "initialData": { "label": "JSON Debug" },
  "height": 200
}
```

---
title: Output Nodes
order: 2
icon: Monitor
---

# Output Nodes

Visualization and technical diagnostics.

## 1. Result (OT-01)
Primary display node for any data type (Scalar, Array, Symbolic).

```playground
{
  "nodeType": "OT-01",
  "initialData": { "label": "Final Result" }
}
```

## 2. Status Board (OT-02)
Boolean indicator for monitoring thresholds or conditions.

```playground
{
  "nodeType": "OT-02",
  "initialData": { "label": "Pipeline Status" },
  "height": 140
}
```

## 3. Graph Plot (OT-03)
Visualizes expressions or datasets over a defined domain.

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

```playground
{
  "nodeType": "OT-04",
  "initialData": { "label": "JSON Debug" },
  "height": 200
}
```

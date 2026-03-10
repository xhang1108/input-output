---
title: Input Nodes
order: 0
icon: Wrench
---

# 📥 Input Operators

Input nodes are the "Senses" of your calculation. They provide the initial data that flows through your IOGL blueprint.

## 1. Number Input (IN-01)
The simplest input node. Type a number or use the scroll wheel to increment/decrement.

```playground
{
  "nodeType": "IN-01",
  "initialData": { "value": 42, "unit": "rad", "label": "Initial Theta" },
  "height": 200
}
```

## 2. Slider (IN-02)
Use the Slider for continuous real-time modulation. Perfect for tuning physical parameters or color values.

```playground
{
  "nodeType": "IN-02",
  "initialData": { "value": 0.5, "min": 0, "max": 1, "step": 0.01, "label": "Modulator" },
  "height": 220
}
```

## 3. Matrix Input (IN-07)
Define 2D data structures. Matrices are represented in IOGL using JSON bracket notation.

```playground
{
  "nodeType": "IN-07",
  "initialData": { "rawExpression": "[[3,3,3],[3,3,3],[3,3,3]]", "label": "Identity Matrix", "width": 152, "height": 160 },
  "height": 240
}
```

---

## 🚀 Interactive Example: Slider Modulation
Inject this example to see a Slider modulate a multiplication circuit:

```iogl-example
{
  "label": "Slider Circuit",
  "iogl": {
    "nodes": [
      { "id": "slider-1", "type": "IN-02", "position": { "x": 0, "y": 0 }, "data": { "value": 0.5, "min": 0, "max": 1, "step": 0.01, "label": "Control" } },
      { "id": "in-1", "type": "IN-01", "position": { "x": 0, "y": 150 }, "data": { "value": 100, "label": "Base" } },
      { "id": "math-1", "type": "MA-01", "position": { "x": 300, "y": 75 }, "data": { "op": "multiply", "label": "Scaled" } },
      { "id": "res-1", "type": "OT-01", "position": { "x": 600, "y": 75 }, "data": { "label": "Result" } }
    ],
    "edges": [
      { "id": "e1", "source": "slider-1", "target": "math-1", "targetHandle": "in-0" },
      { "id": "e2", "source": "in-1", "target": "math-1", "targetHandle": "in-1" },
      { "id": "e3", "source": "math-1", "target": "res-1", "targetHandle": "in-0" }
    ]
  }
}
```

> [!TIP]
> All input nodes support **Units** (e.g., `px`, `deg`, `rad`). The engine will automatically handle unit conversion if a downstream node expects a specific unit.

---
title: Logic & Flow
order: 3
icon: Layers
---

# 🔘 Logic & Flow

The Logic category contains the binary and decision-making operators of the I/O System.

## 1. Logic Gate (LG-01)
The primary binary operator. It supports `AND`, `OR`, `XOR`, `NOR`, `NAND`, and `XNOR`.

```playground
{
  "nodeType": "LG-01",
  "initialData": { "op": "AND", "label": "AND Gate" },
  "height": 220
}
```

## 2. Conditional Switch (LG-02)
Standard "if-then-else" logic. It selects between two inputs based on a boolean condition.

```playground
{
  "nodeType": "baseNode",
  "initialData": { "label": "Switch" },
  "height": 200
}
```

---

## 🚀 Interactive Example: Boolean Logic
Inject this example to see how `Input Buttons` control an `AND Gate`:

```iogl-example
{
  "label": "Basic AND Circuit",
  "iogl": {
    "nodes": [
      { "id": "btn-1", "type": "IN-05", "position": { "x": 0, "y": 0 }, "data": { "value": false, "label": "A" } },
      { "id": "btn-2", "type": "IN-05", "position": { "x": 0, "y": 150 }, "data": { "value": false, "label": "B" } },
      { "id": "gate-1", "type": "LG-01", "position": { "x": 300, "y": 75 }, "data": { "op": "AND", "label": "Gate" } },
      { "id": "res-1", "type": "OT-01", "position": { "x": 600, "y": 75 }, "data": { "label": "Result" } }
    ],
    "edges": [
      { "id": "e1", "source": "btn-1", "target": "gate-1", "targetHandle": "in_a" },
      { "id": "e2", "source": "btn-2", "target": "gate-1", "targetHandle": "in_b" },
      { "id": "e3", "source": "gate-1", "target": "res-1", "targetHandle": "out" }
    ]
  }
}
```

> [!CAUTION]
> Avoid **Logical Cycles**. Connecting a node back to one of its upstream parents will trigger a `CIRCULAR_DEPENDENCY` error in the engine.

---
title: Math Nodes
order: 1
icon: Zap
---

# ➕ Math & Arithmetic

The Math category contains the fundamental arithmetic operators of the I/O System. All calculations are powered by the **MathJS Engine**, ensuring precision for both scalars and matrices.

## 1. Basic Operators (MA-01)
The Basic Math node is a multi-purpose operator that allows you to select from standard arithmetic functions.

| Function | Action | Inputs |
| :--- | :--- | :--- |
| `Add` | $A + B$ | 2 |
| `Subtract` | $A - B$ | 2 |
| `Multiply` | $A * B$ | 2 |
| `Divide` | $A / B$ | 2 |

```playground
{
  "nodeType": "MA-01",
  "initialData": { "op": "add", "label": "Add" },
  "height": 220
}
```

## 2. Power & Root (MA-02)
Specialized for exponential growth and extraction.

```playground
{
  "nodeType": "MA-01",
  "initialData": { "op": "pow", "label": "Power" },
  "height": 220
}
```

---

## 🚀 Interactive Example: Multiplication Chain
Inject this chain to see how scalars flow through a multiplication operator:

```iogl-example
{
  "label": "Multiplication Chain",
  "iogl": {
    "nodes": [
      { "id": "in-1", "type": "IN-01", "position": { "x": 0, "y": 0 }, "data": { "value": 5, "label": "Factor A" } },
      { "id": "in-2", "type": "IN-01", "position": { "x": 0, "y": 150 }, "data": { "value": 10, "label": "Factor B" } },
      { "id": "math-1", "type": "MA-01", "position": { "x": 300, "y": 75 }, "data": { "op": "multiply", "label": "Product" } },
      { "id": "res-1", "type": "OT-01", "position": { "x": 600, "y": 75 }, "data": { "label": "Result" } }
    ],
    "edges": [
      { "id": "e1", "source": "in-1", "target": "math-1", "targetHandle": "in-0" },
      { "id": "e2", "source": "in-2", "target": "math-1", "targetHandle": "in-1" },
      { "id": "e3", "source": "math-1", "target": "res-1", "targetHandle": "in-0" }
    ]
  }
}
```

> [!TIP]
> You can change the operation of the Math node at any time by clicking its dropdown in the property panel (N-Panel).

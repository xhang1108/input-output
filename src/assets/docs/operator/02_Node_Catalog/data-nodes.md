---
title: Data & Structures
order: 2
icon: Layers
---

# 📦 Data & Structures

The Data category handles the organization, extraction, and geometric manipulation of multi-dimensional data (Arrays and Vectors).

## 1. Array Builder (DT-01)
The **Array Builder** is a "Capsule" node. It can accept an unlimited number of inputs and synthesizes them into a single 1D or 2D array.

```playground
{
  "nodeType": "DT-01",
  "initialData": { "op": "BUILD", "label": "Stacker" },
  "height": 220
}
```

## 2. Array Extract (DT-02)
Extract specific elements from an array using 1D (flat) or 2D (row, col) indices.

```playground
{
  "nodeType": "DT-02",
  "initialData": { "indexMode": "1D", "label": "Picker" },
  "height": 200
}
```

## 3. Array Geometry (DT-05)
Perform vector-space operations like **Dot Product**, **Cross Product**, and **Norm (Magnitude)**.

```playground
{
  "nodeType": "MA-01",
  "initialData": { "op": "DOT", "label": "Dot Product" },
  "height": 220
}
```

---

## 🚀 Interactive Example: Vector Magnitude
Inject this circuit to calculate the length (Norm) of a 3D vector:

```iogl-example
{
  "label": "Vector Magnitude",
  "iogl": {
    "nodes": [
      { "id": "vec-in", "type": "IN-07", "position": { "x": 0, "y": 0 }, "data": { "value": "[3, 4, 0]", "label": "Vector [3,4,0]" } },
      { "id": "geom-1", "type": "DT-05", "position": { "x": 300, "y": 0 }, "data": { "op": "NORM", "label": "Magnitude" } },
      { "id": "res-1", "type": "OT-01", "position": { "x": 600, "y": 0 }, "data": { "label": "Length" } }
    ],
    "edges": [
      { "id": "e1", "source": "vec-in", "target": "geom-1", "targetHandle": "in_a" },
      { "id": "e2", "source": "geom-1", "target": "res-1", "targetHandle": "out" }
    ]
  }
}
```

> [!TIP]
> Most Data nodes are **Polymorphic**. For example, the `Array Extract` node's output handle will automatically change color (e.g., to Scalar-Yellow or Array-Blue) depending on what type of data is extracted.

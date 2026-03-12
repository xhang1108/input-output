---
title: Data & Structures
order: 4
icon: Layers
---

# Data & Structures

Organization and manipulation of multi-dimensional tensors.

## 1. Array Builder (DT-01)
Capsule node that accepts multiple inputs to build or concatenate arrays.

```playground
{
  "nodeType": "DT-01",
  "initialData": { "op": "BUILD", "label": "Array Stacker" },
  "height": 220
}
```

## 2. Array Extract (DT-02)
Extract specific elements via 1D or 2D indexing.

```playground
{
  "nodeType": "DT-02",
  "initialData": { "indexMode": "1D", "label": "Element Picker" },
  "height": 200
}
```

## 3. List Utility (DT-03)
Sort, reverse, or deduplicate 1D lists.

```playground
{
  "nodeType": "DT-03",
  "initialData": { "mode": "Sort (Asc)", "label": "List Manager" },
  "height": 200
}
```

## 4. Set Operations (DT-04)
Boolean set logic: Union, Intersection, and Difference.

```playground
{
  "nodeType": "DT-04",
  "initialData": { "mode": "Union", "label": "Set Engine" },
  "height": 200
}
```

## 5. Array Geometry (DT-05)
Vector operations: Dot Product, Cross Product, Norm, and Distance.

```playground
{
  "nodeType": "DT-05",
  "initialData": { "op": "DOT", "label": "Dot Product" },
  "height": 220
}
```

## 6. Array Split (DT-06)
Transform between arrays and discrete scalar channels.

```playground
{
  "nodeType": "DT-06",
  "initialData": { "mode": "separate", "label": "Channel Split" },
  "height": 200
}
```

## 7. Linear Algebra (DT-07)
Matrix operations: Inverse, Determinant, Transpose, and Trace.

```playground
{
  "nodeType": "DT-07",
  "initialData": { "op": "INV", "label": "Matrix Solver" },
  "height": 220
}
```

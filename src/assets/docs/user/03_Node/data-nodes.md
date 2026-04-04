---
title: Data & Structures
order: 4
---

# Data & Structures

Organization and manipulation of multi-dimensional tensors.

## 1. Array Builder (DT-01)
Node that accepts multiple inputs to build or concatenate arrays.

- **Input**: One or more data values to stack.
- **Output**: The generated Array.

```playground
{
  "nodeType": "DT-01",
  "initialData": { "op": "BUILD" }
}
```

## 2. Array Extract (DT-02)
Extract specific elements via 1D or 2D indexing.

- **Inputs**: in (Array), Idx (Scalar/Vector)
- **Output**: The extracted element.

```playground
{
  "nodeType": "DT-02",
  "initialData": { "indexMode": "1D" }
}
```

## 3. List Utility (DT-03)
Sort, reverse, or deduplicate 1D lists.

- **Input**: The input array.
- **Output**: The processed array.

```playground
{
  "nodeType": "DT-03",
  "initialData": { "mode": "Sort (Asc)" }
}
```

## 4. Set Operations (DT-04)
Boolean set logic: Union, Intersection, and Difference.

- **Inputs**: A, B
- **Output**: The resulting set array.

```playground
{
  "nodeType": "DT-04",
  "initialData": { "mode": "Union" }
}
```

## 5. Array Geometry (DT-05)
Vector operations: Dot Product, Cross Product, Norm, and Distance.

- **Inputs**: 
  - **A**: First vector array.
  - **B**: Second vector array (if applicable).
- **Outputs**: 
  - **out**: The calculated metric (scalar or vector).

```playground
{
  "nodeType": "DT-05",
  "initialData": { "op": "DOT" }
}
```

## 6. Linear Algebra (DT-06)
Matrix operations: Inverse, Determinant, Transpose, and Trace.

- **Input**: The input matrix.
- **Output**: The resulting Array or scalar.

```playground
{
  "nodeType": "DT-06",
  "initialData": { "op": "INV" }
}
```

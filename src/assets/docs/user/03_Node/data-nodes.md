---
title: Data & Structures
order: 4
---

# Data & Structures

Organization and manipulation of multi-dimensional tensors.

## 1. Array Builder (DT-01)
Accepts multiple inputs to build or concatenate arrays. You can choose to stack inputs along rows or columns.

- **Input**: One or more data values (Scalars or Arrays) to stack into a capsule handle.
- **Output**: The generated Array.

```playground
{
  "nodeType": "DT-01",
  "initialData": { "axis": 0 }
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
  "initialData": { "mode": "DOT" }
}
```

## 6. Array Calculus (DT-06)
Advanced linear algebra operations for square and non-square matrices.

- **Input**: The input array.
- **Output**: The resulting Array or scalar.

**Supported Operations**:
*   **Inverse (A⁻¹)**: Standard matrix inversion.
*   **Determinant (det A)**: Scalar value representing multiplication factor.
*   **Transpose (Aᵀ)**: Reflects a matrix over its main diagonal.
*   **Trace (tr A)**: Sum of elements on the main diagonal.
*   **Eigenvalues**: Spectral decomposition for symmetric matrices.
*   **QR / LU Decomposition**: Matrix factorization for solving linear systems.

```playground
{
  "nodeType": "DT-06",
  "initialData": { "mode": "INV" }
}
```

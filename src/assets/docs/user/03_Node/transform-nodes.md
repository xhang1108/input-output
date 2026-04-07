---
title: Transform & Analysis
order: 7
---

# Transform & Analysis

The Transform and Analysis category provides advanced mathematical tools for geometry, vector spaces, signal processing, and statistics. 

## 1. Unit Converter (TR-01)
Automatically converts a raw, dimensionless scalar into a typed physical unit representation. In this calculator, the unit becomes a small symbol in the bottom right corner and is not treated as a string. You can create any custom symbol.

- **Input**: The numeric scalar value to convert.
- **Output**: The value with the attached unit representation.

| Parameters | Function |
| :--- | :--- |
| **Unit** | Standard preset (m, cm, kg, lb, s) or Custom. |
| **Custom Unit** | String suffix appended to the result. |

```playground
{
  "nodeType": "TR-01",
  "initialData": { "unit": "km" }
}
```

## 2. Base Converter (TR-02)
Transforms floating-point or integer decimal values into strings formatted under a specified mathematical base representation.

- **Input**: The numeric decimal value.
- **Output**: The string result in the target base (e.g., binary, hex).

**Supported Bases:**
- Decimal (10)
- Hexadecimal (16)
- Binary (2)
- Octal (8)
- Duodecimal (12)

```playground
{
  "nodeType": "TR-02"
}
```

## 3. Geometry (TR-03)
Calculates core Euclidean metrics for standard planar shapes from a single input radius/dimension.

- **Inputs**: 
  - **In A**: First dimension (e.g., radius, width).
  - **In B**: Second dimension (e.g., height) if applicable.
- **Outputs**: 
  - **Area**: Calculated surface area.
  - **Perim**: Calculated perimeter or circumference.

**Parameters**: `Circle`, `Rectangle / Square` (Quad), `Triangle`. Outputs both **Area** and **Perimeter** separately.

```playground
{
  "nodeType": "TR-03"
}
```

## 4. Vector Field (TR-04)
Evaluates a multi-variable scalar or vector function to generate advanced field representations.

- **Inputs**: 
  - **f**: Scalar function (for Gradient mode).
  - **P, Q**: Vector components (for Direct, Divergence, or Curl modes).
- **Outputs**: 
  - **Arrows**: Vector field data (formatted for Plotting).
  - **Result**: Symbolic expression of the resulting field (e.g., the Divergence scalar).

**Supported Modes**:
*   **Gradient**: Calculates the vector gradient (∇f) of a scalar field.
*   **Direct Field**: Maps user-defined P and Q components directly to a vector grid.
*   **Divergence (div F)**: Measures the magnitude of a field's source or sink (∇·F).
*   **Curl (2D)**: Measures the rotation of a 2D field at a point (∇×F).

```playground
{
  "nodeType": "TR-04",
  "initialData": { "mode": "gradient", "var1": "x", "var2": "y" }
}
```

## 5. Signal Smoothing (TR-05)
Implements a rolling window average to flatten noise over an incoming one-dimensional array or time-series vector. Best paired with Random `IN-10` uniform distributions to visualize signal damping.

- **Input**: The array of noisy data.
- **Output**: The smoothed array.

```playground
{
  "nodeType": "TR-05"
}
```

## 6. Statistics (TR-06)
Reduces a one-dimensional Array or multi-dimensional Array dataset down to its statistical essence.

- **Input**: The input Array.
- **Output**: The calculated statistical value.

| Operation | Equation / Logic |
| :--- | :--- |
| **Mean** | Average of all values |
| **Median** | Central 50th percentile rank |
| **Sum** | Cumulative aggregation |
| **Min / Max** | Outlier boundaries |
| **Std Deviation** | Dispersion measure |
| **Variance** | Squared dispersion |

```playground
{
  "nodeType": "TR-06",
  "initialData": { "mode": "Mean" }
}
```

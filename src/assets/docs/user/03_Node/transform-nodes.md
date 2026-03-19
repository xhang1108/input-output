---
title: Transform & Analysis
order: 7
icon: BarChart2
---

# Transform & Analysis

The Transform and Analysis category provides advanced mathematical tools for geometry, vector spaces, signal processing, and statistics. 

## 1. Unit Converter (TR-01)
Automatically converts a raw, dimensionless scalar into a typed physical unit representation. It supports standard SI and Imperial units as well as custom strings (e.g., `m/s`, `N*m`, `Pascal`).

- **Input**: The numeric scalar value to convert.
- **Output**: The value with the attached unit representation.

| Parameters | Function |
| :--- | :--- |
| **Unit** | Standard preset (m, cm, kg, lb, s) or Custom. |
| **Custom Unit** | String suffix appended to the result. |

```playground
{
  "nodeType": "TR-01",
  "initialData": { "unit": "km", "label": "Distance" }
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

## 3. Geometry (TR-03)
Calculates core Euclidean metrics for standard planar shapes from a single input radius/dimension.

- **Inputs**: 
  - **In A**: First dimension (e.g., radius, width).
  - **In B**: Second dimension (e.g., height) if applicable.
- **Outputs**: 
  - **Area**: Calculated surface area.
  - **Perim**: Calculated perimeter or circumference.

**Parameters**: `Circle`, `Rectangle / Square` (Quad), `Triangle`. Outputs both **Area** and **Perimeter** separately.

## 4. Vector Field (TR-04)
Evaluates a multi-variable function (e.g., f(x, y)) to generate either a gradient tensor or a direct vector field tensor for Plotting or advanced geometry operations.

- **Input**: The target function (e.g., x^2 + y^2).
- **Outputs**: 
  - **Arrows**: Vector field data (ready for 3D/Plotter use).
  - **Grad**: Calculated gradient field.

- **Mode**: Gradient mapping or Direct Vector Mapping.
- **Range X / Y**: Box bounding conditions.
- **Density**: Lattice resolution. 

## 5. Signal Smoothing (TR-05)
Implements a rolling window average to flatten noise over an incoming one-dimensional array or time-series vector. Best paired with Random `IN-10` uniform distributions to visualize signal damping.

- **Input**: The array of noisy data.
- **Output**: The smoothed array.

## 6. Statistics (TR-06)
Reduces a one-dimensional array or matrix dataset down to its statistical essence.

- **Input**: The input array or matrix.
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
  "initialData": { "op": "Mean", "label": "Stats Engine" },
  "height": 220
}
```

---
title: Math Nodes
order: 3
---

# Math & Arithmetic

The Math category contains the fundamental arithmetic operators of the I/O System.

## 1. Basic Math (MA-01)
Multi-purpose arithmetic operator for addition, subtraction, multiplication, and division.

- **Inputs**: A, B
- **Output**: Result

```playground
{
  "nodeType": "MA-01",
  "initialData": { "mode": "ADD" }
}
```

## 2. Advanced Math (MA-02)
Specialized for exponential growth, extraction, and basic value manipulation. 

- **Inputs**: 
  - **A**: The primary value.
  - **B**: The exponent (Power) or root index (Root). Inherently hidden in *Absolute*, *Negate*, or *Sign* modes.
- **Output**: The calculated result.

**Supported Operations**:
*   **Power (xⁿ)**: Raise A to the power of B.
*   **Square Root (√x)**: The square root of A.
*   **Absolute Value (|x|)**: The magnitude of A regardless of sign.
*   **Negate (−x)**: Flip the sign of A (A × -1).
*   **Sign**: Returns 1 if A > 0, -1 if A < 0, and 0 if A = 0.

```playground
{
  "nodeType": "MA-02",
  "initialData": { "mode": "POW" }
}
```

## 3. Logarithm (MA-03)
Calculates Natural Log (ln), log10, log2, or Log base n.

- **Inputs**: 
  - **x**: The value to calculate the logarithm for.
  - **Base**: The base of the logarithm (Log base n mode).
- **Output**: The calculated logarithm.

```playground
{
  "nodeType": "MA-03",
  "initialData": { "mode": "LN" }
}
```

## 4. Trigonometry (MA-04)
Calculates circular, inverse, and hyperbolic functions.

- **Input**: The numeric angle or value (Radians by default).
- **Output**: The calculated trigonometric result.

**Supported Modes**:
*   **Circular**: Sine, Cosine, Tangent.
*   **Inverse**: Arcsine, Arccosine, Arctangent, and Atan2(y, x).
*   **Hyperbolic**: Sinh, Cosh.

```playground
{
  "nodeType": "MA-04",
  "initialData": { "mode": "SIN" }
}
```

## 5. Round / Precision (MA-05)
Standard math rounding tools: `Round`, `Floor`, `Ceiling`, and `Truncate`.

- **Input**: The numeric value to round.
- **Output**: The rounded value based on the specified precision.

```playground
{
  "nodeType": "MA-05",
  "initialData": { "mode": "ROUND" }
}
```

## 6. Fraction (MA-06)
Decomposes a floating point number into its integer and fractional parts.

- **Input**: The numeric value to decompose.
- **Outputs**: 
  - **int**: The integer part.
  - **n**: The numerator of the fraction.
  - **d**: The denominator (always simplified).
  - **Text**: Human-readable fraction string.

```playground
{
  "nodeType": "MA-06",
  "initialData": { }
}
```

## 7. Divisibility & Primes (MA-07)
Includes `GCD`, `LCM`, `Modulo`, and a primality test.

- **Inputs**: 
  - **A**: First integer.
  - **B**: Second integer.
- **Output**: The result of the selected operation (e.g., GCD value or true/false for Prime test).

```playground
{
  "nodeType": "MA-07",
  "initialData": { "mode": "GCD" }
}
```

## 8. Combinatorics (MA-08)
Calculates Combinations C(n, r), Permutations P(n, r), and Factorials n!.

- **Inputs**: 
  - **n**: Total items.
  - **r**: Selection size.
- **Output**: The calculated count.

```playground
{
  "nodeType": "MA-08",
  "initialData": { "mode": "nCr" }
}
```

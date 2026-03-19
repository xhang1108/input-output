---
title: Math Nodes
order: 3
icon: Zap
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
  "initialData": { "op": "ADD", "label": "Add" },
  "height": 220
}
```

## 2. Advanced Math (MA-02)
Specialized for exponential growth and extraction. Supports operations like **Power** (x^n) and **Square Root** (sqrt(x)).

- **Inputs**: 
  - **A**: The base value.
  - **B**: The exponent (Power) or root index (Root).
- **Output**: The calculated value.

```playground
{
  "nodeType": "MA-02",
  "initialData": { "op": "POW", "label": "Power" },
  "height": 220
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
  "initialData": { "op": "LN", "label": "Natural Log" },
  "height": 200
}
```

## 4. Trigonometry (MA-04)
Calculates circular and hyperbolic functions like Sine, Cosine, and Tangent.

- **Input**: The numeric value to calculate.
- **Output**: The calculated trigonometric result.

```playground
{
  "nodeType": "MA-04",
  "initialData": { "op": "SIN", "label": "Sine" },
  "height": 220
}
```

## 5. Round / Precision (MA-05)
Standard math rounding tools: `Round`, `Floor`, `Ceiling`, and `Truncate`.

- **Input**: The numeric value to round.
- **Output**: The rounded value based on the specified precision.

```playground
{
  "nodeType": "MA-05",
  "initialData": { "op": "ROUND", "label": "Rounding" },
  "height": 220
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
  "initialData": { "label": "Fraction" },
  "height": 180
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
  "initialData": { "op": "GCD", "label": "GCD" },
  "height": 200
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
  "initialData": { "op": "NCR", "label": "Combinations" },
  "height": 200
}
```

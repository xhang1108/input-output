---
title: Math Nodes
order: 3
icon: Zap
---

# Math & Arithmetic

The Math category contains the fundamental arithmetic operators of the I/O System.

## 1. Basic Math (MA-01)
Multi-purpose arithmetic operator for addition, subtraction, multiplication, and division.

```playground
{
  "nodeType": "MA-01",
  "initialData": { "op": "ADD", "label": "Add" },
  "height": 220
}
```

## 2. Advanced Math (MA-02)
Specialized for exponential growth and extraction. Supports operations like **Power** ($x^n$) and **Square Root** ($\sqrt{x}$).

```playground
{
  "nodeType": "MA-02",
  "initialData": { "op": "POW", "label": "Power" },
  "height": 220
}
```

## 3. Logarithm (MA-03)
Calculates Natural Log ($\ln$), $\log_{10}$, $\log_2$, or Log base $n$.

```playground
{
  "nodeType": "MA-03",
  "initialData": { "op": "LN", "label": "Natural Log" },
  "height": 200
}
```

## 4. Trigonometry (MA-04)
Circular and hyperbolic functions like Sine, Cosine, and Tangent.

```playground
{
  "nodeType": "MA-04",
  "initialData": { "op": "SIN", "label": "Sine" },
  "height": 220
}
```

## 5. Round / Precision (MA-05)
Standard math rounding tools: `Round`, `Floor`, `Ceiling`, and `Truncate`.

```playground
{
  "nodeType": "MA-05",
  "initialData": { "op": "ROUND", "label": "Rounding" },
  "height": 220
}
```

## 6. Fraction (MA-06)
Decomposes a floating point number into its integer and fractional parts.

```playground
{
  "nodeType": "MA-06",
  "initialData": { "label": "Fraction" },
  "height": 180
}
```

## 7. Divisibility & Primes (MA-07)
Includes `GCD`, `LCM`, `Modulo`, and a primality test.

```playground
{
  "nodeType": "MA-07",
  "initialData": { "op": "GCD", "label": "GCD" },
  "height": 200
}
```

## 8. Combinatorics (MA-08)
Calculates Combinations $C(n,r)$, Permutations $P(n,r)$, and Factorials $n!$.

```playground
{
  "nodeType": "MA-08",
  "initialData": { "op": "NCR", "label": "Combinations" },
  "height": 200
}
```

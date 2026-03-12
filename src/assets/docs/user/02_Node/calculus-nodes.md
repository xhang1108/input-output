---
title: Calculus & Physics
order: 6
icon: Zap
---

# Calculus & Physics

Advanced continuous analysis and physical simulations.

## 1. Derivative (CL-01)
Calculates the rate of change of a symbolic expression.

```playground
{
  "nodeType": "CL-01",
  "initialData": { "variable": "x", "order": 1, "label": "df/dx" },
  "height": 200
}
```

## 2. Integral (CL-02)
Calculates the area under a curve. Supporting definite and indefinite modes.

```playground
{
  "nodeType": "CL-02",
  "initialData": { "mode": "indefinite", "variable": "x", "label": "integral f(x)" },
  "height": 220
}
```

## 3. Limit (CL-03)
Calculates the numerical limit of an expression as it approaches a value.

```playground
{
  "nodeType": "CL-03",
  "initialData": { "variable": "x", "approach": "0", "label": "Limit" },
  "height": 200
}
```

## 4. Equation Solver (CL-04)
Input a symbolic equation to find its roots.

```playground
{
  "nodeType": "CL-04",
  "initialData": { "label": "Roots Solver" },
  "height": 200
}
```

## 5. ODE Solver (CL-05)
Numerical differential equation solver (RK4/Euler).

```playground
{
  "nodeType": "CL-05",
  "initialData": { "method": "RK4", "tEnd": 10, "label": "ODE Engine" },
  "height": 220
}
```

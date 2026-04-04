---
title: Calculus & Physics
order: 6
---

# Calculus & Physics

Advanced continuous analysis and physical simulations.

## 1. Derivative (CL-01)
Calculates the rate of change of a symbolic expression.

- **Input**: The symbolic expression to differentiate.
- **Output**: The derivative of the expression.
Calculates the rate of change of a symbolic expression.

- **Input**: The symbolic expression to differentiate.
- **Output**: The derivative of the expression.

```playground
{
  "nodeType": "CL-01",
  "initialData": { "variable": "x", "order": 1 }
}
```

## 2. Integral (CL-02)
Calculates the area under a curve. Supporting definite and indefinite modes.

- **Input**: The symbolic expression to integrate.
- **Output**: The definite or indefinite integral.

```playground
{
  "nodeType": "CL-02",
  "initialData": { "mode": "indefinite", "variable": "x" }
}
```

## 3. Limit (CL-03)
Calculates the numerical limit of an expression as it approaches a value.

- **Input**: The symbolic expression.
- **Output**: The numeric limit value.

```playground
{
  "nodeType": "CL-03",
  "initialData": { "variable": "x", "approach": "0" }
}
```

## 4. Equation Solver (CL-04)
Input a symbolic equation to find its roots.

- **Input**: One or more symbolic equations.
- **Output**: The solution(s) for the specified variable.

```playground
{
  "nodeType": "CL-04",
  "initialData": { }
}
```

## 5. ODE Solver (CL-05)
Numerical differential equation solver (RK4/Euler).

- **Input**: The differential equation in terms of t and y.
- **Output**: An Array of (t, y) coordinates representing the solution.

```playground
{
  "nodeType": "CL-05",
  "initialData": { "method": "RK4", "tEnd": 10 }
}
```

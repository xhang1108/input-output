---
title: Calculus & Physics
order: 4
icon: Zap
---

# 🌌 Calculus & Physics

The Calculus category provides continuous symbolic and numerical analysis, enabling the creation of dynamic systems and physical simulations.

## 1. Derivative (CL-01)
Calculates the rate of change of a symbolic expression with respect to a variable.

```playground
{
  "nodeType": "CL-01",
  "initialData": { "variable": "x", "order": 1, "label": "df/dx" },
  "height": 200
}
```

## 2. Integral (CL-02)
Calculates the area under a curve. Supports both **Indefinite (∫f dx)** and **Definite (∫ₐᵇ f dx)** modes.

```playground
{
  "nodeType": "CL-02",
  "initialData": { "mode": "indefinite", "variable": "x", "label": "∫ f(x)" },
  "height": 220
}
```

## 3. Equation Solver (CL-04)
A powerful multi-variable solver. Input a symbolic equation (e.g., `x^2 + 5x + 6 = 0`) and the node will output the roots.

```playground
{
  "nodeType": "CL-04",
  "initialData": { "label": "Solver" },
  "height": 200
}
```

---

## 🚀 Interactive Example: Harmonic Oscillator
Inject this differential setup to solve a basic harmonic motion equation ($y'' + k*y = 0$):

```iogl-example
{
  "label": "Harmonic Oscillator",
  "iogl": {
    "nodes": [
      { "id": "expr-1", "type": "IN-09", "position": { "x": 0, "y": 0 }, "data": { "code": "-(k/m)*y", "label": "f(t,y)" } },
      { "id": "ode-1", "type": "CL-05", "position": { "x": 300, "y": 0 }, "data": { "method": "RK4", "tEnd": 20, "y0": 1, "label": "ODE Solver" } },
      { "id": "plot-1", "type": "OT-03", "position": { "x": 600, "y": 0 }, "data": { "label": "Phase Plot" } }
    ],
    "edges": [
      { "id": "e1", "source": "expr-1", "target": "ode-1", "targetHandle": "expr" },
      { "id": "e2", "source": "ode-1", "target": "plot-1", "targetHandle": "in" }
    ]
  }
}
```

> [!NOTE]
> Symbols like $t$ and $y$ are reserved for the `ODE Solver`. For generic calculus, you can define your own symbols (e.g., $u$, $v$, $\theta$) in the `Derivative` node's parameter panel.

---
title: Output Nodes
order: 2
icon: Wrench
---

# Input Operators

Input nodes are the "Senses" of your calculation. They provide the initial data that flows through your IOGL blueprint.

## 1. Number Input (IN-01)
The simplest input node. Type a number or use the scroll wheel to increment/decrement.

```playground
{
  "nodeType": "IN-01",
  "initialData": { "value": 42, "unit": "rad", "label": "Initial Theta" },
  "height": 200
}
```

## 2. Slider (IN-02)
Use the Slider for continuous real-time modulation. Perfect for tuning physical parameters or color values.

```playground
{
  "nodeType": "IN-02",
  "initialData": { "value": 0.5, "min": 0, "max": 1, "step": 0.01, "label": "Modulator" },
  "height": 220
}
```

## 3. Color (IN-03)
Pick a color and output it as a HEX string or an RGB/Vec3 vector.

```playground
{
  "nodeType": "IN-03",
  "initialData": { "value": "#3b82f6", "label": "Color Picker" },
  "height": 180
}
```

## 4.| `str` | IN-04 | String | `(S) out: string` — ⚠️ **LITERAL TEXT ONLY.** Does not evaluate formulas. |
Inject a static text string into the calculation flow.

> [!IMPORTANT]
> This node is for **literal text only**. It does not evaluate mathematical expressions or formulas. For symbolic calculus or math strings, use the **Expression (IN-09)** node.

```playground
{
  "nodeType": "IN-04",
  "initialData": { "value": "Hello World", "label": "Label" },
  "height": 160
}
```

## 5. Button (IN-05)
A simple boolean trigger. Supports **Sticky (toggle)** and **Momentary (hold)** modes.

```playground
{
  "nodeType": "IN-05",
  "initialData": { "label": "Trigger" },
  "height": 160
}
```

## 6. Constant (IN-06)
Provide mathematical constants like pi, e, phi, and tau.

```playground
{
  "nodeType": "IN-06",
  "initialData": { "val": "pi", "label": "Pi" },
  "height": 160
}
```

## 7. Array Input (IN-07)
Define 2D data structures. Matrices are represented in IOGL using JSON bracket notation.

```playground
{
  "nodeType": "IN-07",
  "initialData": { "rawExpression": "[[0,0,0],[0,0,0],[0,0,0]]", "label": "Matrix Input", "width": 152, "height": 160 },
  "height": 240
}
```

## 8. Abacus (IN-08)
A physical-computing inspired input for large integers.

```playground
{
  "nodeType": "IN-08",
  "initialData": { "label": "Abacus" },
  "width": 240,
  "height": 140
}
```

## 9. Expression (IN-09)
**Symbolic only.** Provides a static string for Calculus nodes. It has NO input handles.

```playground
{
  "nodeType": "IN-09",
  "initialData": { "code": "x^2 + sin(x)", "label": "Formula" },
  "height": 160
}
```

## 10. Random (IN-10)
A high-performance stochastic generator that consolidates noise and distribution logic. It supports four major statistical models and three output architectures.

### Supported Distributions
*   **Uniform**: Standard range between `Min` and `Max`.
*   **Normal (Gaussian)**: Bell-curve logic defined by `Mean` and `StdDev`.
*   **Poisson**: Discrete event frequency defined by `Lambda`. (Floating Point is disabled as Poisson is strictly discrete).
*   **Exponential**: Decay/Wait-time model defined by `Lambda`.

### Output Modes
*   **Scalar**: Single number output.
*   **Vector**: 1D Array defined by `Length`.
*   **Matrix**: 2D Array defined by `Rows` x `Cols`.

> [!NOTE]
> All random values are **deterministic**! They are governed by an internal `seed` that only changes when you click **Regenerate** or modify parameters. This ensures your graph results don't "jump" unexpectedly.

```playground
{
  "nodeType": "IN-10",
  "initialData": { "mode": "scalar", "distribution": "Uniform", "label": "Stochastic Gen" },
  "height": 335
}
```

---

## Interactive Example: Slider Modulation
Inject this example to see a Slider modulate a multiplication circuit:

```iogl-example
{
  "label": "Slider Circuit",
  "iogl": {
    "nodes": [
      { "id": "slider-1", "type": "IN-02", "position": { "x": 0, "y": 0 }, "data": { "value": 0.5, "min": 0, "max": 1, "step": 0.01, "label": "Control" } },
      { "id": "in-1", "type": "IN-01", "position": { "x": 0, "y": 150 }, "data": { "value": 100, "label": "Base" } },
      { "id": "math-1", "type": "MA-01", "position": { "x": 300, "y": 75 }, "data": { "op": "MUL", "label": "Scaled" } },
      { "id": "res-1", "type": "OT-01", "position": { "x": 600, "y": 75 }, "data": { "label": "Result" } }
    ],
    "edges": [
      { "id": "e1", "source": "slider-1", "target": "math-1", "targetHandle": "in_a" },
      { "id": "e2", "source": "in-1", "target": "math-1", "targetHandle": "in_b" },
      { "id": "e3", "source": "math-1", "target": "res-1", "targetHandle": "in" }
    ]
  }
}
```

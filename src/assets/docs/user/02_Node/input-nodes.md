---
title: Output Nodes
order: 2
icon: Wrench
---

# Input Operators

Input nodes are the "Senses" of your calculation. They provide the initial data that flows through your IOGL blueprint.

## 1. Number Input (IN-01)
The simplest input node. Type a number or use the scroll wheel to increment/decrement.

- **Output**: The numeric value entered.

```playground
{
  "nodeType": "IN-01",
  "initialData": { "value": 42, "unit": "rad", "label": "Initial Theta" },
  "height": 200
}
```

## 2. Slider (IN-02)
Use the Slider for continuous real-time modulation. Perfect for tuning physical parameters or color values.

- **Output**: The current value of the slider.

```playground
{
  "nodeType": "IN-02",
  "initialData": { "value": 0.5, "min": 0, "max": 1, "step": 0.01, "label": "Modulator" },
  "height": 220
}
```

## 3. Color (IN-03)
Pick a color and output it as a HEX string or an RGB/Vec3 vector.

- **Outputs**: 
  - **HEX**: The color as a hex string (e.g., #3b82f6).
  - **RGB**: The color as an array of [R, G, B] (0-255).
  - **Vec3**: The color as an array of [R, G, B] (0.0-1.0).

```playground
{
  "nodeType": "IN-03",
  "initialData": { "value": "#3b82f6", "label": "Color Picker" },
  "height": 180
}
```

## 4. String (IN-04)
Inject a static text string into the calculation flow.

- **Output**: The literal text string.


```playground
{
  "nodeType": "IN-04",
  "initialData": { "value": "Hello World", "label": "Label" },
  "height": 160
}
```

## 5. Button (IN-05)
A simple boolean trigger. Supports **Sticky (toggle)** and **Momentary (hold)** modes.

- **Output**: A boolean value (true/false).

```playground
{
  "nodeType": "IN-05",
  "initialData": { "label": "Trigger" },
  "height": 160
}
```

## 6. Constant (IN-06)
Provide mathematical constants like pi, e, phi, and tau.

- **Output**: The numeric value of the selected constant.

```playground
{
  "nodeType": "IN-06",
  "initialData": { "val": "pi", "label": "Pi" },
  "height": 160
}
```

## 7. Array Input (IN-07)
Define 2D data structures. Matrices are represented in IOGL using JSON bracket notation.

- **Output**: The defined array or matrix.

```playground
{
  "nodeType": "IN-07",
  "initialData": { "rawExpression": "[[0,0,0],[0,0,0],[0,0,0]]", "label": "Matrix Input", "width": 152, "height": 160 },
  "height": 240
}
```

## 8. Abacus (IN-08)
A physical-computing inspired input for large integers.

- **Output**: The numeric value represented by the abacus beads.

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

- **Output**: The symbolic expression string.

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

```playground
{
  "nodeType": "IN-10",
  "initialData": { "mode": "scalar", "distribution": "Uniform", "label": "Stochastic Gen" },
  "height": 335
}
```


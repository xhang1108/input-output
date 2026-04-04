---
title: Input Nodes
order: 1
---

# Input Operators

Input nodes are the "Senses" of your calculation. They provide the initial data that flows through your IOGL blueprint.

## 1. Number Input (IN-01)
The simplest input node. Type a number or use the keyboard to increment/decrement.

- **Output**: The numeric value entered.

```playground
{
  "nodeType": "IN-01",
  "initialData": { "value": 42, "unit": "rad" }
}
```

## 2. Slider (IN-02)
Use the Slider for continuous real-time modulation. Perfect for tuning physical parameters or color values. You can set the *min*, *max*, and *step* values to control the slider's range and precision.

- **Output**: The current value of the slider.

```playground
{
  "nodeType": "IN-02",
  "initialData": { "value": 0.5, "min": 0, "max": 1, "step": 0.01 }
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
  "initialData": { "value": "#3b82f6" }
}
```

## 4. String (IN-04)
Inject a static text string into the calculation flow.

- **Output**: The literal text string.


```playground
{
  "nodeType": "IN-04",
  "initialData": { "value": "Hello World" }
}
```

## 5. Button (IN-05)
A simple boolean trigger. Supports **Sticky (toggle)** and **Momentary (hold)** modes.

- **Output**: A boolean value (true/false).

```playground
{
  "nodeType": "IN-05",
  "initialData": { }
}
```

## 6. Constant (IN-06)
Provide mathematical constants like pi, e, phi, and tau.

- **Output**: The numeric value of the selected constant.

```playground
{
  "nodeType": "IN-06",
  "initialData": { "val": "pi" }
}
```

## 7. Array Input (IN-07)
Define 2D data structures.

- **Output**: The defined Array.

```playground
{
  "nodeType": "IN-07",
  "initialData": { "rawExpression": "[[0,0,0],[0,0,0],[0,0,0]]", "width": 152, "height": 160 }
}
```

## 8. Abacus (IN-08)
A node that exists for fun, maybe one day someone will need it.

- **Output**: The numeric value represented by the abacus beads.

```playground
{
  "nodeType": "IN-08",
  "initialData": { },
  "width": 240
}
```

## 9. Expression (IN-09)
Used to create nodes we haven't preset. You can understand our library to write the formulas you need. This is also the node used to connect to the solver node.

- **Output**: The symbolic expression string.

```playground
{
  "nodeType": "IN-09",
  "initialData": { "code": "x^2 + sin(x)" }
}
```

## 10. Random (IN-10)
A stochastic generator that consolidates noise and distribution logic. It supports four major statistical models and three output architectures.

### Supported Distributions
*   **Uniform**: Standard range between `Min` and `Max`.
*   **Normal (Gaussian)**: Bell-curve logic defined by `Mean` and `StdDev`.
*   **Poisson**: Discrete event frequency defined by `Lambda`. (Floating Point is disabled as Poisson is strictly discrete).
*   **Exponential**: Decay/Wait-time model defined by `Lambda`.

### Output Modes
*   **Scalar**: Single number output.
*   **Vector**: 1D Array defined by `Length`.
*   **Array (2D)**: 2D data structure defined by `Rows` x `Cols`.

```playground
{
  "nodeType": "IN-10",
  "initialData": { "mode": "scalar", "distribution": "Uniform" }
}
```


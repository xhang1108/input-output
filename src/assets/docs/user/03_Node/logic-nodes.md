---
title: Logic & Flow
order: 5
icon: Layers
---

# Logic & Flow

The Logic category contains the binary and decision-making operators of the I/O System.

## 1. Logic Gate (LG-01)
The primary binary operator. It supports `AND`, `OR`, `XOR`, `NOR`, `NAND`, and `XNOR`.

- **Inputs**: A, B
- **Output**: The result of the boolean operation.

```playground
{
  "nodeType": "LG-01",
  "initialData": { "op": "AND" }
}
```

## 2. Conditional Switch (LG-02)
Standard "if-then-else" logic. It selects between two inputs based on a boolean condition.

- **Inputs**: Condition, True, False
- **Output**: The selected value.

```playground
{
  "nodeType": "LG-02",
  "initialData": { }
}
```

## 3. Logic Split (LG-03)
Routes a single data stream into one of two output channels based on a condition. Perfect for complex multi-branch IOGL circuits.

- **Inputs**: Data, Condition
- **Outputs**: 
  - **A**: Output channel if condition is true.
  - **B**: Output channel if condition is false.

```playground
{
  "nodeType": "LG-03",
  "initialData": { }
}
```



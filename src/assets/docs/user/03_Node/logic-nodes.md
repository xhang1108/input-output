---
title: Logic & Flow
order: 5
icon: Layers
---

# Logic & Flow

The Logic category contains the binary and decision-making operators of the I/O System.

## 1. Logic Gate (LG-01)
The primary operator for binary logic and value comparisons. It supports **13 modes** including `AND`, `OR`, `NOT`, `NAND`, `NOR`, `XOR`, `XNOR`, and comparison operators (`==`, `!=`, `>`, `<`, `>=`, `<=`).

> [!IMPORTANT]
> **Strict Binary Logic**: For logical gates (AND, OR, etc.), the system uses an *Active High* standard. A signal is only "True" if it is **exactly 1** or `true`. All other values (e.g. `2`, `0.5`) are treated as `false`.

- **Inputs**: A, B
- **Output**: The result of the operation (boolean).

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



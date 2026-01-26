# 📦 Calctopus Data Payload Specification

This document defines how data and symbols travel between nodes.

## 🎯 Requirements
- **Symbolic Truth**: Every node must contribute to a LaTeX expression.
- **Numerical Performance**: High-speed calculation (matrices, scientific).
- **Unit Metadata**: Carrying physical units (km, kg, $) through the wires.
- **Visual Mapping**: Data types map to wire colors (Blender style).

## 🧬 Proposed Payload Structure

### Candidate A: The "Soul & Body" Object
Every connection carries an object that contains both the symbolic string and the calculated data.

```typescript
interface NodePayload {
  latex: string;      // The "Soul" - For display and symbolic ops
  ast: object;        // The "Blood" - For raw computation speed
  value: any;         // The "Cache" - Numerical result for UI
  unit: string | null;// The "Context" - Physical unit
  type: DataType;     // The "Shape" - Scalar, Matrix, etc.
}
```

---

## 🎭 The "Better than LaTeX" Question: LaTeX vs. AST

| Feature | LaTeX (String) | AST (Abstract Syntax Tree) |
| :--- | :--- | :--- |
| **Human Readable** | 100% (The Goal) | 0% (Developer only) |
| **Logic Speed** | Slow (Needs Parsing) | **Fast** (Native to MathJS) |
| **Complexity** | High (Syntax errors) | Low (Structurally rigid) |
| **Verdict** | Use for **UI & Export** | Use for **Internal Engine** |

---

## ⏳ Undo & History (Scheme B)
- **Concept**: Action Path / Command Pattern.
- **Logic**: Record `commands` (e.g., `UpdateValue`, `LinkNodes`) instead of `states`.
- **Granularity**: Allows undoing every tiny character change or node movement.

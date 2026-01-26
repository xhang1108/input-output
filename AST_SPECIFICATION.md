# 🌳 Calctopus AST Specification (The "Skeleton")

This document defines the structure of the internal Abstract Syntax Tree (AST) used for computation.

## 🎯 Purpose
- **Speed**: Unlike LaTeX (which requires parsing), AST is a direct tree structure that can be traversed instantly.
- **Precision**: Eliminates semantic ambiguity present in string-based expressions.
- **Compatibility**: Maps 1:1 to MathJS and Algebrite internal representations.

## 🧬 AST Node Structure

```typescript
type ASTNode = 
  | ScalarNode 
  | OperatorNode 
  | FunctionNode 
  | UnitNode 
  | MatrixNode;

interface OperatorNode {
  type: 'operator';
  op: '+' | '-' | '*' | '/' | '^';
  args: ASTNode[];
  latexTemplate: string; // e.g., "{0} + {1}"
}
```

---

## 📝 Discussion Log
- **[2026-01-26]**: Initial discussion. Goal is to use AST as the internal "Blood" (computation) while keeping LaTeX as the "Soul" (display).

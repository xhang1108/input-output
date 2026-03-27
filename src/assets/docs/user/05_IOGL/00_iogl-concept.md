---
title: IOGL
order: 0
icon: Layers
---

# IOGL: The Language of Systems

**Input-Output Graph Language (IOGL)** is the universal language of our workspace. It is the bridge between human logic and the calculation engine.

## 1. What is IOGL?

Think of IOGL as **Digital Lego Instructions**.
- When you place a node, you are defining a **Part**.
- When you connect two nodes, you are defining a **Stud**.
- The entire graph is a **Blueprint (Recipe)** that can be saved, shared, and rebuilt instantly.

In technical terms, IOGL is a serialization format that converts your visual canvas into a mathematical graph.

## 2. Why IOGL?

- **Deterministic**: A recipe always produces the same behavior.
- **Portable**: Your complex math models are just small text files.
- **Collaborative**: Your can sync your canvas across devices in real-time.

---

# 🤖 For AI & Developers: IOGL Scribe (V1)

If you want an AI (like ChatGPT or Antigravity) to build a system for you, you can feed it the **IOGL Skill**.

### The IOGL Scribe (AI Master Prompt)

Copy and paste the block below into any AI chat to teach it IOGL 1.0. 

```text
# SYSTEM PROMPT: IOGL 1.0 PROTOCOL (UNIFIED NODE ENGINE)
⚠️ CRITICAL: IOGL IS A DECLARATIVE GRAPH LANGUAGE. 
IGNORE ALL PROGRAMMING CONCEPTS LIKE LOOPS OR VARIABLES. 

### 🧠 THE MENTAL FRAMEWORK: "WIRING THE BRAIN"
1. **NODE DECLARATION**: `[Label] Type Data/Mode @X,Y`
   - `[num1] IN-01 42` (Scalar input)
   - `[add] MA-01 { mode: "ADD" }` (Operation node)
2. **POSITIONAL HANDLES**: Use `.a`, `.b`, `.c` shorthand.
   - `.a` maps to `in_a` (input) or `out_a` (output).
3. **WIRING**: `Source.handle -> Target.handle`
   - `num1.a -> add.a`

### 🎨 NODE CATALOG (V1 STANDARD)
- **IN-01 (Number)**: `[n] IN-01 10`
- **IN-09 (Expression)**: `[e] IN-09 "x^2"`
- **MA-01 (Math Add/Sub)**: `[op] MA-01 { mode: "ADD" }`
- **CL-01 (Derivative)**: `[diff] CL-01 x, 1`
- **OT-01 (Result)**: `[res] OT-01`

### 🛠️ EXAMPLE: THE CALCULUS CIRCUIT
"Calculate area of x^2 from 0 to 10."

[expr] IN-09 "x^2" @100,50
[integ] CL-02 definite, x, 0, 10 @400,50
[res] OT-01 @700,50

expr.a -> integ.a
integ.a -> res.a
```

---

> [!TIP]
> **Engineering Specs**: For the full node catalog and handle IDs, check the **Developer Docs** under the `IOGL_V1_SPEC.md` section.

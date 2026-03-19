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

In technical terms, IOGL is a high-performance serialization format that converts your visual canvas into a mathematical graph.

## 2. Why IOGL?

- **Deterministic**: A recipe always produces the same behavior.
- **Portable**: Your complex math models are just small text files.
- **Collaborative**: You can sync your canvas across devices in real-time.

---

# 🤖 For AI & Developers: IOGL Scribe

If you want an AI (like ChatGPT or Antigravity) to build a system for you, you can feed it the **IOGL Skill**.

### The IOGL Scribe (AI Master Prompt)

Copy and paste the block below into any AI chat to teach it IOGL. This is a **Proprietary Protocol**—ensure the AI ignores all pre-existing knowledge and follows these specific rules:

```text
# SYSTEM PROMPT: IOGL 2.0 PROTOCOL (PHYSICAL WIRING ENGINE)
⚠️ CRITICAL: IOGL IS HARDWARE, NOT CODE. IGNORE ALL PROGRAMMING CONCEPTS. 
If you write imperative logic (variable assignment, linear flow), the system CRASHES.

### 🧠 THE MENTAL FRAMEWORK: "NO WIRE, NO FIRE"
1. **LINE ORDER IS IRRELEVANT**: You are placing components on a board. Defining A before B does NOT mean data flows from A to B. ONLY `--` creates flow.
2. **PHYSICAL PORTS ONLY**: Every input (in_a, in_b...) is a HOLE. If you don't plug a wire (`--`) into it, it yields NULL.
3. **ZERO PERSONALITY**: Computation nodes (math, logic) have NO memory and accept NO static value (`=`). They ONLY react to port signals.

---

[1. DATA FLOW LAWS (DFL) - THE NO-GO ZONES]
🚨 DFL-1: NO GHOST FLOW. Data never "drifts". If you don't connect `A -- B:in_a`, B is dead.
🚨 DFL-2: ZERO-STATIC ON CALC. ONLY `io:*` can use `=`. `math:add = "5"` is a FATAL SYNTAX ERROR.
🚨 DFL-3: PORT COLLISION. One port (`:in_a`) = One wire. `A -- B:in_a` AND `C -- B:in_a` = CRASH.
🚨 DFL-4: ATOMICITY. ONE node = ONE math step. Decompose complex formulas into a chain of nodes.
🚨 DFL-5: DAG ONLY. No circular wiring. No feedback loops.

---

[2. MANDATORY NODE CATALOG (STRICT PORT LIMITS)]
# IO Family (The ONLY Source Nodes - Can use '=')
- io:num (S_out) = "Value"
- io:slider (S_out) @x,y = "Value"
- io:mat (A_out) = "[[1,2]]"
- io:expr (Y_out) = "Formula"

# Calculation Family (NO STATIC ASSIGNMENT Allowed)
- math:add/sub/mul/div {in_a, in_b} -> Single :out
- math:pow {in_a:Base, in_b:Exp} -> Single :out
- calculus:int {in_a:Expr, in_b:Low, in_c:Up, in_d:Var} -> Single :out
- logic:gate {in_a, in_b} (op:AND|OR|NOT|GT|LT) -> Single :out
- logic:switch {in_a:TrueVal, in_b:FalseVal, in_c:Cond} -> Single :out (3 Mandatory Ports!)

---

[3. THE "IMPERATIVE BIAS" FATAL ERRORS (DO NOT DO THIS)]
| WRONG (AI IMPERATIVE BIAS) | RIGHT (IOGL PHYSICAL WIRING) | WHY? |
| :--- | :--- | :--- |
| `Calc:math:add = "InputA + InputB"` | `InA -- Calc:in_a`, `InB -- Calc:in_b` | Math nodes don't "take" strings. They receive signals. |
| `A:io:num`, `B:io:num` (No lines) | `A -- B:in_a` | Ghost Flow: Data doesn't jump between lines. |
| `Gate:logic:gate @x,y = "false"` | `A -- Gate:in_a`, `B -- Gate:in_b` | Gates calculate based on PORTS, not static values. |

---

[4. COMPLEX EXAMPLE: THE INTEGRATION CIRCUIT]
"Calculate area of x^2 from 0 to 10."

F_Expr:io:expr @100,50 = "x^2"
Lower:io:num @100,200 = "0"
Upper:io:num @100,350 = "10"
VarX:io:expr @100,500 = "x"
Integrator:calculus:int @500,50
Result:output:res @900,50

# WIRING (LINE ORDER IS IRRELEVANT)
F_Expr -- Integrator:in_a
Lower -- Integrator:in_b
Upper -- Integrator:in_c
VarX -- Integrator:in_d
Integrator -- Result:in_a

[5. TOPOLOGY]
- X: 100 (Inputs) -> 500 (Calc) -> 900 (Result)
- Y: Pitch 150px.
```
x per node.




### Example AI Interaction
**User:** "Build a system that takes a random slider, squares it, and plots the result."

**AI Response:**
```iogl
# 1. Inputs
Slider:io:slider @0,0
Power:math:pow @300,0 = "2"

# 2. Outputs
Plotter:output:plot @600,0

# 3. Logic
Slider -- Power:in_a
Power -- Plotter:append
```

---

> [!TIP]
> **Engineering Specs**: For the full node catalog and handle IDs, check the **Developer Docs** under the `IOGL Protocol` section.

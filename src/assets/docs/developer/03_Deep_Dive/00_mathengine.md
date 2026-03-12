---
title: MathEngine Internals
order: 0
icon: Zap
---

# MathEngine Internals

MathEngine is the core of the entire system, built on `mathjs`.

## Core Responsibilities
- Maintain the topological sort of nodes.
- Manage data type conversions (BigNumber, Matrix).
- Execute incremental calculation flows.

## Type System
The system uses a unified precision setting to ensure consistency across node calculations.

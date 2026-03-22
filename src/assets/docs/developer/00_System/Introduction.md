---
title: Introduction
order: 0
icon: Zap
---

# Why Node-Based?

When designing complex data-flow systems, we face a fundamental choice: **Layer-based** or **Node-based**?

Historically, node-based systems were reserved for high-end, professional applications. However, in recent years—driven by the AI explosion—tools like **ComfyUI** have brought the node-based paradigm into the mainstream. While **Blender**’s Nodes were influential earlier, ComfyUI truly demonstrated what "clear generation logic" looks like. Even without touching the controls, a user can instantly see how data flows from left to right, how it’s synthesized, and where the final result originates.

## Core Motivations for Node-Based Architecture

We chose a node-based architecture for a very simple reason: **Full Visualization of the Calculation Process**.

1. **Visual Calculation Path**: Every step of the operation is transparent. Users can intuitively understand the upstream and downstream dependencies of their data.
2. **Extreme Debugging Efficiency**: When a result is incorrect, the "Method of Exclusion" allows for incredibly fast pinpointing of the specific faulty node. This is far more efficient than hunting through stacks of layers or hidden modifiers.
3. **Explicit Dependency Mapping**: While advanced software like Blender introduced concepts like "Attribute Nodes" (Wireless/Hidden Connections) for power users, we currently prioritize physical, transparent links. This ensures that logic remains traceable at all times.

The Input-Output system treats this **transparency** as a core competency, giving both developers and users a "God's eye view" when navigating complex engineering computations.

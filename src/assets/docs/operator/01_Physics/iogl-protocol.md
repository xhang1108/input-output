---
title: IOGL Protocol
order: 4
icon: Layers
---

# 🧬 IOGL: The Graph Blueprint

**Input-Output Graph Language (IOGL)** is the universal language of our system. It is a declarative JSON structure that defines the identity, state, and topology of your calculation.

## 1. The Blueprint Concept
Every project you build is stored as an IOGL "Recipe". This allows for zero-loss serialization and instant cross-tab synchronization. An IOGL payload consists of two primary arrays: `nodes` and `edges`.

### Node Topology
A node is an atomic processing unit. It contains:
- **Type**: The operator ID (e.g., `MA-01` for Math).
- **Data**: Internal state (e.g., the value of a slider or the selected operation).
- **Position**: Spatial coordinates on the infinite canvas.

### Edge Topology
Edges are directed logical links. They connect an **Output Handle** of a producer node to an **Input Handle** of a consumer node.

## 2. Real-time Synthesis
When you modify the graph, the **Brain** performs a partial synthesis:
1. **Delta Patch**: Only the changed nodes are updated in the engine.
2. **Dirty Chain**: Downstream nodes are marked for re-calculation.
3. **Async Eval**: MathJS processes the new logic and pushes results back to the UI.

---

## 🚀 Try an Example
See IOGL in action by injecting this basic math circuit into your canvas:

```iogl-example
{
  "label": "Basic Addition Circuit",
  "iogl": {
    "nodes": [
      { "id": "input-1", "type": "IN-01", "position": { "x": 0, "y": 0 }, "data": { "value": 10, "label": "A" } },
      { "id": "input-2", "type": "IN-01", "position": { "x": 0, "y": 150 }, "data": { "value": 20, "label": "B" } },
      { "id": "math-1", "type": "MA-01", "position": { "x": 300, "y": 75 }, "data": { "op": "add", "label": "Sum" } },
      { "id": "result-1", "type": "OT-01", "position": { "x": 600, "y": 75 }, "data": { "label": "Output" } }
    ],
    "edges": [
      { "id": "e1", "source": "input-1", "target": "math-1", "targetHandle": "in-0" },
      { "id": "e2", "source": "input-2", "target": "math-1", "targetHandle": "in-1" },
      { "id": "e3", "source": "math-1", "target": "result-1", "targetHandle": "in-0" }
    ]
  }
}
```

> [!IMPORTANT]
> IOGL is the "Single Source of Truth". If you right-click a node and select **View Specs**, you are navigating the metadata defined within this protocol.

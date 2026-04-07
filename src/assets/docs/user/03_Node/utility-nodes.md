---
title: Utility Nodes
order: 8
---

# Utility Nodes

The Utility category contains quality-of-life tools that don't calculate data, but rather help you organize and document your workspace.

## 1. Sticky Note (UT-01)
A resizable text block that supports full **Markdown** formatting. Use Sticky Notes to explain node logic, leave TODOs, or organize complex visual sub-graphs. 

- **Inputs**: None.
- **Outputs**: None.

- **Supports GitHub Flavored Alerts**: You can use `> [!WARNING]`, `> [!TIP]`, or `> [!NOTE]` to render distinct colored callout blocks.
- **Background Colors**: Customize the background color from predefined theme presets (Amber, Blue, Green, Red, Purple, Default) to color-code your documentation.
- **Font Sizing**: Scale the typography based on visual dominance (Small, Medium, Large).

Double-click the content to enter Edit Mode. Press `Esc` or click completely outside the node to save.

```playground
{
  "nodeType": "UT-01",
  "initialData": {
    "markdown": "> [!TIP]\n> Leave documentation next to complex math flows.",
    "bgColor": "blue",
    "textSize": "md"
  },
  "width": 250
}
```

## 2. Reroute (UT-02)
A tiny, zero-cost wireless relay point. 

- **Input**: Incoming data stream.
- **Output**: Exact copy of incoming data.

- **Purpose**: Insert a Reroute node into a long, messy connection to elegantly guide the wire around obstacles.
- **Passthrough**: Data flows through instantly with zero modification or type coercion.

> [!NOTE]
> Under standard nodes, the Reroute node does not have a background chassis. It appears only as a single connection dot, keeping the visual layout exceptionally clean.

## 3. Concatenate (UT-03)
A string builder node that joins multiple data sources into a single text string. This is useful for creating dynamic labels, complex messages, or formatting outputs for export.

- **Input**: A capsule-style input handle that accepts any number of connections.
- **Output**: A single string containing all input values joined together.

- **Parameters**: 
  - **Delimiter**: A string (e.g., a space, comma, or newline) inserted between each input value.

```playground
{
  "nodeType": "UT-03",
  "initialData": { "delimiter": ", " }
}
```

---
title: Custom Nodes
order: 5
icon: Hammer
---

# Custom Nodes: Building New Operations

Extending the system with a custom computation node is a highly rigid, two-step process. In I/O, UI elements are completely stateless regarding calculations. A custom node is created by splitting its identity into **Metadata** and an **Evaluator**.

## Step 1: Define Metadata (`nodeDefinitions.ts`)
The `NODE_DEFINITIONS` registry informs the Engine and the React Flow canvas about the node's dimensions, categories, and connection handles.

```typescript
{
    id: 'MY-01',
    label: 'Percentage',
    category: 'Math',
    handles: [
        { id: 'in', type: 'target', variant: 'single', dataType: 'scalar' },
        { id: 'out', type: 'source', variant: 'single', dataType: 'scalar' }
    ],
    // The default payload required by the engine when spawned
    defaultData: { op: 'percent' },
    // Parameters dictate what appears in the right-side N-Panel
    params: [
        { id: 'op', label: 'Mode', type: 'select', options: [...] }
    ]
}
```

> [!NOTE]
> If a node only requires standard parameters (like dropdowns, text inputs, numbers), you do **not** need to build a custom React component. The engine generates the N-Panel properties automatically using `GenericSelectorNode`.

## Step 2: Register Logic (`NodeRegistry.ts`)
Next, map the `MY-01` id to an Evaluator function. This function must be a pure, side-effect-free equation.

```typescript
registry.registerEvaluator('MY-01', (node, inputs) => {
    // 1. Check for incoming data (Fail gracefully)
    if (!inputs.has('in')) {
        return { type: 'error', value: 'Missing input' };
    }

    // 2. Extract Data
    const inputVal = inputs.get('in')!.value;

    // 3. Perform Logic
    const result = inputVal / 100;

    // 4. Wrap and Return
    return {
        type: 'scalar',
        value: result
    };
});
```

## Step 3: UI Components (Optional)
If your node requires bespoke on-canvas controls (e.g., a physical interactive Slider, a canvas drawing context, or specific CSS layouts), you must intercept its rendering in `Body.tsx`.
1. Create a `MyCustomNode.tsx` component extending `BaseNode`.
2. Map it in the `nodeTypes` object inside the main Body component.

## Best Practices
- **No Side Effects**: Evaluators must never fetch data from the network (`fetch()`), read the DOM, or access `localStorage`. They are strictly `y = f(x)`.
- **Defensive Unwrapping**: Always use `PayloadUtils.unwrap()` if building matrix or complex datatype handlers, since incoming values might be deeply nested Arrays or nested Objects representing vectors.

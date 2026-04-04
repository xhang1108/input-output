---
title: Storage & Serialization
order: 8
---

# Storage & Serialization

The Input-Output platform uses a multi-layered approach to ensure that complex mathematical graphs can be persisted, shared, and versioned with high fidelity and minimal storage footprint.

## 1. The Persistence Strategy
The system follows a **Local-First, Cloud-Sync** philosophy orchestrated by the `useProjectSave` hook and the `SaveManager` service (`src/services/SaveManager.ts`).

### Local Persistence (The Safety Net)
- **Engine**: `SaveManager.ts`
- **Target**: Browser `localStorage`.
- **Behavior**: Every modification to the graph triggers a debounced local save. This ensures that even in the case of a browser crash or network failure, the work is never lost.

### Cloud Synchronization (The Collaboration Layer)
- **Target**: Central PostgreSQL/D1 database via `/api/graphs`.
- **Conflict Resolution**: The system compares timestamps between the local backup and the cloud version. If a conflict is detected (e.g., local is newer), the user is prompted to choose the version to keep.

## 2. Serialization Format
All project data is encapsulated into a `ProjectData` object before being transformed into a storable string.

### ProjectData Structure
```typescript
interface ProjectData {
    version: string;          // Engine schema version (e.g. 1.0.0)
    mathPrecision: number;    // Global decimal precision setting
    settings: Record<string, unknown>; // UI preferences (grid, snap, theme)
    graph: InjectableGraph;   // The collection of nodes and edges
}
```

### Compression (`src/engine/Serializer.ts`)
To optimize URL sharing and storage limits, the JSON string is compressed using **LZ-String** (Encoded URI Component). This results in a ~60% reduction in string length, making it suitable for deep-linking.

## 3. IOGL (Input-Output Graph Language)
`GraphCodec.ts` provides a high-level symbolic interface for the engine. IOGL is a human-readable DSL (Domain Specific Language) used for:
- **Project Export**: Exporting the graph as a clean, editable text script.
- **Node Blueprints**: Sharing specific component recipes.
- **CLI Validation**: Validating graph integrity outside of the browser environment.

### Parsing Pipeline
1. **Lexer**: Breaks the IOGL script into tokens (IDs, Arrows, RAW_VALUES).
2. **Parser**: Reconstructs the node definitions and edge connections using the `IOGL_MANIFEST`.
3. **IOGLUtils**: Centralizes handle mapping (`src/engine/iogl/IOGLUtils.ts`) and data wrapping (Fidelity Guard) to ensure engine compatibility.

## 4. Architectural Guards
- **Function Stripping**: To maintain security and JSON compatibility, all functions and transient UI states (like `saveStatus` or `actionLog`) are stripped during the serialization "Cleaning" phase.
- **Dehydration**: Mathematical objects (like `math.Matrix`) are dehydrated into raw JSON arrays before storage and re-hydrated by the engine during load.
- **ID Stability**: The system generates stable semantic IDs based on node type and short hashes to ensure that links remain valid across different sessions.

---

> [!IMPORTANT]
> When importing a project, the engine performs a **Strict Injection Pass**, validating all nodes against the current `NodeRegistry` to prevent schema-based crashes or script injection.

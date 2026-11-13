# Changelog

## [v1.1.0] - 2026-11-13

React Flow integration-layer audit + fixes (audit v5.0). Save format unchanged.

### Fixed

- Broken snap wiring: `manualSnap` toggle now takes effect; snapping in all three modes — GRABBING (20px), SCALING (0.05), ROTATING (15°); autopan keeps snap; Ctrl+right-click priority (cancel-only with `cutPath` cleared during transforms); `useCanvasProjection` pinned to `{ snapToGrid: false }`; persist key bumped to `v4` (one-time reset of legacy settings)
- `MagneticEdge` wrapped in `memo`; edge slots moved to a `WeakMap` O(1) lookup (`src/utils/edgeSlots.ts`)
- `useRelink` dropped its `s.edges` subscription, `RelinkLine` / `useHandleMagnet` dropped `nodeLookup` subscriptions (`s.edges` kept); `IOPlayground` height signature fixes staleness; `SolverNode` narrowed selection
- 4 inline tracked `<ReactFlow>` props hoisted to module constants (`StoreUpdater setState` 4 → 0)
- Lint runnable: `eslint@9.39.5` + `typescript-eslint@8.72.2` (new baseline: 1201 problems, all pre-existing)
- Removed demo `as any`, `hideAttribution`, component-level CSS imports; dev-only handle-id assert; ownership/divergence-whitelist comments
- Single source of truth for versions: app version reads `package.json` via `APP_VERSION` (`src/lib/version.ts`), save schema reads `SCHEMA_VERSION` (`src/engine/schema.ts`); status bar no longer hardcodes `V1.0`; removed stray `2.0` slot fallbacks; `npm run verify:version` (runs on `prebuild`) checks package/lock/tag agreement

### Verified

- `tsc --noEmit`: only the 4 pre-existing `brain.worker.ts` errors; `--noUnusedLocals` on the 5 target files: 28 ≤ 31
- `test:run`: 60 files / 345 tests green; H1–H5 real-device checks + 500-edge Profiler passed

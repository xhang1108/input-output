# Changelog

## [v1.2.1] - 2026-11-14

Performance pass for 500-node graphs. Save format unchanged (schema 1.0.0); existing projects load as-is.

### Changed

- Canvas renders only nodes and edges intersecting the viewport (`onlyRenderVisibleElements`). On the 500-node stress fixture at zoom 1: a 500-node value update went from 0.98–1.21 s to 67–100 ms, single-node drag p95 from 150 ms to 33.4 ms, and long tasks (>50 ms) dropped to zero
- One visible path plus one interaction path per edge (the duplicated hit area is gone); auto-insert still finds `react-flow__edge-interaction`
- Capsule preview notifications now reach only the affected handle/node instead of every edge; drag commits keep a per-grab cache for edge bounds and path length
- The node panel no longer subscribes to React Flow state while closed

### Fixed

- Structural transactions emitted `graphChanged` twice, and position-only drag batches triggered a full topology sync. Exactly one emission now, none for silent or position-only transactions
- Full topology sync replaced an O(n²) node lookup with an index map

### Internal

- `fast-deep-equal` is a declared dependency instead of a transitive one
- Stress fixture and its tests live in `tests/fixtures/stress` and `tests/unit/stress`; the measurement harness is not shipped

## [v1.2.0] - 2026-11-14

Frame grouping and an undo/redo hardening pass. Save format unchanged (schema 1.0.0); existing projects load as-is.

### Added

- Frame nodes (single level): `F` groups the selection / ungroups one frame's children; dropping a root fully inside a frame attaches it; manual resize with the content edge as the minimum; live expand-only auto-fit; right-click `Fit to contents`; `Detach from Frame` in the node menu
- Frame-aware clipboard (frame + descendants), auto layout (frame as one sized block; selecting a frame lays out its children in place), IOGL `FRAME` export/import, and hierarchy sanitization (orphans, self-parents, cycles and depth > 1 are detached to world space on load)
- History is cleared whenever the graph identity changes (project load, cloud/local conflict, fork, wipe, replace-graph import) so Ctrl+Z can never replay another project's transactions
- Read-only permission is enforced inside `useHistoryExecutor` / `useFrameActions` / `useSelection`, not only at the call sites
- Bottom-left Undo/Redo controls and canvas context-menu entries; `canUndo`/`canRedo` now drive the UI
- Mute, InputNode numeric values and NPanel field edits are undoable; repeated edits of one field merge into a single step (800 ms)
- Import success toast offers `Undo import`, restoring the pre-import graph including DOM-measured node sizes

### Fixed

- `Shift+D` duplicates now start a grab immediately, follow the mouse and drop on click; duplicate + placement is a single undo step
- Knife cuts write their `DISCONNECT` batch to the Brain in the same handler instead of relying on the asynchronous UI diff
- Undo/redo parity: sub-0.5 px moves are forced through the Brain deadzone, and resize restores follow the Brain's rounding/threshold rules
- Deleting a node records `CONNECT` inverses for every cascaded edge, so one undo restores the full wiring
- Undo keeps its entry when the Brain rejects a restore, instead of silently losing the step

## [v1.1.0] - 2026-11-13

React Flow integration-layer audit + fixes (audit v5.0). Save format unchanged.

### Fixed

- `Shift+A` palette sometimes opened invisible (`opacity-0`, unpositioned, ~1 in 3 opens) because `CategorizedMenu` ran its positioning effect while `mounted` still returned `null`, then stopped retrying; the loop now re-schedules until the portal ref exists
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

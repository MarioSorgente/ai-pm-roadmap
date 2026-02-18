# Capacity-aware Roadmap Builder (v0.1)

Prototype for planning initiatives against real sprint capacity, dependencies, and target windows.

## What changed

- Reworked the data model to include **teams + engineers** with per-sprint capacity.
- Added initiative editing for **P0–P3 priority**, effort, dependencies, and optional target windows.
- Redesigned the UI into a dense, three-panel layout:
  - Left: teams and inline engineer capacity editing.
  - Center: stats, initiative editor, timeline, and capacity view.
  - Right: changelog with scheduling reasoning and conflict flags.
- Updated scheduling logic to place initiatives by priority + dependency constraints and log explicit reasoning.
- Added basic what-if behavior by prepending diff entries when you reschedule.

## Run locally

```bash
npm install
npm run dev
```

## Quick test flow

1. Edit engineer sprint capacities and initiative inputs.
2. Click **Schedule**.
3. Validate timeline bars, per-team capacity bars, and changelog reasoning.
4. Change inputs and click **Schedule** again to inspect changelog diffs.
5. Optional: **Save** to localStorage and reload.

## Tradeoffs / assumptions

- Scheduling remains greedy and deterministic (fast, explainable, not globally optimal).
- Initiative ownership is one team per initiative.
- Capacity is aggregated by team from engineer-level sprint capacity.
- Priority reorder by drag/drop is not implemented in this iteration.

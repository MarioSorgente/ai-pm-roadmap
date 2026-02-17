# Capacity-aware Roadmap Builder (v0.1)

Prototype web app for PMs to create a realistic roadmap that respects team capacity and dependencies.

## What changed in v0.1

- Editable input model for teams and initiatives.
- Deterministic greedy scheduling.
- Timeline view with weekly allocations.
- Capacity utilization view by week.
- Changelog explaining placement/unscheduled outcomes.
- Local draft save/load via localStorage.

## How to run

```bash
npm install
npm run dev
```

## How to test quickly

1. Edit team capacity and initiative fields.
2. Click **Generate roadmap**.
3. Verify timeline, utilization, and changelog update together.
4. Toggle **Strict target window** and regenerate to compare outcomes.

## Tradeoffs and assumptions

- Single-team ownership per initiative in v0.1 (keeps model and UX simple).
- Scheduling is greedy and deterministic, not globally optimal.
- Target window defaults to soft behavior; strict mode is optional.
- No backend/database by design; state is local only.

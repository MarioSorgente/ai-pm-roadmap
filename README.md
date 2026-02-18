# Capacity-aware Roadmap Builder (v0.3)

Prototype for planning initiatives against real sprint capacity, dependencies, and target windows.

## What changed

- Added a clearer **capacity model**: `available capacity = engineer capacity - external load`.
- Added team-level **external variables per sprint** (e.g., support, urgent requests) that consume capacity before scheduling.
- Added a visual **Sprint map (capacity vs effort)** chart for each sprint.
- Redesigned input layout with clearer labels and section guidance for teams, initiatives, and sprint logic.
- Enabled **auto-persist to localStorage** on every input change, so refresh keeps your latest draft.
- Capacity cells now show full context: `used / available`, plus base and external values.

## Run locally

```bash
npm install
npm run dev
```

## Quick test flow

1. Edit engineer capacities and add external load rows (Support, Urgent requests, etc.).
2. Create or edit initiatives with effort, team, dependencies, and optional target range.
3. Click **Schedule**.
4. Review:
   - **Sprint map** (base capacity vs external load vs effort used)
   - **Timeline by sprint**
   - **Per team / per sprint utilization** cards
   - **Changelog** reasoning and conflicts
5. Refresh the page and verify your draft remains.

## Tradeoffs / assumptions

- Scheduling remains greedy and deterministic (fast, explainable, not globally optimal).
- Initiative ownership is one team per initiative.
- External variables reduce capacity per sprint but are not separately scheduled as initiatives.
- No backend/database; draft state is local only.

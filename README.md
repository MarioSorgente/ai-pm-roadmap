# Capacity-aware Roadmap Builder (v0.4)

Prototype for planning initiatives against sprint capacity, dependencies, and target windows.

## What changed

- Shifted planning model to **percentage-based capacity**:
  - engineer capacity is entered as `%`
  - initiative effort is entered as `% of one engineer sprint`
  - external work consumes `%` before scheduling
- Refreshed UI to a calmer, white, rounded visual style inspired by Airfocus.
- Added team cards with:
  - avatar + name rows
  - slider-based capacity control with `Capacity / Available / Over` cues
  - external load pills and inline `+ Add external`
  - thin rounded capacity bars with calm over-capacity warning styles
- Reduced visual density in initiatives: default shows 3 initiatives per page with simple pager controls.
- Added more tooltip guidance so the interface stays minimal while still discoverable.
- Kept local autosave and deterministic scheduling behavior.

## Run locally

```bash
npm install
npm run dev
```

## Quick test flow

1. Edit engineer capacity sliders and external load percentages.
2. Create or edit initiatives with effort %, team, dependencies, and optional target range.
3. Use the initiatives pager (3 rows per page) when you have more than three initiatives.
4. Click **Schedule**.
5. Review:
   - **Sprint map** (capacity %, external %, effort used %)
   - **Timeline by sprint**
   - **Per team / per sprint utilization** cards
   - **Changelog** reasoning and conflicts
6. Refresh the page and verify your draft remains.

## Tradeoffs / assumptions

- Scheduling remains greedy and deterministic (fast, explainable, not globally optimal).
- Initiative ownership is one team per initiative.
- Team capacity can exceed 100% because it sums multiple engineers.
- External variables reduce capacity per sprint but are not separately scheduled as initiatives.
- No backend/database; draft state is local only.

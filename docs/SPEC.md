# Spec — Capacity-aware Roadmap Builder (v0.4)

## User / job to be done
PM or team lead needs to create a roadmap that respects team throughput and dependency order while making tradeoffs explicit.

## Inputs
- Teams: name, linked engineers.
- Engineers: name/initials, team assignment, sprint-by-sprint capacity (%).
- External variables: team-level sprint loads for non-roadmap work (support, incidents, urgent customer requests) as %.
- Initiatives: name, effort (% of one engineer sprint), priority (P0–P3), dependencies, optional target window, assigned team.
- Planning settings: total number of sprints.

## Output model
- **Base capacity** = sum of engineer capacity percentages per team and sprint.
- **Available capacity** = base capacity − external variables.
- **Roadmap effort used** = scheduled initiative effort percentages allocated in each sprint.

## Outputs
- **Sprint map**: graphic comparison of base capacity, external load, and scheduled effort by sprint.
- **Roadmap timeline**: sprint columns with initiative placement by team and effort allocated per sprint.
- **Capacity view**: per-team sprint utilization (used/available) with healthy/high/over states.
- **Changelog**: explicit decisions and conflicts (placed, blocked, missed window, capacity conflict).

## UX clarity additions (v0.4)
- Airfocus-inspired visual refresh: calm white surfaces, rounded cards, subtle shadows, and muted colors.
- Team cards include avatar/name, slider-like capacity controls, external load pills, and thin rounded capacity bars.
- Initiatives are paginated (3 per page by default) to avoid visual crowding.
- Added rounded tooltip guidance to preserve a minimal UI with clear instructions.
- Inline `+ Add external` flow and lightweight warning states when over capacity.
- Autosave to localStorage on change to preserve data through browser refresh.

## Scheduler behavior (v0.4)
- Sorts by priority and resolves dependency order first.
- Computes available capacity from engineer totals minus external load.
- Finds earliest feasible sprint start given dependencies + optional target start.
- Allocates effort over available team capacity by sprint.
- Flags conflicts when initiative effort cannot be fully placed or target windows are missed.
- Supports what-if comparison by surfacing changed placements after re-scheduling.

## Known limits
- Greedy strategy (deterministic but not globally optimal).
- Single-team ownership per initiative.
- External load is treated as fixed deductions, not probability-based uncertainty.
- No backend/database; draft state is local only.

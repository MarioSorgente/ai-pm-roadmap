# Spec — Capacity-aware Roadmap Builder (v0.1)

## User / job to be done
PM or team lead needs to create a roadmap that respects team throughput and dependency order while making tradeoffs explicit.

## Inputs
- Teams: name, linked engineers.
- Engineers: name/initials, team assignment, sprint-by-sprint capacity.
- Initiatives: name, effort, priority (P0–P3), dependencies, optional target window, assigned team.
- Planning settings: total number of sprints.

## Outputs
- **Roadmap timeline**: sprint columns with initiative placement by team.
- **Capacity view**: per-team sprint utilization (healthy/high/over states).
- **Changelog**: explicit decisions and conflicts (placed, blocked, missed window, capacity conflict).

## Scheduler behavior (v0.1)
- Sorts by priority and resolves dependency order first.
- Finds earliest feasible sprint start given dependencies + optional target start.
- Allocates effort over available team capacity by sprint.
- Flags conflicts when initiative effort cannot be fully placed or target windows are missed.
- Supports what-if comparison by surfacing changed placements after re-scheduling.

## Known limits
- Greedy strategy (deterministic but not globally optimal).
- Single-team ownership per initiative.
- No backend/database; draft state is local only.

# Spec — Capacity-aware Roadmap Builder (v0)

## User & job
PM/team lead: create a realistic roadmap that respects team capacity and dependencies.

## Inputs
- Teams: name, weeklyCapacityPoints
- Initiatives: name, sizePoints, priority, dependencies[], optional targetWindow (startWeek/endWeek)

## Outputs
- Timeline view (weeks)
- Capacity utilization per week
- Changelog explaining tradeoffs

## v0.1 baseline (deterministic)
- UI to edit inputs
- “Generate roadmap” runs a greedy scheduler:
  - sort by priority desc
  - respect dependencies (deps scheduled before)
  - never exceed weekly capacity
  - if impossible: explain why in changelog

## Later modules
- AI generation (prompt + changelog)
- Evals (20 scenarios) + rubric
- Guardrails + regression tests
- “Roadmap Update Agent” (weekly update workflow)

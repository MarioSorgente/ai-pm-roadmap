import { type ChangelogEntry, type Initiative, type PlanInput, type PlanOutput, type Priority } from "@/lib/types";

function log(level: ChangelogEntry["level"], message: string): ChangelogEntry {
  return { id: `${level}-${Math.random().toString(36).slice(2, 9)}`, level, message };
}

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function sortByPriority(initiatives: Initiative[]) {
  return [...initiatives].sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (byPriority !== 0) return byPriority;
    return a.name.localeCompare(b.name);
  });
}

function topologicalSort(initiatives: Initiative[]) {
  const byId = new Map(initiatives.map((initiative) => [initiative.id, initiative]));
  const visitState = new Map<string, "visiting" | "done">();
  const cycleIds = new Set<string>();
  const ordered: Initiative[] = [];

  function visit(id: string) {
    if (visitState.get(id) === "done") return;
    if (visitState.get(id) === "visiting") {
      cycleIds.add(id);
      return;
    }

    visitState.set(id, "visiting");
    const initiative = byId.get(id);
    if (initiative) {
      for (const dep of initiative.dependencyIds) {
        visit(dep);
        if (cycleIds.has(dep)) {
          cycleIds.add(id);
        }
      }
      ordered.push(initiative);
    }
    visitState.set(id, "done");
  }

  initiatives.forEach((initiative) => visit(initiative.id));
  return {
    cycleIds,
    ordered: sortByPriority(ordered).sort((a, b) => {
      const depA = a.dependencyIds.includes(b.id) ? 1 : 0;
      const depB = b.dependencyIds.includes(a.id) ? 1 : 0;
      return depA - depB;
    })
  };
}

function getTeamCapacityBySprint(input: PlanInput) {
  const baseCapacity = new Map<string, number[]>();
  const externalLoad = new Map<string, number[]>();

  for (const team of input.teams) {
    baseCapacity.set(team.id, Array.from({ length: input.settings.totalSprints }, () => 0));
    externalLoad.set(team.id, Array.from({ length: input.settings.totalSprints }, () => 0));
  }

  for (const engineer of input.engineers) {
    const capacity = baseCapacity.get(engineer.teamId);
    if (!capacity) continue;
    for (let index = 0; index < input.settings.totalSprints; index += 1) {
      capacity[index] += engineer.sprintCapacity[index] ?? 0;
    }
  }

  for (const load of input.externalLoads) {
    const teamLoad = externalLoad.get(load.teamId);
    if (!teamLoad) continue;
    for (let index = 0; index < input.settings.totalSprints; index += 1) {
      teamLoad[index] += load.sprintLoad[index] ?? 0;
    }
  }

  const availableCapacity = new Map<string, number[]>();
  input.teams.forEach((team) => {
    const base = baseCapacity.get(team.id) ?? [];
    const load = externalLoad.get(team.id) ?? [];
    availableCapacity.set(
      team.id,
      Array.from({ length: input.settings.totalSprints }, (_, index) => Math.max(0, (base[index] ?? 0) - (load[index] ?? 0)))
    );
  });

  return { baseCapacity, externalLoad, availableCapacity };
}

export function generateRoadmap(input: PlanInput): PlanOutput {
  const changelog: ChangelogEntry[] = [];
  const teamCapacity = getTeamCapacityBySprint(input);
  const usedCapacity = new Map<string, number>();
  const completionByInitiative = new Map<string, number>();

  const { cycleIds, ordered } = topologicalSort(input.initiatives);
  const scheduled: PlanOutput["scheduled"] = [];

  for (const initiative of ordered) {
    if (cycleIds.has(initiative.id)) {
      changelog.push(log("BLOCKED", `${initiative.name} is blocked by a dependency cycle.`));
      continue;
    }

    const teamSprints = teamCapacity.availableCapacity.get(initiative.teamId);
    if (!teamSprints) {
      changelog.push(log("CONFLICT", `${initiative.name} references an unknown team.`));
      continue;
    }

    let earliestSprint = 1;
    const dependencyReasons: string[] = [];
    let dependencyBlocked = false;

    for (const depId of initiative.dependencyIds) {
      const depEnd = completionByInitiative.get(depId);
      if (!depEnd) {
        dependencyBlocked = true;
        changelog.push(
          log("BLOCKED", `${initiative.name} could not be scheduled because dependency ${depId} did not finish.`)
        );
        break;
      }
      earliestSprint = Math.max(earliestSprint, depEnd + 1);
      dependencyReasons.push(`${depId} finishes S${depEnd}`);
    }

    if (dependencyBlocked) continue;

    if (initiative.targetWindow) {
      earliestSprint = Math.max(earliestSprint, initiative.targetWindow.startSprint);
    }

    const allocations: { sprint: number; points: number }[] = [];
    let remaining = initiative.effort;

    for (let sprint = earliestSprint; sprint <= input.settings.totalSprints; sprint += 1) {
      if (remaining <= 0) break;
      const cap = teamSprints[sprint - 1] ?? 0;
      const usedKey = `${initiative.teamId}-${sprint}`;
      const alreadyUsed = usedCapacity.get(usedKey) ?? 0;
      const free = Math.max(0, cap - alreadyUsed);
      if (free <= 0) continue;

      const slice = Math.min(free, remaining);
      usedCapacity.set(usedKey, alreadyUsed + slice);
      allocations.push({ sprint, points: slice });
      remaining -= slice;
    }

    const startSprint = allocations[0]?.sprint ?? null;
    const endSprint = allocations.at(-1)?.sprint ?? null;

    let reasoning = `${initiative.name} placed by ${initiative.priority} priority`;
    if (dependencyReasons.length > 0) {
      reasoning += ` after dependencies (${dependencyReasons.join(", ")})`;
    }
    if (startSprint && endSprint) {
      reasoning += ` across S${startSprint}-S${endSprint}`;
    }

    if (remaining === 0 && endSprint) {
      completionByInitiative.set(initiative.id, endSprint);
      changelog.push(log("PLACED", reasoning));

      if (initiative.targetWindow && endSprint > initiative.targetWindow.endSprint) {
        changelog.push(
          log(
            "WINDOW_MISSED",
            `${initiative.name} missed target window S${initiative.targetWindow.startSprint}-S${initiative.targetWindow.endSprint}; finished in S${endSprint}.`
          )
        );
      }
    } else {
      changelog.push(
        log(
          "CONFLICT",
          `${initiative.name} could not fully fit. Scheduled ${initiative.effort - remaining}/${initiative.effort} points.`
        )
      );
      if (initiative.targetWindow) {
        changelog.push(
          log(
            "WINDOW_MISSED",
            `${initiative.name} could not fit target window S${initiative.targetWindow.startSprint}-S${initiative.targetWindow.endSprint} due to team capacity.`
          )
        );
      }
    }

    scheduled.push({
      initiativeId: initiative.id,
      initiativeName: initiative.name,
      teamId: initiative.teamId,
      priority: initiative.priority,
      allocations,
      startSprint,
      endSprint,
      remainingEffort: remaining,
      reasoning
    });
  }

  const capacity = input.teams.flatMap((team) => {
    const availableSprints = teamCapacity.availableCapacity.get(team.id) ?? [];
    const baseSprints = teamCapacity.baseCapacity.get(team.id) ?? [];
    const loadSprints = teamCapacity.externalLoad.get(team.id) ?? [];
    return Array.from({ length: input.settings.totalSprints }, (_, index) => {
      const sprint = index + 1;
      const cap = availableSprints[index] ?? 0;
      const used = usedCapacity.get(`${team.id}-${sprint}`) ?? 0;
      const utilizationPct = cap === 0 ? 0 : Math.round((used / cap) * 100);
      const status: "healthy" | "high" | "over" = utilizationPct > 100 ? "over" : utilizationPct >= 86 ? "high" : "healthy";
      return {
        teamId: team.id,
        sprint,
        used,
        capacity: cap,
        baseCapacity: baseSprints[index] ?? 0,
        externalLoad: loadSprints[index] ?? 0,
        utilizationPct,
        status
      };
    });
  });

  changelog.push(log("INFO", "Auto-schedule complete. Edit inputs and run again for what-if diffs."));

  return { scheduled, capacity, changelog };
}

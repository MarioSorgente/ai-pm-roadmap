import { type Allocation, type ChangelogEntry, type Initiative, type PlanInput, type PlanOutput } from "@/lib/types";

function log(level: ChangelogEntry["level"], message: string): ChangelogEntry {
  return { id: `${level}-${Math.random().toString(36).slice(2, 8)}`, level, message };
}

function sortInitiatives(initiatives: Initiative[]) {
  return [...initiatives].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.sizePoints !== b.sizePoints) return a.sizePoints - b.sizePoints;
    return a.name.localeCompare(b.name);
  });
}

function findCycles(initiatives: Initiative[]): Set<string> {
  const byId = new Map(initiatives.map((i) => [i.id, i]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleMembers = new Set<string>();

  function dfs(id: string) {
    if (visiting.has(id)) {
      cycleMembers.add(id);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);

    const initiative = byId.get(id);
    if (initiative) {
      for (const dep of initiative.dependencyIds) {
        dfs(dep);
        if (cycleMembers.has(dep)) cycleMembers.add(id);
      }
    }

    visiting.delete(id);
    visited.add(id);
  }

  initiatives.forEach((i) => dfs(i.id));
  return cycleMembers;
}

export function generateRoadmap(input: PlanInput): PlanOutput {
  const { teams, settings } = input;
  const initiatives = sortInitiatives(input.initiatives);

  const changelog: ChangelogEntry[] = [];
  const teamCapacity = new Map(teams.map((team) => [team.id, team.weeklyCapacityPoints]));
  const used = new Map<string, number>();
  const completionWeek = new Map<string, number>();
  const scheduled: PlanOutput["scheduled"] = [];

  const weeks = Array.from({ length: settings.totalWeeks }, (_, index) => settings.startWeek + index);
  const cycleIds = findCycles(initiatives);

  for (const initiative of initiatives) {
    if (cycleIds.has(initiative.id)) {
      changelog.push(log("DEPENDENCY_BLOCKED", `${initiative.name} blocked by dependency cycle.`));
      continue;
    }
    if (!teamCapacity.has(initiative.teamId)) {
      changelog.push(log("INVALID", `${initiative.name} references missing team ${initiative.teamId}.`));
      continue;
    }

    let earliestWeek = settings.startWeek;
    let blocked = false;
    for (const depId of initiative.dependencyIds) {
      if (!completionWeek.has(depId)) {
        blocked = true;
        changelog.push(log("DEPENDENCY_BLOCKED", `${initiative.name} could not start because dependency ${depId} is not scheduled.`));
        break;
      }
      earliestWeek = Math.max(earliestWeek, (completionWeek.get(depId) ?? settings.startWeek) + 1);
    }
    if (blocked) continue;

    if (initiative.targetWindow) {
      earliestWeek = Math.max(earliestWeek, initiative.targetWindow.startWeek);
    }

    let remaining = initiative.sizePoints;
    const allocations: Allocation[] = [];
    let startedWeek: number | null = null;
    let finalWeek: number | null = null;

    for (const week of weeks) {
      if (week < earliestWeek) continue;
      if (remaining <= 0) break;

      if (
        settings.strictTargetWindow &&
        initiative.targetWindow &&
        week > initiative.targetWindow.endWeek
      ) {
        break;
      }

      const capKey = `${initiative.teamId}-${week}`;
      const cap = teamCapacity.get(initiative.teamId) ?? 0;
      const alreadyUsed = used.get(capKey) ?? 0;
      const free = Math.max(0, cap - alreadyUsed);

      if (free <= 0) continue;

      const slice = Math.min(free, remaining);
      used.set(capKey, alreadyUsed + slice);
      remaining -= slice;
      allocations.push({ week, points: slice });
      if (startedWeek === null) startedWeek = week;
      finalWeek = week;
    }

    if (remaining === 0 && finalWeek !== null) {
      completionWeek.set(initiative.id, finalWeek);
      scheduled.push({
        initiativeId: initiative.id,
        initiativeName: initiative.name,
        teamId: initiative.teamId,
        allocations,
        unscheduledPoints: 0
      });
      changelog.push(
        log(
          "PLACED",
          `${initiative.name} scheduled in W${startedWeek}-W${finalWeek} (priority ${initiative.priority}).`
        )
      );

      if (
        initiative.targetWindow &&
        (startedWeek! < initiative.targetWindow.startWeek || finalWeek > initiative.targetWindow.endWeek)
      ) {
        changelog.push(
          log(
            "TARGET_WINDOW_MISSED",
            `${initiative.name} spilled outside requested window W${initiative.targetWindow.startWeek}-W${initiative.targetWindow.endWeek}.`
          )
        );
      }
    } else {
      scheduled.push({
        initiativeId: initiative.id,
        initiativeName: initiative.name,
        teamId: initiative.teamId,
        allocations,
        unscheduledPoints: remaining
      });
      changelog.push(
        log(
          "UNSCHEDULED",
          `${initiative.name} only scheduled ${initiative.sizePoints - remaining}/${initiative.sizePoints} points due to capacity/horizon limits.`
        )
      );
      if (allocations.length > 0) {
        changelog.push(
          log(
            "CAPACITY_LIMIT",
            `${initiative.name} started in W${allocations[0].week} but could not finish in the planning horizon.`
          )
        );
      }
    }
  }

  const capacity = teams.flatMap((team) =>
    weeks.map((week) => {
      const cap = team.weeklyCapacityPoints;
      const usage = used.get(`${team.id}-${week}`) ?? 0;
      const utilizationPct = cap === 0 ? 0 : Math.round((usage / cap) * 100);
      return { teamId: team.id, week, used: usage, capacity: cap, utilizationPct };
    })
  );

  return { scheduled, capacity, changelog };
}

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { generateRoadmap } from "@/lib/scheduler";
import {
  DEFAULT_SETTINGS,
  SAMPLE_PLAN,
  type ChangelogEntry,
  type Engineer,
  type Initiative,
  type PlanInput,
  type PlanOutput,
  type Priority,
  type Team
} from "@/lib/types";

type DraftState = {
  teams: Team[];
  engineers: Engineer[];
  initiatives: Initiative[];
  settings: PlanInput["settings"];
};

const STORAGE_KEY = "ai-pm-roadmap-v02";
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function initialsFromName(name: string) {
  const words = name.trim().split(" ").filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function Hint({ text }: { text: string }) {
  return (
    <span className="hint" tabIndex={0} aria-label={text} data-tip={text}>
      ?
    </span>
  );
}

export default function HomePage() {
  const [teams, setTeams] = useState<Team[]>(SAMPLE_PLAN.teams);
  const [engineers, setEngineers] = useState<Engineer[]>(SAMPLE_PLAN.engineers);
  const [initiatives, setInitiatives] = useState<Initiative[]>(SAMPLE_PLAN.initiatives);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [output, setOutput] = useState<PlanOutput | null>(null);
  const [message, setMessage] = useState("Edit inputs, then schedule the roadmap.");
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as DraftState;
      setTeams(parsed.teams ?? SAMPLE_PLAN.teams);
      setEngineers(parsed.engineers ?? SAMPLE_PLAN.engineers);
      setInitiatives(parsed.initiatives ?? SAMPLE_PLAN.initiatives);
      setSettings(parsed.settings ?? DEFAULT_SETTINGS);
      setMessage("Loaded your local draft.");
    } catch {
      setMessage("Could not load saved draft. Using sample data.");
    }
  }, []);

  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const teamCapacitySummary = useMemo(() => {
    const summary = new Map<string, number>();
    teams.forEach((team) => summary.set(team.id, 0));
    engineers.forEach((engineer) => {
      const current = summary.get(engineer.teamId) ?? 0;
      summary.set(engineer.teamId, current + (engineer.sprintCapacity[0] ?? 0));
    });
    return summary;
  }, [engineers, teams]);

  const sortedInitiatives = useMemo(
    () => [...initiatives].sort((a, b) => a.name.localeCompare(b.name)),
    [initiatives]
  );

  const totalEffort = initiatives.reduce((sum, initiative) => sum + initiative.effort, 0);
  const totalCapacityPerSprint = teams.reduce((sum, team) => sum + (teamCapacitySummary.get(team.id) ?? 0), 0);

  function runSchedule() {
    const previous = output;
    const next = generateRoadmap({ teams, engineers, initiatives, settings });

    if (previous) {
      const previousById = new Map(previous.scheduled.map((row) => [row.initiativeId, row]));
      const diffLogs: ChangelogEntry[] = [];
      next.scheduled.forEach((row) => {
        const old = previousById.get(row.initiativeId);
        if (!old) return;
        if (
          old.startSprint !== row.startSprint ||
          old.endSprint !== row.endSprint ||
          old.remainingEffort !== row.remainingEffort
        ) {
          diffLogs.push({
            id: `DIFF-${row.initiativeId}`,
            level: "INFO",
            message: `${row.initiativeName} changed from S${old.startSprint ?? "-"}-S${old.endSprint ?? "-"} to S${row.startSprint ?? "-"}-S${row.endSprint ?? "-"}.`
          });
        }
      });
      next.changelog = [...diffLogs, ...next.changelog];
    }

    setOutput(next);
    setMessage(`Scheduled ${next.scheduled.length} initiatives across ${settings.totalSprints} sprints.`);
  }

  function saveDraft() {
    const payload: DraftState = { teams, engineers, initiatives, settings };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setMessage("Saved draft locally.");
  }

  function resetSample() {
    setTeams(SAMPLE_PLAN.teams);
    setEngineers(SAMPLE_PLAN.engineers);
    setInitiatives(SAMPLE_PLAN.initiatives);
    setSettings(DEFAULT_SETTINGS);
    setOutput(null);
    setMessage("Reset to sample data.");
  }

  function addTeam() {
    if (!newTeamName.trim()) return;
    setTeams((prev) => [...prev, { id: uid("team"), name: newTeamName.trim(), engineerIds: [] }]);
    setNewTeamName("");
  }

  function addEngineer(teamId: string) {
    const id = uid("eng");
    setEngineers((prev) => [
      ...prev,
      {
        id,
        name: "New Engineer",
        initials: "NE",
        teamId,
        sprintCapacity: Array.from({ length: settings.totalSprints }, () => 6)
      }
    ]);
    setTeams((prev) =>
      prev.map((team) => (team.id === teamId ? { ...team, engineerIds: [...team.engineerIds, id] } : team))
    );
  }

  function addInitiative() {
    const firstTeam = teams[0]?.id;
    if (!firstTeam) return;
    setInitiatives((prev) => [
      ...prev,
      {
        id: uid("init"),
        name: "New Initiative",
        effort: 8,
        priority: "P2",
        dependencyIds: [],
        teamId: firstTeam
      }
    ]);
  }

  function removeTeam(teamId: string) {
    setTeams((prev) => prev.filter((team) => team.id !== teamId));
    setEngineers((prev) => prev.filter((engineer) => engineer.teamId !== teamId));
    setInitiatives((prev) => prev.filter((initiative) => initiative.teamId !== teamId));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="section-title">
          <h2>Teams</h2>
          <Hint text="Set each engineer's available points per sprint. Team capacity is the sum." />
        </div>
        <div className="team-adder">
          <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="New team..." />
          <button onClick={addTeam}>+</button>
        </div>

        {teams.map((team) => {
          const teamEngineers = engineers.filter((engineer) => engineer.teamId === team.id);
          return (
            <section key={team.id} className="team-card">
              <div className="team-header">
                <input
                  className="team-name"
                  value={team.name}
                  onChange={(e) =>
                    setTeams((prev) => prev.map((row) => (row.id === team.id ? { ...row, name: e.target.value } : row)))
                  }
                />
                <span>{teamCapacitySummary.get(team.id) ?? 0}pts</span>
                <button onClick={() => removeTeam(team.id)}>×</button>
              </div>
              {teamEngineers.map((engineer) => (
                <div key={engineer.id} className="engineer-row">
                  <span className="initials">{engineer.initials}</span>
                  <input
                    value={engineer.name}
                    onChange={(e) =>
                      setEngineers((prev) =>
                        prev.map((item) =>
                          item.id === engineer.id
                            ? { ...item, name: e.target.value, initials: initialsFromName(e.target.value) }
                            : item
                        )
                      )
                    }
                  />
                  <div className="capacity-inline" title="Each box is capacity points for sprint S1, S2, S3...">
                    {Array.from({ length: settings.totalSprints }, (_, index) => (
                      <input
                        key={`${engineer.id}-cap-${index}`}
                        type="number"
                        min={0}
                        value={engineer.sprintCapacity[index] ?? 0}
                        onChange={(e) =>
                          setEngineers((prev) =>
                            prev.map((item) => {
                              if (item.id !== engineer.id) return item;
                              const sprintCapacity = [...item.sprintCapacity];
                              sprintCapacity[index] = parseNumber(e.target.value, 0);
                              return { ...item, sprintCapacity };
                            })
                          )
                        }
                      />
                    ))}
                  </div>
                  <button onClick={() => setEngineers((prev) => prev.filter((item) => item.id !== engineer.id))}>−</button>
                </div>
              ))}
              <button className="text-btn" onClick={() => addEngineer(team.id)}>
                + Add engineer
              </button>
            </section>
          );
        })}
      </aside>

      <section className="main-pane">
        <header className="top-bar">
          <div>
            <h1>Roadmap Planner</h1>
            <p>
              {teams.length} teams · {initiatives.length} initiatives · {totalEffort}pts effort · {totalCapacityPerSprint}
              pts/sprint capacity
            </p>
          </div>
          <div className="top-actions">
            <input
              type="number"
              min={4}
              value={settings.totalSprints}
              onChange={(e) => setSettings((prev) => ({ ...prev, totalSprints: parseNumber(e.target.value, 10) }))}
              title="Total sprints"
            />
            <button onClick={saveDraft}>Save</button>
            <button onClick={resetSample}>Reset</button>
            <button className="primary" onClick={runSchedule}>
              Schedule
            </button>
          </div>
        </header>

        <section className="mapper-card">
          <div className="section-title">
            <strong>How effort maps to capacity</strong>
            <Hint text="Effort and capacity use the same unit (points). 1 point of effort consumes 1 point of team capacity in a sprint." />
          </div>
          <p>
            Timeline cells show points assigned in each sprint. Capacity shows <strong>used/capacity</strong> per team and sprint.
            Teal = healthy, amber = high usage, red = overloaded/conflict.
          </p>
        </section>

        <section className="initiatives-panel">
          <div className="section-heading">
            <div className="section-title">
              <h3>Initiatives</h3>
              <Hint text="Priority order is P0 first. Dependencies force a start after predecessor completion." />
            </div>
            <button onClick={addInitiative}>+ Add</button>
          </div>
          <div className="initiative-row labels">
            <span>Name</span>
            <span>Prio</span>
            <span>Effort</span>
            <span>Team</span>
            <span>Deps</span>
            <span>Start</span>
            <span>End</span>
            <span />
          </div>
          {sortedInitiatives.map((initiative) => (
            <div key={initiative.id} className="initiative-row">
              <input
                value={initiative.name}
                onChange={(e) =>
                  setInitiatives((prev) =>
                    prev.map((item) => (item.id === initiative.id ? { ...item, name: e.target.value } : item))
                  )
                }
                placeholder="Initiative"
              />
              <select
                value={initiative.priority}
                onChange={(e) =>
                  setInitiatives((prev) =>
                    prev.map((item) => (item.id === initiative.id ? { ...item, priority: e.target.value as Priority } : item))
                  )
                }
                title="Priority"
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={initiative.effort}
                onChange={(e) =>
                  setInitiatives((prev) =>
                    prev.map((item) => (item.id === initiative.id ? { ...item, effort: parseNumber(e.target.value, 1) } : item))
                  )
                }
                title="Effort in points"
              />
              <select
                value={initiative.teamId}
                onChange={(e) =>
                  setInitiatives((prev) =>
                    prev.map((item) => (item.id === initiative.id ? { ...item, teamId: e.target.value } : item))
                  )
                }
                title="Assigned team"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <select
                multiple
                value={initiative.dependencyIds}
                onChange={(e) => {
                  const dependencyIds = Array.from(e.target.selectedOptions, (option) => option.value);
                  setInitiatives((prev) =>
                    prev.map((item) => (item.id === initiative.id ? { ...item, dependencyIds } : item))
                  );
                }}
                title="Dependencies"
              >
                {sortedInitiatives
                  .filter((candidate) => candidate.id !== initiative.id)
                  .map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                placeholder="Start"
                min={1}
                value={initiative.targetWindow?.startSprint ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setInitiatives((prev) =>
                    prev.map((item) =>
                      item.id === initiative.id
                        ? {
                            ...item,
                            targetWindow: value
                              ? {
                                  startSprint: parseNumber(value, 1),
                                  endSprint: item.targetWindow?.endSprint ?? parseNumber(value, 1)
                                }
                              : undefined
                          }
                        : item
                    )
                  );
                }}
                title="Target start sprint"
              />
              <input
                type="number"
                placeholder="End"
                min={1}
                value={initiative.targetWindow?.endSprint ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setInitiatives((prev) =>
                    prev.map((item) =>
                      item.id === initiative.id
                        ? {
                            ...item,
                            targetWindow: value
                              ? {
                                  startSprint: item.targetWindow?.startSprint ?? parseNumber(value, 1),
                                  endSprint: parseNumber(value, 1)
                                }
                              : undefined
                          }
                        : item
                    )
                  );
                }}
                title="Target end sprint"
              />
              <button onClick={() => setInitiatives((prev) => prev.filter((item) => item.id !== initiative.id))}>×</button>
            </div>
          ))}
        </section>

        <section className="timeline-panel">
          <div className="section-title">
            <h3>Roadmap Timeline</h3>
            <Hint text="Numbers are effort points consumed in that sprint. Colored bars show span from start to finish sprint." />
          </div>
          <div
            className="timeline-grid"
            style={{ gridTemplateColumns: `220px repeat(${settings.totalSprints}, minmax(48px, 1fr))` }}
          >
            <div className="timeline-header">Initiative</div>
            {Array.from({ length: settings.totalSprints }, (_, i) => (
              <div key={`head-${i}`} className="timeline-header sprint-col">
                S{i + 1}
              </div>
            ))}
            {(output?.scheduled ?? []).map((row) => (
              <Fragment key={row.initiativeId}>
                <div className="initiative-name-cell">
                  <span className={`priority-dot ${row.priority.toLowerCase()}`} />
                  {teamsById.get(row.teamId)?.name}: {row.initiativeName}
                </div>
                {Array.from({ length: settings.totalSprints }, (_, i) => {
                  const sprint = i + 1;
                  const points = row.allocations.find((allocation) => allocation.sprint === sprint)?.points ?? 0;
                  return <div key={`${row.initiativeId}-${sprint}`} className="timeline-cell">{points > 0 ? points : ""}</div>;
                })}
                {row.startSprint && row.endSprint && (
                  <div
                    className={`bar ${row.priority.toLowerCase()}`}
                    style={{ gridColumn: `${row.startSprint + 1} / ${row.endSprint + 2}` }}
                    title={row.reasoning}
                  >
                    {row.initiativeName}
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </section>

        <section className="capacity-panel">
          <div className="section-title">
            <h3>Capacity View</h3>
            <Hint text="Used is scheduled effort points in that sprint. Capacity is team total from engineer sprint capacities." />
          </div>
          <div className="capacity-grid">
            {(output?.capacity ?? []).map((cell) => (
              <div key={`${cell.teamId}-${cell.sprint}`} className="capacity-cell">
                <div className="capacity-meta">
                  <span>{teamsById.get(cell.teamId)?.name}</span>
                  <span>S{cell.sprint}</span>
                </div>
                <div className="capacity-bar-shell">
                  <div className={`capacity-fill ${cell.status}`} style={{ width: `${Math.min(100, cell.utilizationPct)}%` }} />
                </div>
                <small>
                  {cell.used}/{cell.capacity} pts
                </small>
              </div>
            ))}
          </div>
        </section>
        <p className="message">{message}</p>
      </section>

      <aside className="changelog-pane">
        <div className="section-title">
          <h2>Changelog</h2>
          <Hint text="Every item explains why an initiative was placed, shifted, blocked, or marked as conflict." />
        </div>
        {!output && <p className="placeholder">Run scheduler to see decisions.</p>}
        <ul>
          {(output?.changelog ?? []).map((entry) => (
            <li key={entry.id} className={`log-entry ${entry.level.toLowerCase()}`}>
              <strong>{entry.level}</strong>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { generateRoadmap } from "@/lib/scheduler";
import {
  DEFAULT_SETTINGS,
  SAMPLE_PLAN,
  type ChangelogEntry,
  type Engineer,
  type ExternalLoad,
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
  externalLoads: ExternalLoad[];
  settings: PlanInput["settings"];
};

const STORAGE_KEY = "ai-pm-roadmap-v03";
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
  const [externalLoads, setExternalLoads] = useState<ExternalLoad[]>(SAMPLE_PLAN.externalLoads);
  const [initiatives, setInitiatives] = useState<Initiative[]>(SAMPLE_PLAN.initiatives);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [output, setOutput] = useState<PlanOutput | null>(null);
  const [message, setMessage] = useState("Define input, then schedule to see capacity vs effort.");
  const [newTeamName, setNewTeamName] = useState("");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as DraftState;
      setTeams(parsed.teams ?? SAMPLE_PLAN.teams);
      setEngineers(parsed.engineers ?? SAMPLE_PLAN.engineers);
      setExternalLoads(parsed.externalLoads ?? SAMPLE_PLAN.externalLoads);
      setInitiatives(parsed.initiatives ?? SAMPLE_PLAN.initiatives);
      setSettings(parsed.settings ?? DEFAULT_SETTINGS);
      setMessage("Loaded your last draft from browser storage.");
    } catch {
      setMessage("Could not load draft. Starting with sample data.");
    }
  }, []);

  useEffect(() => {
    const payload: DraftState = { teams, engineers, initiatives, externalLoads, settings };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [teams, engineers, initiatives, externalLoads, settings]);

  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const teamBaseCapacitySummary = useMemo(() => {
    const summary = new Map<string, number>();
    teams.forEach((team) => summary.set(team.id, 0));
    engineers.forEach((engineer) => {
      const current = summary.get(engineer.teamId) ?? 0;
      summary.set(engineer.teamId, current + (engineer.sprintCapacity[0] ?? 0));
    });
    return summary;
  }, [engineers, teams]);

  const teamLoadSummary = useMemo(() => {
    const summary = new Map<string, number>();
    teams.forEach((team) => summary.set(team.id, 0));
    externalLoads.forEach((load) => {
      const current = summary.get(load.teamId) ?? 0;
      summary.set(load.teamId, current + (load.sprintLoad[0] ?? 0));
    });
    return summary;
  }, [externalLoads, teams]);

  const sortedInitiatives = useMemo(() => [...initiatives].sort((a, b) => a.name.localeCompare(b.name)), [initiatives]);

  const totalEffort = initiatives.reduce((sum, initiative) => sum + initiative.effort, 0);
  const totalBaseCapacityPerSprint = teams.reduce((sum, team) => sum + (teamBaseCapacitySummary.get(team.id) ?? 0), 0);
  const totalExternalPerSprint = teams.reduce((sum, team) => sum + (teamLoadSummary.get(team.id) ?? 0), 0);

  const sprintMap = useMemo(() => {
    if (!output) return [];
    return Array.from({ length: settings.totalSprints }, (_, index) => {
      const sprint = index + 1;
      const cells = output.capacity.filter((cell) => cell.sprint === sprint);
      const base = cells.reduce((sum, cell) => sum + cell.baseCapacity, 0);
      const load = cells.reduce((sum, cell) => sum + cell.externalLoad, 0);
      const available = cells.reduce((sum, cell) => sum + cell.capacity, 0);
      const used = cells.reduce((sum, cell) => sum + cell.used, 0);
      const max = Math.max(base, available, used, 1);
      return { sprint, base, load, available, used, max };
    });
  }, [output, settings.totalSprints]);

  function runSchedule() {
    const previous = output;
    const next = generateRoadmap({ teams, engineers, initiatives, externalLoads, settings });

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

  function resetSample() {
    setTeams(SAMPLE_PLAN.teams);
    setEngineers(SAMPLE_PLAN.engineers);
    setExternalLoads(SAMPLE_PLAN.externalLoads);
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
    setTeams((prev) => prev.map((team) => (team.id === teamId ? { ...team, engineerIds: [...team.engineerIds, id] } : team)));
  }

  function addExternalLoad(teamId: string) {
    setExternalLoads((prev) => [
      ...prev,
      { id: uid("load"), teamId, name: "Support", sprintLoad: Array.from({ length: settings.totalSprints }, () => 1) }
    ]);
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
    setExternalLoads((prev) => prev.filter((load) => load.teamId !== teamId));
    setInitiatives((prev) => prev.filter((initiative) => initiative.teamId !== teamId));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="section-title">
          <h2>Team capacity input</h2>
          <Hint text="Capacity = sum of engineer points. External load = work that burns sprint points (support, incidents, urgent requests)." />
        </div>
        <div className="team-adder">
          <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="New team..." />
          <button onClick={addTeam}>+</button>
        </div>

        {teams.map((team) => {
          const teamEngineers = engineers.filter((engineer) => engineer.teamId === team.id);
          const loads = externalLoads.filter((load) => load.teamId === team.id);
          const teamBase = teamBaseCapacitySummary.get(team.id) ?? 0;
          const teamLoad = teamLoadSummary.get(team.id) ?? 0;
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
                <span>{teamBase - teamLoad}pts</span>
                <button onClick={() => removeTeam(team.id)}>×</button>
              </div>

              <div className="formula-row">Base {teamBase} − External {teamLoad} = Available {Math.max(0, teamBase - teamLoad)} (S1)</div>

              {teamEngineers.map((engineer) => (
                <div key={engineer.id} className="engineer-row">
                  <span className="initials">{engineer.initials}</span>
                  <input
                    value={engineer.name}
                    onChange={(e) =>
                      setEngineers((prev) =>
                        prev.map((item) =>
                          item.id === engineer.id ? { ...item, name: e.target.value, initials: initialsFromName(e.target.value) } : item
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

              <div className="load-label">External load per sprint</div>
              {loads.map((load) => (
                <div key={load.id} className="load-row">
                  <input
                    value={load.name}
                    onChange={(e) =>
                      setExternalLoads((prev) => prev.map((row) => (row.id === load.id ? { ...row, name: e.target.value } : row)))
                    }
                  />
                  <div className="capacity-inline">
                    {Array.from({ length: settings.totalSprints }, (_, index) => (
                      <input
                        key={`${load.id}-${index}`}
                        type="number"
                        min={0}
                        value={load.sprintLoad[index] ?? 0}
                        onChange={(e) =>
                          setExternalLoads((prev) =>
                            prev.map((row) => {
                              if (row.id !== load.id) return row;
                              const sprintLoad = [...row.sprintLoad];
                              sprintLoad[index] = parseNumber(e.target.value, 0);
                              return { ...row, sprintLoad };
                            })
                          )
                        }
                      />
                    ))}
                  </div>
                  <button onClick={() => setExternalLoads((prev) => prev.filter((row) => row.id !== load.id))}>−</button>
                </div>
              ))}
              <button className="text-btn" onClick={() => addExternalLoad(team.id)}>
                + Add external variable
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
              {teams.length} teams · {initiatives.length} initiatives · {totalEffort}pts effort · base {totalBaseCapacityPerSprint}
              pts/sprint · external {totalExternalPerSprint}
            </p>
          </div>
          <div className="top-actions">
            <label className="inline-label">
              Sprints
              <input
                type="number"
                min={4}
                value={settings.totalSprints}
                onChange={(e) => setSettings((prev) => ({ ...prev, totalSprints: parseNumber(e.target.value, 10) }))}
                title="Total sprints"
              />
            </label>
            <button onClick={resetSample}>Reset</button>
            <button className="primary" onClick={runSchedule}>
              Schedule
            </button>
          </div>
        </header>

        <section className="mapper-card">
          <div className="section-title">
            <strong>Capacity model (clear math)</strong>
            <Hint text="1 effort point consumes 1 available capacity point. Available capacity is reduced by external variables before scheduling starts." />
          </div>
          <p>
            <strong>Per team and sprint:</strong> available capacity = engineer capacity − external load. Scheduler then allocates initiative effort by priority and dependencies into those available points.
          </p>
        </section>

        <section className="initiatives-panel">
          <div className="section-heading">
            <div className="section-title">
              <h3>Initiative input</h3>
              <Hint text="Simplified form: define effort, team, priority, and optional target range. Multi-select dependencies for sequence constraints." />
            </div>
            <button onClick={addInitiative}>+ Add</button>
          </div>
          <div className="initiative-row labels">
            <span>Name</span>
            <span>Prio</span>
            <span>Effort</span>
            <span>Team</span>
            <span>Deps</span>
            <span>Target start</span>
            <span>Target end</span>
            <span />
          </div>
          {sortedInitiatives.map((initiative) => (
            <div key={initiative.id} className="initiative-row">
              <input
                value={initiative.name}
                onChange={(e) =>
                  setInitiatives((prev) => prev.map((item) => (item.id === initiative.id ? { ...item, name: e.target.value } : item)))
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
              />
              <select
                value={initiative.teamId}
                onChange={(e) =>
                  setInitiatives((prev) => prev.map((item) => (item.id === initiative.id ? { ...item, teamId: e.target.value } : item)))
                }
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
                  setInitiatives((prev) => prev.map((item) => (item.id === initiative.id ? { ...item, dependencyIds } : item)));
                }}
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
                              ? { startSprint: parseNumber(value, 1), endSprint: item.targetWindow?.endSprint ?? parseNumber(value, 1) }
                              : undefined
                          }
                        : item
                    )
                  );
                }}
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
                              ? { startSprint: item.targetWindow?.startSprint ?? parseNumber(value, 1), endSprint: parseNumber(value, 1) }
                              : undefined
                          }
                        : item
                    )
                  );
                }}
              />
              <button onClick={() => setInitiatives((prev) => prev.filter((item) => item.id !== initiative.id))}>×</button>
            </div>
          ))}
        </section>

        <section className="capacity-map-panel">
          <div className="section-title">
            <h3>Sprint map: capacity vs effort</h3>
            <Hint text="Blue = base team capacity. Purple = external load. Teal = scheduled effort consumption from roadmap initiatives." />
          </div>
          {!output ? (
            <p className="placeholder">Schedule once to render the sprint map.</p>
          ) : (
            <div className="sprint-map-grid">
              {sprintMap.map((item) => (
                <div key={item.sprint} className="sprint-map-card">
                  <div className="sprint-map-head">S{item.sprint}</div>
                  <div className="metric-bar-shell">
                    <div className="metric-bar base" style={{ width: `${(item.base / item.max) * 100}%` }} />
                  </div>
                  <div className="metric-meta">Base {item.base}</div>
                  <div className="metric-bar-shell">
                    <div className="metric-bar load" style={{ width: `${(item.load / item.max) * 100}%` }} />
                  </div>
                  <div className="metric-meta">External {item.load}</div>
                  <div className="metric-bar-shell">
                    <div className="metric-bar used" style={{ width: `${(item.used / item.max) * 100}%` }} />
                  </div>
                  <div className="metric-meta">Effort used {item.used} / Available {item.available}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="timeline-panel">
          <div className="section-title">
            <h3>Roadmap timeline by sprint</h3>
            <Hint text="Each cell is effort points assigned in that sprint. Bars show initiative duration and priority color." />
          </div>
          <div className="timeline-grid" style={{ gridTemplateColumns: `220px repeat(${settings.totalSprints}, minmax(48px, 1fr))` }}>
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
                  return (
                    <div key={`${row.initiativeId}-${sprint}`} className="timeline-cell">
                      {points > 0 ? points : ""}
                    </div>
                  );
                })}
                {row.startSprint && row.endSprint && (
                  <div className={`bar ${row.priority.toLowerCase()}`} style={{ gridColumn: `${row.startSprint + 1} / ${row.endSprint + 2}` }} title={row.reasoning}>
                    {row.initiativeName}
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </section>

        <section className="capacity-panel">
          <div className="section-title">
            <h3>Per team, per sprint utilization</h3>
            <Hint text="Shows used / available after external load deduction. High utilization warns for delivery risk." />
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
                  {cell.used}/{cell.capacity} pts · base {cell.baseCapacity} · ext {cell.externalLoad}
                </small>
              </div>
            ))}
          </div>
        </section>
        <p className="message">{message} (autosaved)</p>
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

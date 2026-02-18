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

const STORAGE_KEY = "ai-pm-roadmap-v04";
const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];
const INITIATIVES_PER_PAGE = 3;

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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
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
  const [initiativePage, setInitiativePage] = useState(0);

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
  const initiativePages = Math.max(1, Math.ceil(sortedInitiatives.length / INITIATIVES_PER_PAGE));
  const normalizedInitiativePage = Math.min(initiativePage, initiativePages - 1);
  const pagedInitiatives = sortedInitiatives.slice(
    normalizedInitiativePage * INITIATIVES_PER_PAGE,
    normalizedInitiativePage * INITIATIVES_PER_PAGE + INITIATIVES_PER_PAGE
  );

  useEffect(() => {
    setInitiativePage((prev) => Math.min(prev, Math.max(0, initiativePages - 1)));
  }, [initiativePages]);

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

  function resetToSample() {
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
    const capacity = Array.from({ length: settings.totalSprints }, () => 75);
    setEngineers((prev) => [
      ...prev,
      {
        id,
        name: "New Engineer",
        initials: "NE",
        teamId,
        sprintCapacity: capacity
      }
    ]);
    setTeams((prev) => prev.map((team) => (team.id === teamId ? { ...team, engineerIds: [...team.engineerIds, id] } : team)));
  }

  function addExternalLoad(teamId: string) {
    setExternalLoads((prev) => [
      ...prev,
      {
        id: uid("load"),
        teamId,
        name: "Meetings",
        sprintLoad: Array.from({ length: settings.totalSprints }, () => 15)
      }
    ]);
  }

  function addInitiative() {
    const fallbackTeam = teams[0]?.id;
    if (!fallbackTeam) return;
    setInitiativePage(0);
    setInitiatives((prev) => [
      ...prev,
      {
        id: uid("init"),
        name: "New Initiative",
        effort: 100,
        priority: "P2",
        dependencyIds: [],
        teamId: fallbackTeam
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
          <Hint text="Capacity and effort are treated as sprint percentage points. Available = Capacity - External - Planned effort." />
        </div>

        <div className="team-adder">
          <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="New team..." />
          <button onClick={addTeam}>Add</button>
        </div>

        {teams.map((team) => {
          const teamEngineers = engineers.filter((engineer) => engineer.teamId === team.id);
          const loads = externalLoads.filter((load) => load.teamId === team.id);
          const teamBase = teamBaseCapacitySummary.get(team.id) ?? 0;
          const teamLoad = teamLoadSummary.get(team.id) ?? 0;
          const teamAvailable = Math.max(0, teamBase - teamLoad);
          const overBy = Math.max(0, teamLoad - teamBase);

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
                <button className="icon-btn" onClick={() => removeTeam(team.id)}>
                  ×
                </button>
              </div>

              {teamEngineers.map((engineer) => (
                <div key={engineer.id} className="engineer-card">
                  <div className="engineer-head">
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
                    <button className="icon-btn" onClick={() => setEngineers((prev) => prev.filter((item) => item.id !== engineer.id))}>
                      ×
                    </button>
                  </div>
                  <div className="capacity-row">
                    <span>Capacity</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={engineer.sprintCapacity[0] ?? 0}
                      onChange={(e) =>
                        setEngineers((prev) =>
                          prev.map((item) => {
                            if (item.id !== engineer.id) return item;
                            const sprintCapacity = [...item.sprintCapacity];
                            sprintCapacity[0] = clampPercent(parseNumber(e.target.value, 0));
                            return { ...item, sprintCapacity };
                          })
                        )
                      }
                    />
                    <strong>{engineer.sprintCapacity[0] ?? 0}%</strong>
                  </div>
                  <div className="capacity-pills">
                    <span className="muted-pill">Capacity {engineer.sprintCapacity[0] ?? 0}%</span>
                    <span className="muted-pill">Available {Math.max(0, (engineer.sprintCapacity[0] ?? 0) - Math.round(teamLoad / Math.max(teamEngineers.length, 1)))}%</span>
                    <span className="muted-pill">Over {Math.max(0, Math.round(teamLoad / Math.max(teamEngineers.length, 1)) - (engineer.sprintCapacity[0] ?? 0))}%</span>
                  </div>
                </div>
              ))}

              <button className="text-btn" onClick={() => addEngineer(team.id)}>
                + Add engineer
              </button>

              <div className="external-section">
                <div className="load-label">External</div>
                <div className="pill-stack">
                  {loads.map((load) => (
                    <div key={load.id} className="external-pill-row">
                      <input
                        className="pill-name"
                        value={load.name}
                        onChange={(e) =>
                          setExternalLoads((prev) => prev.map((row) => (row.id === load.id ? { ...row, name: e.target.value } : row)))
                        }
                      />
                      <input
                        className="pill-value"
                        type="number"
                        min={0}
                        max={100}
                        value={load.sprintLoad[0] ?? 0}
                        onChange={(e) =>
                          setExternalLoads((prev) =>
                            prev.map((row) => {
                              if (row.id !== load.id) return row;
                              const sprintLoad = [...row.sprintLoad];
                              sprintLoad[0] = clampPercent(parseNumber(e.target.value, 0));
                              return { ...row, sprintLoad };
                            })
                          )
                        }
                      />
                      <span className="pill-unit">%</span>
                      <button className="icon-btn" onClick={() => setExternalLoads((prev) => prev.filter((row) => row.id !== load.id))}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button className="text-btn" onClick={() => addExternalLoad(team.id)}>
                  + Add external
                </button>
              </div>

              <div className="team-capacity-wrap">
                <div className="team-capacity-meta">
                  <span>Capacity {teamBase}%</span>
                  <span>Available {teamAvailable}%</span>
                  {overBy > 0 ? <span>Over {overBy}%</span> : <span>Over 0%</span>}
                </div>
                <div className="capacity-bar-shell thin">
                  <div className={`capacity-fill ${overBy > 0 ? "over" : teamAvailable < teamBase * 0.15 ? "high" : "healthy"}`} style={{ width: `${Math.min(100, (teamAvailable / Math.max(teamBase, 1)) * 100)}%` }} />
                </div>
              </div>
            </section>
          );
        })}
      </aside>

      <section className="main-pane">
        <header className="top-bar">
          <div>
            <h1>Roadmap Planner</h1>
            <p>
              {teams.length} teams · {initiatives.length} initiatives · {totalEffort}% effort · capacity {totalBaseCapacityPerSprint}% / sprint ·
              external {totalExternalPerSprint}%
            </p>
          </div>
          <div className="top-actions">
            <label className="inline-label">
              Sprints
              <input
                type="number"
                min={1}
                max={20}
                value={settings.totalSprints}
                onChange={(e) => setSettings((prev) => ({ ...prev, totalSprints: parseNumber(e.target.value, 1) }))}
              />
            </label>
            <button onClick={resetToSample}>Reset</button>
            <button className="primary" onClick={runSchedule}>
              Schedule
            </button>
          </div>
        </header>

        <section className="mapper-card">
          <div className="section-title">
            <h3>Capacity model</h3>
            <Hint text="Per sprint: available capacity = engineer capacity (%) − external (%) − scheduled effort (%)." />
          </div>
          <p>
            <strong>Per team, per sprint:</strong> available capacity = sum(engineer capacity %) − external %. The scheduler allocates
            initiative effort percentages by priority and dependencies.
          </p>
        </section>

        <section className="initiatives-panel">
          <div className="section-heading">
            <div className="section-title">
              <h3>Initiatives</h3>
              <Hint text="Minimal list by default: we show 3 initiatives per page. Use pager controls to review more." />
            </div>
            <div className="initiative-actions">
              <div className="pager" aria-label="Initiative pages">
                <button
                  className="icon-btn"
                  title="Previous page"
                  onClick={() => setInitiativePage((prev) => Math.max(0, prev - 1))}
                  disabled={normalizedInitiativePage === 0}
                >
                  ‹
                </button>
                <span className="pager-label">
                  Page {normalizedInitiativePage + 1} / {initiativePages}
                </span>
                <button
                  className="icon-btn"
                  title="Next page"
                  onClick={() => setInitiativePage((prev) => Math.min(initiativePages - 1, prev + 1))}
                  disabled={normalizedInitiativePage >= initiativePages - 1}
                >
                  ›
                </button>
              </div>
              <button title="Create a new initiative" onClick={addInitiative}>
                + Add initiative
              </button>
            </div>
          </div>
          <div className="initiative-row labels">
            <span>Name</span>
            <span>Priority</span>
            <span>Effort %</span>
            <span>Team</span>
            <span>Dependencies</span>
            <span>Target start</span>
            <span>Target end</span>
            <span />
          </div>
          {pagedInitiatives.map((initiative) => (
            <div key={initiative.id} className="initiative-row">
              <input
                value={initiative.name}
                onChange={(e) =>
                  setInitiatives((prev) => prev.map((item) => (item.id === initiative.id ? { ...item, name: e.target.value } : item)))
                }
                placeholder="Initiative"
                title="Initiative name"
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
                title="Effort as percentage of one engineer sprint"
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
                title="Hold Cmd/Ctrl to select dependencies"
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
              <button className="icon-btn" onClick={() => setInitiatives((prev) => prev.filter((item) => item.id !== initiative.id))}>
                ×
              </button>
            </div>
          ))}
        </section>

        <section className="capacity-map-panel">
          <div className="section-title">
            <h3>Sprint map: capacity vs effort</h3>
            <Hint text="Muted bars show base capacity, external usage, and scheduled effort." />
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
                  <div className="metric-meta">Capacity {item.base}%</div>
                  <div className="metric-bar-shell">
                    <div className="metric-bar load" style={{ width: `${(item.load / item.max) * 100}%` }} />
                  </div>
                  <div className="metric-meta">External {item.load}%</div>
                  <div className="metric-bar-shell">
                    <div className="metric-bar used" style={{ width: `${(item.used / item.max) * 100}%` }} />
                  </div>
                  <div className="metric-meta">Effort used {item.used}% / Available {item.available}%</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="timeline-panel">
          <div className="section-title">
            <h3>Roadmap timeline by sprint</h3>
            <Hint text="Each cell is effort % assigned in that sprint." />
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
                      {points > 0 ? `${points}%` : ""}
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
            <Hint text="Capacity, external and effort are shown as percentages." />
          </div>
          <div className="capacity-grid">
            {(output?.capacity ?? []).map((cell) => (
              <div key={`${cell.teamId}-${cell.sprint}`} className="capacity-cell">
                <div className="capacity-meta">
                  <span>{teamsById.get(cell.teamId)?.name}</span>
                  <span>S{cell.sprint}</span>
                </div>
                <div className="capacity-bar-shell thin">
                  <div className={`capacity-fill ${cell.status}`} style={{ width: `${Math.min(100, cell.utilizationPct)}%` }} />
                </div>
                <small>
                  {cell.used}% / {cell.capacity}% · base {cell.baseCapacity}% · ext {cell.externalLoad}%
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

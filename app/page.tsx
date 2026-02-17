"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { generateRoadmap } from "@/lib/scheduler";
import {
  DEFAULT_SETTINGS,
  SAMPLE_PLAN,
  type ChangelogEntry,
  type Initiative,
  type PlanInput,
  type PlanOutput,
  type Team
} from "@/lib/types";

type DraftState = {
  teams: Team[];
  initiatives: Initiative[];
  settings: PlanInput["settings"];
};

const STORAGE_KEY = "ai-pm-roadmap-v01";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function HomePage() {
  const [teams, setTeams] = useState<Team[]>(SAMPLE_PLAN.teams);
  const [initiatives, setInitiatives] = useState<Initiative[]>(SAMPLE_PLAN.initiatives);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [output, setOutput] = useState<PlanOutput | null>(null);
  const [message, setMessage] = useState<string>("Edit inputs and generate a roadmap.");

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as DraftState;
      setTeams(parsed.teams ?? SAMPLE_PLAN.teams);
      setInitiatives(parsed.initiatives ?? SAMPLE_PLAN.initiatives);
      setSettings(parsed.settings ?? DEFAULT_SETTINGS);
      setMessage("Loaded your local draft.");
    } catch {
      setMessage("Could not load saved draft. Using sample data.");
    }
  }, []);

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    teams.forEach((team) => map.set(team.id, team.name));
    return map;
  }, [teams]);

  const sortedInitiatives = useMemo(
    () => [...initiatives].sort((a, b) => a.name.localeCompare(b.name)),
    [initiatives]
  );

  function runGenerate() {
    const result = generateRoadmap({ teams, initiatives, settings });
    setOutput(result);
    setMessage(`Generated roadmap with ${result.scheduled.length} scheduled initiatives.`);
  }

  function saveDraft() {
    const payload: DraftState = { teams, initiatives, settings };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setMessage("Saved draft locally.");
  }

  function resetSample() {
    setTeams(SAMPLE_PLAN.teams);
    setInitiatives(SAMPLE_PLAN.initiatives);
    setSettings(DEFAULT_SETTINGS);
    setOutput(null);
    setMessage("Reset to sample data.");
  }

  function addTeam() {
    setTeams((prev) => [...prev, { id: uid("team"), name: "New Team", weeklyCapacityPoints: 10 }]);
  }

  function addInitiative() {
    setInitiatives((prev) => [
      ...prev,
      {
        id: uid("init"),
        name: "New Initiative",
        teamId: teams[0]?.id ?? "",
        sizePoints: 8,
        priority: 50,
        dependencyIds: []
      }
    ]);
  }

  function renderChangelogItem(entry: ChangelogEntry) {
    return (
      <li key={entry.id} className={`log-${entry.level}`}>
        <strong>{entry.level}</strong> · {entry.message}
      </li>
    );
  }

  return (
    <main className="page">
      <h1>Capacity-aware Roadmap Builder</h1>
      <p className="subtitle">{message}</p>

      <section className="toolbar">
        <button onClick={runGenerate}>Generate roadmap</button>
        <button onClick={saveDraft}>Save draft</button>
        <button onClick={resetSample}>Reset sample data</button>
      </section>

      <section className="layout">
        <div className="panel">
          <h2>Teams</h2>
          <button onClick={addTeam}>Add team</button>
          {teams.length === 0 && <p className="empty">Add at least one team.</p>}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Weekly capacity</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <input
                      value={team.name}
                      onChange={(e) =>
                        setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, name: e.target.value } : t)))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={team.weeklyCapacityPoints}
                      onChange={(e) =>
                        setTeams((prev) =>
                          prev.map((t) =>
                            t.id === team.id ? { ...t, weeklyCapacityPoints: parseNumber(e.target.value, 0) } : t
                          )
                        )
                      }
                    />
                  </td>
                  <td>
                    <button onClick={() => setTeams((prev) => prev.filter((t) => t.id !== team.id))}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>Initiatives</h2>
          <button onClick={addInitiative}>Add initiative</button>
          {initiatives.length === 0 && <p className="empty">Add at least one initiative.</p>}
          <div className="initiatives">
            {initiatives.map((initiative) => (
              <form key={initiative.id} className="initiative-card" onSubmit={(e: FormEvent) => e.preventDefault()}>
                <input
                  value={initiative.name}
                  onChange={(e) =>
                    setInitiatives((prev) =>
                      prev.map((i) => (i.id === initiative.id ? { ...i, name: e.target.value } : i))
                    )
                  }
                />
                <div className="grid-2">
                  <label>
                    Team
                    <select
                      value={initiative.teamId}
                      onChange={(e) =>
                        setInitiatives((prev) =>
                          prev.map((i) => (i.id === initiative.id ? { ...i, teamId: e.target.value } : i))
                        )
                      }
                    >
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Size
                    <input
                      type="number"
                      min={1}
                      value={initiative.sizePoints}
                      onChange={(e) =>
                        setInitiatives((prev) =>
                          prev.map((i) =>
                            i.id === initiative.id ? { ...i, sizePoints: parseNumber(e.target.value, 1) } : i
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    Priority
                    <input
                      type="number"
                      value={initiative.priority}
                      onChange={(e) =>
                        setInitiatives((prev) =>
                          prev.map((i) =>
                            i.id === initiative.id ? { ...i, priority: parseNumber(e.target.value, 0) } : i
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    Dependencies
                    <select
                      multiple
                      value={initiative.dependencyIds}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions, (option) => option.value);
                        setInitiatives((prev) =>
                          prev.map((i) => (i.id === initiative.id ? { ...i, dependencyIds: values } : i))
                        );
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
                  </label>
                </div>
                <div className="grid-2">
                  <label>
                    Window start (optional)
                    <input
                      type="number"
                      min={1}
                      value={initiative.targetWindow?.startWeek ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setInitiatives((prev) =>
                          prev.map((i) =>
                            i.id === initiative.id
                              ? {
                                  ...i,
                                  targetWindow: value
                                    ? {
                                        startWeek: parseNumber(value, 1),
                                        endWeek: i.targetWindow?.endWeek ?? parseNumber(value, 1)
                                      }
                                    : undefined
                                }
                              : i
                          )
                        );
                      }}
                    />
                  </label>
                  <label>
                    Window end (optional)
                    <input
                      type="number"
                      min={1}
                      value={initiative.targetWindow?.endWeek ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setInitiatives((prev) =>
                          prev.map((i) =>
                            i.id === initiative.id
                              ? {
                                  ...i,
                                  targetWindow: value
                                    ? {
                                        startWeek: i.targetWindow?.startWeek ?? parseNumber(value, 1),
                                        endWeek: parseNumber(value, 1)
                                      }
                                    : undefined
                                }
                              : i
                          )
                        );
                      }}
                    />
                  </label>
                </div>
                <button onClick={() => setInitiatives((prev) => prev.filter((i) => i.id !== initiative.id))}>Delete</button>
              </form>
            ))}
          </div>

          <h2>Settings</h2>
          <div className="grid-2">
            <label>
              Total weeks
              <input
                type="number"
                min={1}
                value={settings.totalWeeks}
                onChange={(e) => setSettings((s) => ({ ...s, totalWeeks: parseNumber(e.target.value, 12) }))}
              />
            </label>
            <label>
              Strict target window
              <input
                type="checkbox"
                checked={settings.strictTargetWindow}
                onChange={(e) => setSettings((s) => ({ ...s, strictTargetWindow: e.target.checked }))}
              />
            </label>
          </div>
        </div>

        <div className="panel">
          <h2>Timeline</h2>
          {!output && <p className="empty">Generate roadmap to view timeline.</p>}
          {output && (
            <div className="timeline-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Initiative</th>
                    {Array.from({ length: settings.totalWeeks }, (_, index) => (
                      <th key={index}>W{index + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {output.scheduled.map((row) => (
                    <tr key={row.initiativeId}>
                      <td>{row.initiativeName}</td>
                      {Array.from({ length: settings.totalWeeks }, (_, index) => {
                        const week = index + 1;
                        const points = row.allocations.find((a) => a.week === week)?.points ?? 0;
                        return <td key={week}>{points > 0 ? points : ""}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>Capacity utilization</h2>
          {!output && <p className="empty">Generate roadmap to view utilization.</p>}
          {output && (
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Week</th>
                  <th>Used / Capacity</th>
                </tr>
              </thead>
              <tbody>
                {output.capacity.map((item) => (
                  <tr key={`${item.teamId}-${item.week}`}>
                    <td>{teamNameById.get(item.teamId) ?? item.teamId}</td>
                    <td>W{item.week}</td>
                    <td>
                      {item.used} / {item.capacity} ({item.utilizationPct}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <h2>Changelog & explanations</h2>
          {!output && <p className="empty">Generate roadmap to get explanations.</p>}
          {output && <ul className="log-list">{output.changelog.map(renderChangelogItem)}</ul>}
        </div>
      </section>
    </main>
  );
}

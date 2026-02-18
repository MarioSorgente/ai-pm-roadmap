export type Priority = "P0" | "P1" | "P2" | "P3";

export type Engineer = {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  teamId: string;
  sprintCapacity: number[];
};

export type Team = {
  id: string;
  name: string;
  engineerIds: string[];
};

export type ExternalLoad = {
  id: string;
  teamId: string;
  name: string;
  sprintLoad: number[];
};

export type TargetWindow = {
  startSprint: number;
  endSprint: number;
};

export type Initiative = {
  id: string;
  name: string;
  effort: number;
  priority: Priority;
  dependencyIds: string[];
  targetWindow?: TargetWindow;
  teamId: string;
};

export type PlanInput = {
  teams: Team[];
  engineers: Engineer[];
  initiatives: Initiative[];
  externalLoads: ExternalLoad[];
  settings: {
    totalSprints: number;
  };
};

export type Allocation = {
  sprint: number;
  points: number;
};

export type ScheduledInitiative = {
  initiativeId: string;
  initiativeName: string;
  teamId: string;
  priority: Priority;
  allocations: Allocation[];
  startSprint: number | null;
  endSprint: number | null;
  remainingEffort: number;
  reasoning: string;
};

export type ChangelogLevel = "PLACED" | "WINDOW_MISSED" | "CONFLICT" | "BLOCKED" | "INFO";

export type ChangelogEntry = {
  id: string;
  level: ChangelogLevel;
  message: string;
};

export type CapacityCell = {
  teamId: string;
  sprint: number;
  used: number;
  capacity: number;
  baseCapacity: number;
  externalLoad: number;
  utilizationPct: number;
  status: "healthy" | "high" | "over";
};

export type PlanOutput = {
  scheduled: ScheduledInitiative[];
  capacity: CapacityCell[];
  changelog: ChangelogEntry[];
};

export const DEFAULT_SETTINGS: PlanInput["settings"] = {
  totalSprints: 10
};

export const SAMPLE_PLAN: Omit<PlanInput, "settings"> = {
  teams: [
    { id: "team-frontend", name: "Frontend", engineerIds: ["eng-alice", "eng-bob", "eng-cara"] },
    { id: "team-backend", name: "Backend", engineerIds: ["eng-dan", "eng-eve"] }
  ],
  engineers: [
    { id: "eng-alice", name: "Alice Chen", initials: "A", teamId: "team-frontend", sprintCapacity: [80, 80, 80, 75, 80, 80, 75, 80, 80, 80] },
    { id: "eng-bob", name: "Bob Kumar", initials: "B", teamId: "team-frontend", sprintCapacity: [75, 75, 75, 75, 70, 75, 75, 75, 75, 75] },
    { id: "eng-cara", name: "Cara Jones", initials: "C", teamId: "team-frontend", sprintCapacity: [70, 70, 70, 70, 70, 70, 65, 70, 70, 70] },
    { id: "eng-dan", name: "Dan Park", initials: "D", teamId: "team-backend", sprintCapacity: [85, 85, 85, 85, 80, 85, 85, 85, 85, 85] },
    { id: "eng-eve", name: "Eve Santos", initials: "E", teamId: "team-backend", sprintCapacity: [80, 80, 80, 75, 80, 80, 80, 80, 80, 80] }
  ],
  externalLoads: [
    { id: "load-support-frontend", teamId: "team-frontend", name: "Support", sprintLoad: [30, 30, 30, 30, 30, 25, 30, 30, 30, 30] },
    { id: "load-urgent-backend", teamId: "team-backend", name: "Urgent requests", sprintLoad: [20, 20, 25, 20, 20, 20, 25, 20, 20, 20] }
  ],
  initiatives: [
    { id: "init-auth", name: "User Auth Flow", effort: 160, priority: "P0", dependencyIds: [], teamId: "team-backend" },
    { id: "init-dashboard", name: "Dashboard UI", effort: 220, priority: "P1", dependencyIds: ["init-auth"], teamId: "team-frontend" },
    { id: "init-api", name: "API Gateway", effort: 90, priority: "P0", dependencyIds: [], teamId: "team-backend" },
    { id: "init-search", name: "Search Feature", effort: 140, priority: "P2", dependencyIds: ["init-dashboard"], teamId: "team-frontend" },
    {
      id: "init-payment",
      name: "Payment Integration",
      effort: 180,
      priority: "P1",
      dependencyIds: ["init-auth", "init-api"],
      targetWindow: { startSprint: 3, endSprint: 6 },
      teamId: "team-backend"
    }
  ]
};

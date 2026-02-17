export type Team = {
  id: string;
  name: string;
  weeklyCapacityPoints: number;
};

export type TargetWindow = {
  startWeek: number;
  endWeek: number;
};

export type Initiative = {
  id: string;
  name: string;
  teamId: string;
  sizePoints: number;
  priority: number;
  dependencyIds: string[];
  targetWindow?: TargetWindow;
};

export type PlanInput = {
  teams: Team[];
  initiatives: Initiative[];
  settings: {
    startWeek: number;
    totalWeeks: number;
    strictTargetWindow: boolean;
  };
};

export type Allocation = {
  week: number;
  points: number;
};

export type ScheduledInitiative = {
  initiativeId: string;
  initiativeName: string;
  teamId: string;
  allocations: Allocation[];
  unscheduledPoints: number;
};

export type ChangelogLevel =
  | "PLACED"
  | "DELAYED"
  | "UNSCHEDULED"
  | "CAPACITY_LIMIT"
  | "DEPENDENCY_BLOCKED"
  | "TARGET_WINDOW_MISSED"
  | "INVALID";

export type ChangelogEntry = {
  id: string;
  level: ChangelogLevel;
  message: string;
};

export type CapacityCell = {
  teamId: string;
  week: number;
  used: number;
  capacity: number;
  utilizationPct: number;
};

export type PlanOutput = {
  scheduled: ScheduledInitiative[];
  capacity: CapacityCell[];
  changelog: ChangelogEntry[];
};

export const DEFAULT_SETTINGS: PlanInput["settings"] = {
  startWeek: 1,
  totalWeeks: 12,
  strictTargetWindow: false
};

export const SAMPLE_PLAN: Omit<PlanInput, "settings"> = {
  teams: [
    { id: "team-platform", name: "Platform", weeklyCapacityPoints: 12 },
    { id: "team-growth", name: "Growth", weeklyCapacityPoints: 10 }
  ],
  initiatives: [
    {
      id: "init-auth",
      name: "Auth Revamp",
      teamId: "team-platform",
      sizePoints: 24,
      priority: 90,
      dependencyIds: []
    },
    {
      id: "init-onboarding",
      name: "Self-serve Onboarding",
      teamId: "team-growth",
      sizePoints: 18,
      priority: 80,
      dependencyIds: ["init-auth"],
      targetWindow: { startWeek: 3, endWeek: 8 }
    },
    {
      id: "init-analytics",
      name: "Usage Analytics",
      teamId: "team-growth",
      sizePoints: 16,
      priority: 70,
      dependencyIds: []
    }
  ]
};

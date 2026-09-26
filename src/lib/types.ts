export type TaskType = "project" | "simple" | "subtask" | null;

export type TaskStatus = "todo" | "delegated" | "progress" | "done";

/** Project-level GTD lifecycle state — independent of subtask progress. */
export type ProjectState = "active" | "paused" | "someday" | "done";

/** Goals sit above projects (GTD "horizons"): goal → sub-goals → projects → tasks. */
export type GoalStatus = "backlog" | "in_progress" | "paused" | "done" | "dropped";
export type GoalPriority = "high" | "medium" | "low";

export interface Goal {
  id: string;
  parentId: string | null;
  title: string;
  notes: string;
  /** Expected outcome: how you'll know it's achieved. */
  outcome: string;
  category: string | null;
  status: GoalStatus;
  priority: GoalPriority | null;
  startDate: string | null; // ISO yyyy-mm-dd
  endDate: string | null; // ISO yyyy-mm-dd
  reviewDate: string | null; // next review, ISO yyyy-mm-dd
  icon: string; // emoji
  /** Position among siblings (ascending). */
  order: number;
  createdAt: number;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  type: TaskType;
  parentId: string | null;
  title: string;
  notes: string;
  category: string | null;
  urgent: boolean;
  important: boolean;
  deadline: string | null; // ISO date yyyy-mm-dd
  weekday: number | null; // 0=Lunes .. 6=Domingo
  status: TaskStatus;
  inbox: boolean;
  timeSpent: number; // accumulated seconds
  pomodorosCompleted: number;
  createdAt: number;
  recurrence?: Recurrence | null;
  /** Project only: lifecycle state (defaults to "active" when unset). */
  projectState?: ProjectState | null;
  /** Project only: follow-up/review date, mainly used when paused or someday. */
  reviewDate?: string | null;
  /** Subtask only: who you're waiting on, when status is "delegated". */
  waitingOn?: string | null;
  /** Project only: the goal this project contributes to (optional). */
  goalId?: string | null;
}

export interface TimeLogEntry {
  id: string;
  taskId: string;
  category: string | null;
  seconds: number;
  dateISO: string;
}

export interface PomodoroSettings {
  work: number;
  shortBreak: number;
  longBreak: number;
  cycles: number;
}

export type ActiveTimer =
  | {
      taskId: string;
      kind: "stopwatch";
      elapsedMs: number;
      running: boolean;
      startTimestamp: number;
    }
  | {
      taskId: string;
      kind: "pomodoro";
      phase: "work" | "short" | "long";
      cycleCount: number;
      remainingMs: number;
      running: boolean;
      startTimestamp: number;
    };

export const SUBTASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Por hacer",
  delegated: "Delegado",
  progress: "En progreso",
  done: "Hecho",
};

export const SUBTASK_STATUS_CYCLE: TaskStatus[] = ["todo", "delegated", "progress", "done"];

export const KANBAN_COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "Por hacer" },
  { key: "delegated", label: "Delegado" },
  { key: "progress", label: "En progreso" },
  { key: "done", label: "Hecho" },
];

export const PROJECT_STATE_LABELS: Record<ProjectState, string> = {
  active: "Activo",
  paused: "En pausa",
  someday: "Algún día",
  done: "Completado",
};

export const PROJECT_STATE_ORDER: ProjectState[] = ["active", "paused", "someday", "done"];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  backlog: "Backlog",
  in_progress: "En progreso",
  paused: "En pausa",
  done: "Lograda",
  dropped: "Descartada",
};
export const GOAL_STATUS_ORDER: GoalStatus[] = ["backlog", "in_progress", "paused", "done", "dropped"];

export const GOAL_PRIORITY_LABELS: Record<GoalPriority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};
export const GOAL_PRIORITY_ORDER: GoalPriority[] = ["high", "medium", "low"];

export const GOAL_ICONS = ["🎯", "🚀", "📚", "💼", "💰", "🏠", "💪", "🧠", "🌎", "🎓", "🛠️", "❤️"];

export const DAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const DAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

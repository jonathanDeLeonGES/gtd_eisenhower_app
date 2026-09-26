import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "./id";
import { computeNextDeadline, todayISO } from "./date-utils";
import type {
  ActiveTimer,
  Category,
  Goal,
  PomodoroSettings,
  ProjectState,
  Recurrence,
  Task,
  TaskStatus,
  TaskType,
  TimeLogEntry,
} from "./types";

export interface TaskFormInput {
  title: string;
  notes: string;
  category: string | null;
  urgent: boolean;
  important: boolean;
  deadline: string | null;
  weekday: number | null;
  recurrence?: Recurrence | null;
  projectState?: ProjectState | null;
  reviewDate?: string | null;
  waitingOn?: string | null;
  goalId?: string | null;
}

export interface GoalInput {
  title: string;
  notes: string;
  outcome: string;
  category: string | null;
  status: Goal["status"];
  priority: Goal["priority"];
  startDate: string | null;
  endDate: string | null;
  reviewDate: string | null;
  icon: string;
  parentId: string | null;
}

interface StoreState {
  goals: Goal[];
  categories: Category[];
  tasks: Task[];
  timeLog: TimeLogEntry[];
  pomodoroSettings: PomodoroSettings;
  activeTimer: ActiveTimer | null;
  selectedProjectId: string | null;
  hasHydrated: boolean;
  sidebarCollapsed: boolean;
  weekGroupByProject: boolean;

  setHasHydrated: (v: boolean) => void;
  toggleSidebar: () => void;
  toggleWeekGrouping: () => void;

  // Capture / inbox
  addInboxCapture: (title: string) => void;
  deleteTask: (id: string) => void;

  // Processing / creation
  processTaskAsSimple: (id: string, input: TaskFormInput) => void;
  processTaskAsProject: (id: string, input: TaskFormInput, seedSubtasks: string[]) => void;
  createSimpleTask: (input: TaskFormInput) => void;
  createProject: (input: TaskFormInput, seedSubtasks: string[]) => string;
  createSubtask: (parentId: string, input: TaskFormInput) => void;
  updateTask: (id: string, input: TaskFormInput, isSimple: boolean) => void;

  // Status changes
  toggleSimpleDone: (id: string, done: boolean) => void;
  cycleSubtaskStatus: (id: string) => void;
  setSubtaskStatus: (id: string, status: TaskStatus) => void;
  setTaskWeekday: (id: string, weekday: number | null) => void;

  // Projects
  selectProject: (id: string | null) => void;
  setProjectGoal: (projectId: string, goalId: string | null) => void;

  // Goals
  addGoal: (input: GoalInput) => string;
  updateGoal: (id: string, patch: Partial<GoalInput>) => void;
  deleteGoal: (id: string) => void;
  /** Reparent and/or reorder. Places the goal before `beforeId` among the new siblings (end when null). */
  moveGoal: (id: string, newParentId: string | null, beforeId: string | null) => void;

  // Categories
  addCategory: (name: string, color: string) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => boolean;

  // Import / export
  importState: (data: unknown) => boolean;

  // Timers
  startStopwatch: (taskId: string) => void;
  pauseStopwatch: () => void;
  resumeStopwatch: () => void;
  stopStopwatch: () => void;
  startPomodoro: (taskId: string) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopActiveTimer: () => void;
  skipPomoPhase: () => void;
  savePomodoroSettings: (s: PomodoroSettings) => void;
  tick: () => void;
}

function defaultCategories(): Category[] {
  return [
    { id: "personal", name: "Personal", color: "#14b8a6" },
    { id: "laboral", name: "Laboral", color: "#6366f1" },
  ];
}

function defaultPomodoroSettings(): PomodoroSettings {
  return { work: 25, shortBreak: 5, longBreak: 15, cycles: 4 };
}

function baseTaskFields(input: TaskFormInput) {
  return {
    title: input.title,
    notes: input.notes,
    category: input.category,
    urgent: input.urgent,
    important: input.important,
    deadline: input.deadline,
    weekday: input.weekday,
  };
}

export const useTaskStore = create<StoreState>()(
  persist(
    (set, get) => ({
      categories: defaultCategories(),
      goals: [],
      tasks: [],
      timeLog: [],
      pomodoroSettings: defaultPomodoroSettings(),
      activeTimer: null,
      selectedProjectId: null,
      hasHydrated: false,
      sidebarCollapsed: false,
      weekGroupByProject: false,

      setHasHydrated: (v) => set({ hasHydrated: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleWeekGrouping: () => set((s) => ({ weekGroupByProject: !s.weekGroupByProject })),

      addInboxCapture: (title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const task: Task = {
          id: uid(),
          type: null,
          parentId: null,
          title: trimmed,
          notes: "",
          category: null,
          urgent: false,
          important: false,
          deadline: null,
          weekday: null,
          status: "todo",
          inbox: true,
          timeSpent: 0,
          pomodorosCompleted: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
      },

      deleteTask: (id) => {
        set((s) => {
          const t = s.tasks.find((x) => x.id === id);
          if (!t) return {};
          const removedIds = new Set(
            s.tasks.filter((x) => x.id === id || (t.type === "project" && x.parentId === id)).map((x) => x.id)
          );
          const tasks = s.tasks.filter((x) => !removedIds.has(x.id));
          const activeTimer = s.activeTimer && removedIds.has(s.activeTimer.taskId) ? null : s.activeTimer;
          const selectedProjectId = s.selectedProjectId === id ? null : s.selectedProjectId;
          return { tasks, activeTimer, selectedProjectId };
        });
      },

      processTaskAsSimple: (id, input) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, ...baseTaskFields(input), type: "simple" as TaskType, inbox: false, status: "todo" as TaskStatus, recurrence: input.recurrence ?? null }
              : t
          ),
        }));
      },

      processTaskAsProject: (id, input, seedSubtasks) => {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...baseTaskFields(input),
                  type: "project" as TaskType,
                  inbox: false,
                  projectState: input.projectState ?? "active",
                  reviewDate: input.reviewDate ?? null,
                  goalId: input.goalId ?? null,
                }
              : t
          ),
        }));
        seedSubtasks.forEach((title) => {
          const s = get();
          const subtask: Task = {
            id: uid(),
            type: "subtask",
            parentId: id,
            title,
            notes: "",
            category: input.category,
            urgent: false,
            important: false,
            deadline: null,
            weekday: null,
            status: "todo",
            inbox: false,
            timeSpent: 0,
            pomodorosCompleted: 0,
            createdAt: Date.now(),
          };
          set({ tasks: [...s.tasks, subtask] });
        });
      },

      createSimpleTask: (input) => {
        const task: Task = {
          id: uid(),
          type: "simple",
          parentId: null,
          ...baseTaskFields(input),
          status: "todo",
          inbox: false,
          timeSpent: 0,
          pomodorosCompleted: 0,
          createdAt: Date.now(),
          recurrence: input.recurrence ?? null,
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
      },

      createProject: (input, seedSubtasks) => {
        const id = uid();
        const project: Task = {
          id,
          type: "project",
          parentId: null,
          ...baseTaskFields(input),
          status: "todo",
          inbox: false,
          timeSpent: 0,
          pomodorosCompleted: 0,
          createdAt: Date.now(),
          projectState: input.projectState ?? "active",
          reviewDate: input.reviewDate ?? null,
          goalId: input.goalId ?? null,
        };
        const subtasks: Task[] = seedSubtasks.map((title) => ({
          id: uid(),
          type: "subtask",
          parentId: id,
          title,
          notes: "",
          category: input.category,
          urgent: false,
          important: false,
          deadline: null,
          weekday: null,
          status: "todo",
          inbox: false,
          timeSpent: 0,
          pomodorosCompleted: 0,
          createdAt: Date.now(),
        }));
        set((s) => ({ tasks: [...s.tasks, project, ...subtasks], selectedProjectId: id }));
        return id;
      },

      createSubtask: (parentId, input) => {
        const subtask: Task = {
          id: uid(),
          type: "subtask",
          parentId,
          ...baseTaskFields(input),
          status: "todo",
          inbox: false,
          timeSpent: 0,
          pomodorosCompleted: 0,
          createdAt: Date.now(),
        };
        set((s) => ({ tasks: [...s.tasks, subtask] }));
      },

      updateTask: (id, input, isSimple) => {
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const patch: Partial<Task> = { ...baseTaskFields(input) };
            if (isSimple) patch.recurrence = input.recurrence ?? null;
            if (t.type === "project") {
              patch.projectState = input.projectState ?? "active";
              patch.reviewDate = input.reviewDate ?? null;
              patch.goalId = input.goalId ?? null;
            }
            if (t.type === "subtask") {
              patch.waitingOn = input.waitingOn ?? null;
            }
            return { ...t, ...patch };
          }),
        }));
      },

      toggleSimpleDone: (id, done) => {
        const s = get();
        const t = s.tasks.find((x) => x.id === id);
        if (!t) return;
        set({
          tasks: s.tasks.map((x) => (x.id === id ? { ...x, status: done ? "done" : "todo" } : x)),
        });
        if (done && t.recurrence && t.recurrence.freq) {
          const next: Task = {
            id: uid(),
            type: "simple",
            parentId: null,
            title: t.title,
            notes: t.notes,
            category: t.category,
            urgent: t.urgent,
            important: t.important,
            deadline: computeNextDeadline(t.deadline, t.recurrence.freq, t.recurrence.interval),
            weekday: t.weekday,
            status: "todo",
            inbox: false,
            timeSpent: 0,
            pomodorosCompleted: 0,
            createdAt: Date.now(),
            recurrence: { freq: t.recurrence.freq, interval: t.recurrence.interval },
          };
          set((s2) => ({ tasks: [...s2.tasks, next] }));
        }
      },

      cycleSubtaskStatus: (id) => {
        const cycle: TaskStatus[] = ["todo", "delegated", "progress", "done"];
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const idx = cycle.indexOf(t.status);
            return { ...t, status: cycle[(idx + 1) % cycle.length] };
          }),
        }));
      },

      setSubtaskStatus: (id, status) => {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)) }));
      },

      setTaskWeekday: (id, weekday) => {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, weekday } : t)) }));
      },

      selectProject: (id) => set({ selectedProjectId: id }),

      setProjectGoal: (projectId, goalId) => {
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === projectId && t.type === "project" ? { ...t, goalId } : t)) }));
      },

      addGoal: (input) => {
        const id = uid();
        set((s) => {
          const siblings = s.goals.filter((g) => g.parentId === input.parentId);
          const order = siblings.length ? Math.max(...siblings.map((g) => g.order)) + 1 : 0;
          const goal: Goal = { id, ...input, order, createdAt: Date.now() };
          return { goals: [...s.goals, goal] };
        });
        return id;
      },

      updateGoal: (id, patch) => {
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
      },

      deleteGoal: (id) => {
        set((s) => {
          const removed = new Set<string>([id]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const g of s.goals) {
              if (g.parentId && removed.has(g.parentId) && !removed.has(g.id)) {
                removed.add(g.id);
                grew = true;
              }
            }
          }
          return {
            goals: s.goals.filter((g) => !removed.has(g.id)),
            // Projects are never deleted with a goal — they just become unlinked.
            tasks: s.tasks.map((t) => (t.goalId && removed.has(t.goalId) ? { ...t, goalId: null } : t)),
          };
        });
      },

      moveGoal: (id, newParentId, beforeId) => {
        set((s) => {
          const moving = s.goals.find((g) => g.id === id);
          if (!moving || id === newParentId || id === beforeId) return {};
          // Refuse to drop a goal into its own subtree.
          let cur = newParentId;
          while (cur) {
            if (cur === id) return {};
            cur = s.goals.find((g) => g.id === cur)?.parentId ?? null;
          }
          const siblings = s.goals
            .filter((g) => g.parentId === newParentId && g.id !== id)
            .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
          const idx = beforeId ? siblings.findIndex((g) => g.id === beforeId) : -1;
          const at = idx === -1 ? siblings.length : idx;
          const ordered = [...siblings.slice(0, at), moving, ...siblings.slice(at)];
          const orderOf = new Map(ordered.map((g, i) => [g.id, i]));
          return {
            goals: s.goals.map((g) => {
              if (g.id === id) return { ...g, parentId: newParentId, order: orderOf.get(id)! };
              if (orderOf.has(g.id)) return { ...g, order: orderOf.get(g.id)! };
              return g;
            }),
          };
        });
      },

      addCategory: (name, color) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({ categories: [...s.categories, { id: uid(), name: trimmed, color }] }));
      },

      updateCategory: (id, patch) => {
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      },

      deleteCategory: (id) => {
        const s = get();
        const inUse = s.tasks.some((t) => t.category === id) || s.goals.some((g) => g.category === id);
        if (inUse) return false;
        set({ categories: s.categories.filter((c) => c.id !== id) });
        return true;
      },

      importState: (data) => {
        if (!data || typeof data !== "object" || !Array.isArray((data as { tasks?: unknown }).tasks)) {
          return false;
        }
        const d = data as Partial<StoreState>;
        // A timer left "running" in the export has a startTimestamp from whenever it was exported.
        // Re-anchor it to now so we don't compute a huge bogus elapsed/remaining time on import.
        const importedTimer = d.activeTimer ?? null;
        const activeTimer = importedTimer && importedTimer.running ? { ...importedTimer, startTimestamp: Date.now() } : importedTimer;
        set({
          categories: d.categories ?? defaultCategories(),
          tasks: d.tasks ?? [],
          goals: Array.isArray(d.goals) ? d.goals : [],
          timeLog: d.timeLog ?? [],
          pomodoroSettings: d.pomodoroSettings ?? defaultPomodoroSettings(),
          activeTimer,
          selectedProjectId: d.selectedProjectId ?? null,
        });
        return true;
      },

      // ---------------- Timers ----------------
      startStopwatch: (taskId) => {
        const s = get();
        if (s.activeTimer) get().stopActiveTimer();
        set({
          activeTimer: { taskId, kind: "stopwatch", elapsedMs: 0, running: true, startTimestamp: Date.now() },
        });
      },
      pauseStopwatch: () => {
        const s = get();
        const at = s.activeTimer;
        if (!at || at.kind !== "stopwatch" || !at.running) return;
        const delta = Date.now() - at.startTimestamp;
        const task = s.tasks.find((t) => t.id === at.taskId);
        logTimeInternal(set, get, at.taskId, task?.category ?? null, delta / 1000);
        set({ activeTimer: { ...at, elapsedMs: at.elapsedMs + delta, running: false } });
      },
      resumeStopwatch: () => {
        const at = get().activeTimer;
        if (!at || at.kind !== "stopwatch" || at.running) return;
        set({ activeTimer: { ...at, running: true, startTimestamp: Date.now() } });
      },
      stopStopwatch: () => {
        const s = get();
        const at = s.activeTimer;
        if (!at || at.kind !== "stopwatch") return;
        if (at.running) {
          const delta = Date.now() - at.startTimestamp;
          const task = s.tasks.find((t) => t.id === at.taskId);
          logTimeInternal(set, get, at.taskId, task?.category ?? null, delta / 1000);
        }
        set({ activeTimer: null });
      },
      startPomodoro: (taskId) => {
        const s = get();
        if (s.activeTimer) get().stopActiveTimer();
        const { work } = get().pomodoroSettings;
        set({
          activeTimer: {
            taskId,
            kind: "pomodoro",
            phase: "work",
            cycleCount: 0,
            remainingMs: work * 60 * 1000,
            running: true,
            startTimestamp: Date.now(),
          },
        });
      },
      pausePomodoro: () => {
        const s = get();
        const at = s.activeTimer;
        if (!at || at.kind !== "pomodoro" || !at.running) return;
        const remaining = Math.max(0, at.remainingMs - (Date.now() - at.startTimestamp));
        if (at.phase === "work") {
          const elapsedThisSpan = at.remainingMs - remaining;
          const task = s.tasks.find((t) => t.id === at.taskId);
          logTimeInternal(set, get, at.taskId, task?.category ?? null, elapsedThisSpan / 1000);
        }
        set({ activeTimer: { ...at, remainingMs: remaining, running: false } });
      },
      resumePomodoro: () => {
        const at = get().activeTimer;
        if (!at || at.kind !== "pomodoro" || at.running) return;
        set({ activeTimer: { ...at, running: true, startTimestamp: Date.now() } });
      },
      stopActiveTimer: () => {
        const s = get();
        const at = s.activeTimer;
        if (!at) return;
        if (at.kind === "stopwatch") {
          get().stopStopwatch();
          return;
        }
        if (at.running && at.phase === "work") {
          const remaining = Math.max(0, at.remainingMs - (Date.now() - at.startTimestamp));
          const elapsedThisSpan = at.remainingMs - remaining;
          const task = s.tasks.find((t) => t.id === at.taskId);
          logTimeInternal(set, get, at.taskId, task?.category ?? null, elapsedThisSpan / 1000);
        }
        set({ activeTimer: null });
      },
      skipPomoPhase: () => {
        const s = get();
        const at = s.activeTimer;
        if (!at || at.kind !== "pomodoro") return;
        const { shortBreak, work } = s.pomodoroSettings;
        if (at.phase === "work") {
          const remaining = at.running ? Math.max(0, at.remainingMs - (Date.now() - at.startTimestamp)) : at.remainingMs;
          const elapsedThisSpan = at.remainingMs - remaining;
          const task = s.tasks.find((t) => t.id === at.taskId);
          logTimeInternal(set, get, at.taskId, task?.category ?? null, elapsedThisSpan / 1000);
          set({
            activeTimer: {
              ...at,
              phase: "short",
              remainingMs: shortBreak * 60 * 1000,
              running: true,
              startTimestamp: Date.now(),
            },
          });
        } else {
          set({
            activeTimer: {
              ...at,
              phase: "work",
              remainingMs: work * 60 * 1000,
              running: true,
              startTimestamp: Date.now(),
            },
          });
        }
      },
      savePomodoroSettings: (settings) => set({ pomodoroSettings: settings }),
      tick: () => {
        const s = get();
        const at = s.activeTimer;
        if (!at || at.kind !== "pomodoro" || !at.running) return;
        const remaining = at.remainingMs - (Date.now() - at.startTimestamp);
        if (remaining > 0) return;
        if (at.phase === "work") {
          const task = s.tasks.find((t) => t.id === at.taskId);
          logTimeInternal(set, get, at.taskId, task?.category ?? null, at.remainingMs / 1000);
          set({
            tasks: get().tasks.map((t) =>
              t.id === at.taskId ? { ...t, pomodorosCompleted: (t.pomodorosCompleted || 0) + 1 } : t
            ),
          });
          const { cycles, shortBreak, longBreak } = s.pomodoroSettings;
          const cycleCount = at.cycleCount + 1;
          const nextPhase = cycleCount % cycles === 0 ? "long" : "short";
          const nextDuration = (nextPhase === "long" ? longBreak : shortBreak) * 60 * 1000;
          set({
            activeTimer: {
              ...at,
              phase: nextPhase,
              cycleCount,
              remainingMs: nextDuration,
              running: true,
              startTimestamp: Date.now(),
            },
          });
        } else {
          const { work } = s.pomodoroSettings;
          set({
            activeTimer: {
              ...at,
              phase: "work",
              remainingMs: work * 60 * 1000,
              running: true,
              startTimestamp: Date.now(),
            },
          });
        }
      },
    }),
    {
      name: "gtd_eisenhower_state_v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        categories: s.categories,
        tasks: s.tasks,
        goals: s.goals,
        timeLog: s.timeLog,
        pomodoroSettings: s.pomodoroSettings,
        activeTimer: s.activeTimer,
        selectedProjectId: s.selectedProjectId,
        sidebarCollapsed: s.sidebarCollapsed,
        weekGroupByProject: s.weekGroupByProject,
      }),
    }
  )
);

function logTimeInternal(
  set: (partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>)) => void,
  get: () => StoreState,
  taskId: string,
  category: string | null,
  seconds: number
) {
  if (seconds <= 0) return;
  const entry: TimeLogEntry = { id: uid(), taskId, category, seconds, dateISO: todayISO() };
  set((s) => ({
    timeLog: [...s.timeLog, entry],
    tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, timeSpent: (t.timeSpent || 0) + seconds } : t)),
  }));
}

export function categoryById(categories: Category[], id: string | null): Category | null {
  if (!id) return null;
  return categories.find((c) => c.id === id) ?? null;
}

export function subtasksOf(tasks: Task[], projectId: string): Task[] {
  return tasks.filter((t) => t.parentId === projectId);
}

export function projectProgress(tasks: Task[], projectId: string): { pct: number; done: number; total: number } {
  const subs = subtasksOf(tasks, projectId);
  if (subs.length === 0) return { pct: 0, done: 0, total: 0 };
  const done = subs.filter((s) => s.status === "done").length;
  return { pct: Math.round((done / subs.length) * 100), done, total: subs.length };
}

export type ProjectActionStatus = "exempt" | "ok" | "waiting" | "stalled";

/**
 * GTD rule: an active project should always have a next action or a tracked follow-up.
 * - "ok": has a "todo"/"progress" subtask — something you can act on right now.
 * - "waiting": no next action, but a "delegated" subtask carries a follow-up date — parked on someone else, not stalled.
 * - "stalled": neither — the project has silently gone idle.
 * - "exempt": paused/someday/done — intentionally parked, not evaluated.
 */
export function getProjectActionStatus(tasks: Task[], project: Task): ProjectActionStatus {
  const state = project.projectState ?? "active";
  if (state !== "active") return "exempt";
  const subs = subtasksOf(tasks, project.id);
  if (subs.some((s) => s.status === "todo" || s.status === "progress")) return "ok";
  if (subs.some((s) => s.status === "delegated" && !!s.deadline)) return "waiting";
  return "stalled";
}

export function projectNeedsNextAction(tasks: Task[], project: Task): boolean {
  return getProjectActionStatus(tasks, project) === "stalled";
}

import { quadrantOf, QUAD_ORDER } from "./quadrant";
import type { Task } from "./types";

export function sortByPriority(a: Task, b: Task) {
  // Done tasks sink to the bottom of their day.
  if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
  const qa = QUAD_ORDER[quadrantOf(a.urgent, a.important).key];
  const qb = QUAD_ORDER[quadrantOf(b.urgent, b.important).key];
  if (qa !== qb) return qa - qb;
  if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return 0;
}

/** Projects are containers, not actions: only simple tasks and subtasks can be planned. */
export function plannableTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.inbox && (t.type === "simple" || t.type === "subtask"));
}

/**
 * "Por replanificar": open tasks whose planned day has passed, plus open tasks that were never planned
 * but whose deadline has passed. A task planned for today or later is considered handled, even if its
 * deadline is late — replanning can't fix a deadline, so it would nag forever.
 */
export function overdueTasks(tasks: Task[], today: string): Task[] {
  return plannableTasks(tasks)
    .filter((t) => {
      if (t.status === "done") return false;
      if (t.plannedDate) return t.plannedDate < today;
      return !!t.deadline && t.deadline < today;
    })
    .sort((a, b) => (a.plannedDate ?? a.deadline ?? "").localeCompare(b.plannedDate ?? b.deadline ?? "") || sortByPriority(a, b));
}

export function tasksOnDate(tasks: Task[], iso: string, includeDone = false): Task[] {
  return plannableTasks(tasks)
    .filter((t) => t.plannedDate === iso && (includeDone || t.status !== "done"))
    .sort(sortByPriority);
}

/** Tasks that are due on `iso` but planned for another day (or not planned) — shown as a due-date marker. */
export function deadlinesOnDate(tasks: Task[], iso: string): Task[] {
  return plannableTasks(tasks)
    .filter((t) => t.deadline === iso && t.status !== "done" && t.plannedDate !== iso)
    .sort(sortByPriority);
}

/** Open tasks with no planned date that aren't already in the overdue list. */
/** The task `task` depends on, if any (a dangling/removed reference resolves to null — it never blocks). */
export function dependencyOf(tasks: Task[], task: Task): Task | null {
  if (!task.dependsOn) return null;
  return tasks.find((t) => t.id === task.dependsOn) ?? null;
}

/** True while the task it depends on exists and isn't done yet. */
export function isTaskBlocked(tasks: Task[], task: Task): boolean {
  const dep = dependencyOf(tasks, task);
  return !!dep && dep.status !== "done";
}

/** True if pointing `taskId`'s dependency at `candidateId` would create a dependency cycle. */
export function dependencyCreatesCycle(tasks: Task[], taskId: string, candidateId: string): boolean {
  let cur: string | null | undefined = candidateId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === taskId) return true;
    if (seen.has(cur)) return false; // pre-existing cycle elsewhere in the data — not this edit's problem
    seen.add(cur);
    cur = tasks.find((t) => t.id === cur)?.dependsOn ?? null;
  }
  return false;
}

export function unscheduledTasks(tasks: Task[], today: string): Task[] {
  const overdue = new Set(overdueTasks(tasks, today).map((t) => t.id));
  return plannableTasks(tasks)
    .filter((t) => !t.plannedDate && t.status !== "done" && !overdue.has(t.id))
    // Delegated tasks with a follow-up date are already being tracked (project board, overdue banner
    // once it passes) — showing them here too would just be noise. Delegated with no date still needs one.
    .filter((t) => !(t.status === "delegated" && t.deadline))
    // Blocked tasks can't be worked on yet — they reappear here once their dependency is done.
    .filter((t) => !isTaskBlocked(tasks, t))
    .sort(sortByPriority);
}

export interface TaskGroup {
  project: Task | null;
  items: Task[];
}

export function groupByProject(dayTasks: Task[], allTasks: Task[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const t of dayTasks) {
    let key = "__none__";
    let project: Task | null = null;
    if (t.type === "subtask" && t.parentId) {
      key = t.parentId;
      project = allTasks.find((x) => x.id === t.parentId) ?? null;
    }
    if (!groups.has(key)) groups.set(key, { project, items: [] });
    const group = groups.get(key)!;
    if (!group.project && project) group.project = project;
    group.items.push(t);
  }
  for (const g of groups.values()) g.items.sort(sortByPriority);
  return Array.from(groups.values()).sort((a, b) => {
    if (!a.project && b.project) return 1;
    if (a.project && !b.project) return -1;
    const minA = Math.min(...a.items.map((t) => QUAD_ORDER[quadrantOf(t.urgent, t.important).key]));
    const minB = Math.min(...b.items.map((t) => QUAD_ORDER[quadrantOf(t.urgent, t.important).key]));
    if (minA !== minB) return minA - minB;
    return (a.project?.title ?? "").localeCompare(b.project?.title ?? "");
  });
}

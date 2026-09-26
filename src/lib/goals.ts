import type { Goal, Task } from "./types";
import { projectProgress } from "./store";

/** Direct sub-goals of a goal (or the roots when parentId is null), in manual order. */
export function childGoals(goals: Goal[], parentId: string | null): Goal[] {
  return goals.filter((g) => g.parentId === parentId).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

/** Projects linked directly to a goal. */
export function goalProjects(tasks: Task[], goalId: string): Task[] {
  return tasks.filter((t) => t.type === "project" && t.goalId === goalId);
}

/** All descendant goal ids (not including the goal itself). */
export function descendantGoalIds(goals: Goal[], goalId: string): Set<string> {
  const out = new Set<string>();
  const stack = [goalId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const g of goals) {
      if (g.parentId === cur && !out.has(g.id)) {
        out.add(g.id);
        stack.push(g.id);
      }
    }
  }
  return out;
}

/** Every goal in tree order (depth-first, manual order) with its depth. */
export function flattenGoals(goals: Goal[]): { goal: Goal; depth: number }[] {
  const out: { goal: Goal; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const g of childGoals(goals, parentId)) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      out.push({ goal: g, depth });
      walk(g.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** "Meta › Submeta › Sub-submeta" label for a goal. */
export function goalPath(goals: Goal[], goalId: string | null | undefined): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let cur = goalId ? goals.find((g) => g.id === goalId) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.title);
    cur = cur.parentId ? goals.find((g) => g.id === cur!.parentId) : undefined;
  }
  return parts.join(" › ");
}

/** Depth of a goal (roots = 0). Cycle-safe. */
export function goalDepth(goals: Goal[], goal: Goal): number {
  let depth = 0;
  let cur: Goal | undefined = goal;
  const seen = new Set<string>();
  while (cur && cur.parentId && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = goals.find((g) => g.id === cur!.parentId);
    if (cur) depth++;
  }
  return depth;
}

function projectPct(tasks: Task[], project: Task): number {
  if ((project.projectState ?? "active") === "done") return 100;
  return projectProgress(tasks, project.id).pct;
}

/**
 * Automatic progress: the average of the direct children — sub-goals (recursively) and linked projects.
 * Dropped sub-goals are ignored. A goal marked "done" is 100%. A goal with no children is 0%.
 */
export function goalProgress(goals: Goal[], tasks: Task[], goalId: string): number {
  const goal = goals.find((g) => g.id === goalId);
  if (!goal) return 0;
  if (goal.status === "done") return 100;
  const subs = childGoals(goals, goalId).filter((g) => g.status !== "dropped");
  const projects = goalProjects(tasks, goalId);
  const parts = [
    ...subs.map((g) => goalProgress(goals, tasks, g.id)),
    ...projects.map((p) => projectPct(tasks, p)),
  ];
  if (parts.length === 0) return 0;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Seconds spent across every project (and its tasks) under this goal, including sub-goals. */
export function goalTimeSpent(goals: Goal[], tasks: Task[], goalId: string): number {
  const ids = descendantGoalIds(goals, goalId);
  ids.add(goalId);
  let total = 0;
  for (const p of tasks) {
    if (p.type === "project" && p.goalId && ids.has(p.goalId)) {
      total += p.timeSpent || 0;
      for (const s of tasks) if (s.parentId === p.id) total += s.timeSpent || 0;
    }
  }
  return total;
}

/** Counts of linked projects in the goal's whole subtree. */
export function goalProjectCount(goals: Goal[], tasks: Task[], goalId: string): number {
  const ids = descendantGoalIds(goals, goalId);
  ids.add(goalId);
  return tasks.filter((t) => t.type === "project" && t.goalId && ids.has(t.goalId)).length;
}

/** An in-progress goal with neither sub-goals nor projects has no way to advance. */
export function goalNeedsProjects(goals: Goal[], tasks: Task[], goal: Goal): boolean {
  if (goal.status !== "in_progress") return false;
  return childGoals(goals, goal.id).length === 0 && goalProjects(tasks, goal.id).length === 0;
}

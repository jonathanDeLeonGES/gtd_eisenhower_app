"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CalendarRange,
  Clock,
  FolderKanban,
  GripVertical,
  Link2,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GoalFormModal } from "@/components/goal-form-modal";
import { LinkProjectDialog } from "@/components/goal-link-project-dialog";
import { GoalsTimeline } from "@/components/goals-timeline";
import { TaskFormModal } from "@/components/task-form-modal";
import { useTaskStore, categoryById, projectProgress } from "@/lib/store";
import {
  childGoals,
  descendantGoalIds,
  goalNeedsProjects,
  goalProgress,
  goalProjectCount,
  goalProjects,
  goalTimeSpent,
} from "@/lib/goals";
import { deadlineLabel, deadlineStatus, formatDateDisplay, formatDuration } from "@/lib/date-utils";
import {
  GOAL_PRIORITY_LABELS,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_ORDER,
  PROJECT_STATE_LABELS,
  type Goal,
  type GoalPriority,
  type GoalStatus,
  type ProjectState,
  type Task,
} from "@/lib/types";

const GRID = "grid-cols-[minmax(300px,1fr)_100px_116px_150px_76px_130px_72px_44px]";

const STATUS_STYLES: Record<GoalStatus, string> = {
  backlog: "bg-muted text-muted-foreground border-transparent",
  in_progress: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  paused: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  done: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  dropped: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
};
const PRIORITY_STYLES: Record<GoalPriority, string> = {
  high: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  low: "bg-muted text-muted-foreground border-transparent",
};
const DEADLINE_STYLES: Record<string, string> = {
  overdue: "text-rose-600 dark:text-rose-300",
  today: "text-orange-600 dark:text-orange-300",
  soon: "text-amber-600 dark:text-amber-300",
  normal: "text-muted-foreground",
};

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Zone = "before" | "into" | "after";
type DropTarget = { id: string; zone: Zone } | null;

type Row =
  | { kind: "goal"; goal: Goal; depth: number; hasChildren: boolean; expanded: boolean }
  | { kind: "project"; project: Task; depth: number; goalId: string | null };

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

function ProgressCell({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className="gradient-brand h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground w-9 text-right text-[11px] font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}

function dropStyle(target: DropTarget, id: string) {
  if (!target || target.id !== id) return "";
  if (target.zone === "into") return "bg-primary/10 ring-primary/50 ring-2 ring-inset";
  if (target.zone === "before") return "shadow-[inset_0_2px_0_0_var(--color-primary)]";
  return "shadow-[inset_0_-2px_0_0_var(--color-primary)]";
}

function GoalRow({
  goal,
  depth,
  hasChildren,
  expanded,
  dropTarget,
  onToggle,
  onEdit,
  onDelete,
  onAddSub,
  onAddProject,
  onLinkProject,
}: {
  goal: Goal;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  dropTarget: DropTarget;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSub: () => void;
  onAddProject: () => void;
  onLinkProject: () => void;
}) {
  const goals = useTaskStore((s) => s.goals);
  const tasks = useTaskStore((s) => s.tasks);
  const categories = useTaskStore((s) => s.categories);
  const updateGoal = useTaskStore((s) => s.updateGoal);
  const id = `goal:${goal.id}`;
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });

  const cat = categoryById(categories, goal.category);
  const pct = goalProgress(goals, tasks, goal.id);
  const time = goalTimeSpent(goals, tasks, goal.id);
  const projectCount = goalProjectCount(goals, tasks, goal.id);
  const needsProjects = goalNeedsProjects(goals, tasks, goal);
  const closed = goal.status === "done" || goal.status === "dropped";
  const dStatus = deadlineStatus(goal.endDate, closed);

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      style={{ touchAction: "none" }}
      className={cn(
        "group hover:bg-muted/40 grid items-center gap-3 border-b px-3 py-2 transition-colors last:border-b-0",
        GRID,
        drag.isDragging && "opacity-40",
        goal.status === "dropped" && "opacity-60",
        dropStyle(dropTarget, id)
      )}
    >
      <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * 22 }}>
        <button
          {...drag.listeners}
          {...drag.attributes}
          className="text-muted-foreground/50 hover:text-foreground cursor-grab touch-none rounded p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Arrastrar meta"
          title="Arrastra para reordenar o mover a otra meta"
        >
          <GripVertical className="size-3.5" />
        </button>
        <button
          onClick={onToggle}
          disabled={!hasChildren}
          className={cn("text-muted-foreground hover:bg-muted rounded p-0.5", !hasChildren && "invisible")}
          aria-label={expanded ? "Contraer" : "Expandir"}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        <span className="shrink-0 text-base leading-none">{goal.icon}</span>
        <button onClick={onEdit} className="min-w-0 text-left" title={goal.outcome || "Editar meta"}>
          <span className={cn("block truncate text-sm font-semibold", goal.status === "done" && "text-muted-foreground line-through")}>
            {goal.title}
          </span>
        </button>
        {needsProjects && (
          <Pill className="shrink-0 border-amber-500/25 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle className="size-3" /> Sin proyectos
          </Pill>
        )}
        {projectCount > 0 && (
          <span className="text-muted-foreground shrink-0 text-[10.5px] font-semibold" title={`${projectCount} proyecto(s) en esta meta`}>
            <FolderKanban className="mr-0.5 inline size-3 -translate-y-px" />
            {projectCount}
          </span>
        )}
      </div>

      <div>
        {cat ? (
          <span className="inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white" style={{ backgroundColor: cat.color }}>
            <span className="truncate">{cat.name}</span>
          </span>
        ) : (
          <Pill className="bg-muted text-muted-foreground border-transparent">Sin categoría</Pill>
        )}
      </div>

      <div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="rounded-full" aria-label="Cambiar estado" />}>
            <Pill className={STATUS_STYLES[goal.status]}>{GOAL_STATUS_LABELS[goal.status]}</Pill>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-2xl">
            {GOAL_STATUS_ORDER.map((s) => (
              <DropdownMenuItem key={s} onClick={() => updateGoal(goal.id, { status: s })}>
                {GOAL_STATUS_LABELS[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="text-xs leading-tight">
        {goal.startDate || goal.endDate ? (
          <>
            <span className="text-muted-foreground">
              {goal.startDate ? formatDateDisplay(goal.startDate) : "—"} → {goal.endDate ? formatDateDisplay(goal.endDate) : "—"}
            </span>
            {goal.endDate && dStatus && dStatus !== "normal" && (
              <span className={cn("block text-[10.5px] font-semibold", DEADLINE_STYLES[dStatus])}>{deadlineLabel(goal.endDate, dStatus).split(" · ")[0]}</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground/60">Sin fechas</span>
        )}
      </div>

      <div>{goal.priority ? <Pill className={PRIORITY_STYLES[goal.priority]}>{GOAL_PRIORITY_LABELS[goal.priority]}</Pill> : <span className="text-muted-foreground/60 text-xs">—</span>}</div>

      <ProgressCell pct={pct} />

      <div className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
        {time > 0 ? (
          <>
            <Clock className="size-3" /> {formatDuration(time)}
          </>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        )}
      </div>

      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full p-1.5 opacity-60 group-hover:opacity-100"
                aria-label={`Acciones de ${goal.title}`}
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-2xl">
            <DropdownMenuItem onClick={onAddSub} className="gap-2">
              <Plus className="size-4" /> Nueva submeta
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddProject} className="gap-2">
              <FolderKanban className="size-4" /> Nuevo proyecto
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onLinkProject} className="gap-2">
              <Link2 className="size-4" /> Vincular proyecto existente
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit} className="gap-2">
              <Pencil className="size-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive gap-2">
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  depth,
  goalId,
  dropTarget,
  onOpen,
  onUnlink,
}: {
  project: Task;
  depth: number;
  goalId: string | null;
  dropTarget: DropTarget;
  onOpen: () => void;
  onUnlink: () => void;
}) {
  const tasks = useTaskStore((s) => s.tasks);
  const categories = useTaskStore((s) => s.categories);
  const id = `project:${project.id}`;
  const drag = useDraggable({ id });
  const drop = useDroppable({ id, disabled: !goalId });
  const cat = categoryById(categories, project.category);
  const state = (project.projectState as ProjectState) ?? "active";
  const prog = state === "done" ? 100 : projectProgress(tasks, project.id).pct;
  const time = tasks.filter((t) => t.parentId === project.id).reduce((a, t) => a + (t.timeSpent || 0), 0) + (project.timeSpent || 0);

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      style={{ touchAction: "none" }}
      className={cn(
        "group hover:bg-muted/40 grid items-center gap-3 border-b px-3 py-1.5 transition-colors last:border-b-0",
        GRID,
        drag.isDragging && "opacity-40",
        dropStyle(dropTarget, id)
      )}
    >
      <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * 22 }}>
        <button
          {...drag.listeners}
          {...drag.attributes}
          className="text-muted-foreground/50 hover:text-foreground cursor-grab touch-none rounded p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label="Arrastrar proyecto"
          title="Arrastra sobre una meta para vincularlo"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="w-5 shrink-0" />
        <FolderKanban className="text-primary size-4 shrink-0" />
        <button onClick={onOpen} className="group/open flex min-w-0 items-center gap-1 text-left" title="Abrir en el board de proyectos">
          <span className="truncate text-sm">{project.title}</span>
          <ArrowUpRight className="text-primary size-3 shrink-0 opacity-0 group-hover/open:opacity-100" />
        </button>
      </div>
      <div>
        {cat && (
          <span className="inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white" style={{ backgroundColor: cat.color }}>
            <span className="truncate">{cat.name}</span>
          </span>
        )}
      </div>
      <div>
        <Pill className={state === "done" ? STATUS_STYLES.done : state === "active" ? STATUS_STYLES.in_progress : STATUS_STYLES.paused}>
          {PROJECT_STATE_LABELS[state]}
        </Pill>
      </div>
      <div className="text-muted-foreground text-xs">{project.deadline ? formatDateDisplay(project.deadline) : ""}</div>
      <div />
      <ProgressCell pct={prog} />
      <div className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
        {time > 0 && (
          <>
            <Clock className="size-3" /> {formatDuration(time)}
          </>
        )}
      </div>
      <div className="flex justify-end">
        {goalId && (
          <button
            onClick={onUnlink}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Desvincular de la meta"
            title="Desvincular de la meta"
          >
            <Unlink className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function RootDropZone({ active, over }: { active: boolean; over: boolean }) {
  const { setNodeRef } = useDroppable({ id: "root" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-2 rounded-2xl border-2 border-dashed px-4 py-3 text-center text-xs font-semibold transition-colors",
        active ? "text-muted-foreground opacity-100" : "pointer-events-none h-0 overflow-hidden border-0 py-0 opacity-0",
        over && "border-primary/60 bg-primary/10 text-primary"
      )}
    >
      Suelta aquí para mover al nivel raíz (metas) o desvincular (proyectos)
    </div>
  );
}

export function GoalsView() {
  const router = useRouter();
  const goals = useTaskStore((s) => s.goals);
  const tasks = useTaskStore((s) => s.tasks);
  const categories = useTaskStore((s) => s.categories);
  const selectProject = useTaskStore((s) => s.selectProject);
  const setProjectGoal = useTaskStore((s) => s.setProjectGoal);
  const moveGoal = useTaskStore((s) => s.moveGoal);
  const deleteGoal = useTaskStore((s) => s.deleteGoal);

  const [mode, setMode] = React.useState<"tree" | "timeline">("tree");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<Set<string> | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<GoalStatus | "open" | "all">("all");

  const [goalForm, setGoalForm] = React.useState<{ goal?: Goal; parentId?: string | null } | null>(null);
  const [projectForm, setProjectForm] = React.useState<Goal | null>(null);
  const [linkFor, setLinkFor] = React.useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Goal | null>(null);

  const [activeDrag, setActiveDrag] = React.useState<{ kind: "goal" | "project"; id: string } | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const q = normalize(query.trim());

  // ---- Filtering: a goal stays visible if it matches or any descendant does, so the tree never loses its path.
  const visibleIds = React.useMemo(() => {
    const goalMatches = (g: Goal) => {
      if (categoryFilter !== null && !categoryFilter.has(g.category ?? "")) return false;
      if (statusFilter === "open") {
        if (g.status === "done" || g.status === "dropped") return false;
      } else if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (q) {
        const inTitle = normalize(g.title).includes(q);
        const inProjects = goalProjects(tasks, g.id).some((p) => normalize(p.title).includes(q));
        if (!inTitle && !inProjects) return false;
      }
      return true;
    };
    const visible = new Set<string>();
    for (const g of goals) {
      if (!goalMatches(g)) continue;
      let cur: Goal | undefined = g;
      const seen = new Set<string>();
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        visible.add(cur.id);
        cur = cur.parentId ? goals.find((x) => x.id === cur!.parentId) : undefined;
      }
    }
    return visible;
  }, [goals, tasks, categoryFilter, statusFilter, q]);

  const filtering = categoryFilter !== null || statusFilter !== "all" || !!q;

  const rows = React.useMemo(() => {
    const out: Row[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const g of childGoals(goals, parentId)) {
        if (!visibleIds.has(g.id)) continue;
        const projects = goalProjects(tasks, g.id);
        const hasChildren = childGoals(goals, g.id).length > 0 || projects.length > 0;
        // While searching, expand everything so matches are never hidden.
        const expanded = q ? true : !collapsed.has(g.id);
        out.push({ kind: "goal", goal: g, depth, hasChildren, expanded });
        if (!expanded) continue;
        walk(g.id, depth + 1);
        const goalTitleMatches = !q || normalize(g.title).includes(q);
        for (const p of projects.sort((a, b) => a.title.localeCompare(b.title))) {
          if (goalTitleMatches || normalize(p.title).includes(q)) out.push({ kind: "project", project: p, depth: depth + 1, goalId: g.id });
        }
      }
    };
    walk(null, 0);
    return out;
  }, [goals, tasks, visibleIds, collapsed, q]);

  const timelineRows = React.useMemo(() => {
    const out: { goal: Goal; depth: number }[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const g of childGoals(goals, parentId)) {
        if (!visibleIds.has(g.id)) continue;
        out.push({ goal: g, depth });
        walk(g.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [goals, visibleIds]);

  const unlinkedProjects = tasks
    .filter((t) => t.type === "project" && !t.goalId && (t.projectState ?? "active") !== "done")
    .filter((t) => !q || normalize(t.title).includes(q))
    .sort((a, b) => a.title.localeCompare(b.title));
  const [showUnlinked, setShowUnlinked] = React.useState(true);

  // ---- Summary
  const rootGoals = childGoals(goals, null).filter((g) => g.status !== "dropped");
  const avgProgress = rootGoals.length
    ? Math.round(rootGoals.reduce((a, g) => a + goalProgress(goals, tasks, g.id), 0) / rootGoals.length)
    : 0;
  const inProgressCount = goals.filter((g) => g.status === "in_progress").length;
  const needProjectsCount = goals.filter((g) => goalNeedsProjects(goals, tasks, g)).length;
  const overdueCount = goals.filter(
    (g) => g.status !== "done" && g.status !== "dropped" && deadlineStatus(g.endDate, false) === "overdue"
  ).length;

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openProject(projectId: string) {
    selectProject(projectId);
    router.push("/proyectos");
  }

  function isChipSelected(id: string) {
    return categoryFilter !== null && categoryFilter.has(id);
  }
  function toggleChip(id: string) {
    setCategoryFilter((prev) => {
      if (prev === null) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0 || next.size === categories.length) return null;
      return next;
    });
  }

  // ---- Drag & drop
  function parseId(raw: string): { kind: "goal" | "project" | "root"; id: string } {
    if (raw === "root") return { kind: "root", id: "root" };
    const [kind, ...rest] = raw.split(":");
    return { kind: kind as "goal" | "project", id: rest.join(":") };
  }

  function computeTarget(e: DragMoveEvent | DragEndEvent): DropTarget {
    const { over, active } = e;
    if (!over || !active) return null;
    const dragged = parseId(String(active.id));
    const target = parseId(String(over.id));
    if (target.kind === "root") return { id: "root", zone: "into" };

    // Resolve which goal the drop refers to.
    let targetGoalId: string | null = null;
    if (target.kind === "goal") targetGoalId = target.id;
    else targetGoalId = tasks.find((t) => t.id === target.id)?.goalId ?? null;
    if (!targetGoalId) return null;

    if (dragged.kind === "goal") {
      if (targetGoalId === dragged.id || descendantGoalIds(goals, dragged.id).has(targetGoalId)) return null;
    }
    if (dragged.kind === "project" || target.kind === "project") return { id: String(over.id), zone: "into" };

    const start = e.activatorEvent as PointerEvent;
    const pointerY = start.clientY + e.delta.y;
    const rect = over.rect;
    const rel = (pointerY - rect.top) / Math.max(rect.height, 1);
    const zone: Zone = rel < 0.28 ? "before" : rel > 0.72 ? "after" : "into";
    return { id: String(over.id), zone };
  }

  function handleDragStart(e: DragStartEvent) {
    const p = parseId(String(e.active.id));
    if (p.kind !== "root") setActiveDrag({ kind: p.kind, id: p.id });
  }

  function handleDragMove(e: DragMoveEvent) {
    const next = computeTarget(e);
    setDropTarget((prev) => (prev?.id === next?.id && prev?.zone === next?.zone ? prev : next));
  }

  function handleDragEnd(e: DragEndEvent) {
    const target = computeTarget(e);
    const dragged = parseId(String(e.active.id));
    setActiveDrag(null);
    setDropTarget(null);
    if (!target || dragged.kind === "root") return;

    if (dragged.kind === "project") {
      if (target.id === "root") {
        setProjectGoal(dragged.id, null);
        toast.success("Proyecto desvinculado de su meta");
        return;
      }
      const t = parseId(target.id);
      const goalId = t.kind === "goal" ? t.id : (tasks.find((x) => x.id === t.id)?.goalId ?? null);
      if (!goalId) return;
      const current = tasks.find((x) => x.id === dragged.id)?.goalId;
      if (current === goalId) return;
      setProjectGoal(dragged.id, goalId);
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(goalId);
        return next;
      });
      return;
    }

    // Moving a goal
    if (target.id === "root") {
      moveGoal(dragged.id, null, null);
      return;
    }
    const t = parseId(target.id);
    const targetGoalId = t.kind === "goal" ? t.id : (tasks.find((x) => x.id === t.id)?.goalId ?? null);
    const targetGoal = goals.find((g) => g.id === targetGoalId);
    if (!targetGoal) return;
    if (target.zone === "into" || t.kind === "project") {
      moveGoal(dragged.id, targetGoal.id, null);
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(targetGoal.id);
        return next;
      });
    } else if (target.zone === "before") {
      moveGoal(dragged.id, targetGoal.parentId, targetGoal.id);
    } else {
      const siblings = childGoals(goals, targetGoal.parentId).filter((g) => g.id !== dragged.id);
      const idx = siblings.findIndex((g) => g.id === targetGoal.id);
      moveGoal(dragged.id, targetGoal.parentId, siblings[idx + 1]?.id ?? null);
    }
  }

  const draggedGoal = activeDrag?.kind === "goal" ? goals.find((g) => g.id === activeDrag.id) : null;
  const draggedProject = activeDrag?.kind === "project" ? tasks.find((t) => t.id === activeDrag.id) : null;

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteGoal(deleteTarget.id);
    toast.success("Meta eliminada", { description: deleteTarget.title });
    setDeleteTarget(null);
  }
  const deleteSubCount = deleteTarget ? descendantGoalIds(goals, deleteTarget.id).size : 0;
  const deleteProjectCount = deleteTarget ? goalProjectCount(goals, tasks, deleteTarget.id) : 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Metas</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Metas y submetas que se concretan en proyectos. El avance se calcula solo a partir de sus proyectos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted flex items-center gap-0.5 rounded-2xl p-1">
            <button
              onClick={() => setMode("tree")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors",
                mode === "tree" ? "bg-card shadow-soft" : "text-muted-foreground"
              )}
            >
              <ListTree className="size-3.5" /> Árbol
            </button>
            <button
              onClick={() => setMode("timeline")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors",
                mode === "timeline" ? "bg-card shadow-soft" : "text-muted-foreground"
              )}
            >
              <CalendarRange className="size-3.5" /> Línea de tiempo
            </button>
          </div>
          <Button className="gradient-brand gap-1.5 rounded-2xl border-0 text-white shadow-soft" onClick={() => setGoalForm({ parentId: null })}>
            <Plus className="size-4" /> Nueva meta
          </Button>
        </div>
      </div>

      {goals.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            { label: "Avance general", value: `${avgProgress}%`, tone: "" },
            { label: "En progreso", value: String(inProgressCount), tone: "" },
            { label: "Sin proyectos", value: String(needProjectsCount), tone: needProjectsCount ? "text-amber-600 dark:text-amber-300" : "" },
            { label: "Vencidas", value: String(overdueCount), tone: overdueCount ? "text-rose-600 dark:text-rose-300" : "" },
          ].map((s) => (
            <div key={s.label} className="glass shadow-soft rounded-2xl px-4 py-3">
              <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">{s.label}</p>
              <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums", s.tone)}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar meta o proyecto…"
            aria-label="Buscar meta o proyecto"
            className="rounded-xl pr-8 pl-9"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda"
              className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setCategoryFilter(null)}
            aria-pressed={categoryFilter === null}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              categoryFilter === null ? "border-primary/40 bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            Todas
          </button>
          {categories.map((c) => {
            const selected = isChipSelected(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleChip(c.id)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                  selected ? "border-transparent text-white" : "text-muted-foreground hover:bg-muted"
                )}
                style={selected ? { backgroundColor: c.color } : undefined}
              >
                {!selected && <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />}
                {c.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          {(
            [
              ["all", "Todas"],
              ["open", "Abiertas"],
              ["in_progress", "En progreso"],
              ["done", "Logradas"],
            ] as [GoalStatus | "open" | "all", string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              aria-pressed={statusFilter === value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                statusFilter === value ? "border-primary/40 bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="glass shadow-soft flex flex-col items-center gap-3 rounded-3xl border-dashed p-14 text-center">
          <div className="gradient-brand flex size-12 items-center justify-center rounded-2xl text-white shadow-soft">
            <Target className="size-6" />
          </div>
          <p className="text-lg font-semibold">Aún no tienes metas</p>
          <p className="text-muted-foreground max-w-md text-sm">
            Crea tu primera meta, divídela en submetas y vincula los proyectos que la hacen realidad. Los proyectos que ya tienes siguen intactos.
          </p>
          <Button className="gradient-brand mt-1 gap-1.5 rounded-2xl border-0 text-white shadow-soft" onClick={() => setGoalForm({ parentId: null })}>
            <Plus className="size-4" /> Crear mi primera meta
          </Button>
        </div>
      ) : mode === "timeline" ? (
        <GoalsTimeline rows={timelineRows} />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={() => { setActiveDrag(null); setDropTarget(null); }}>
          <div className="glass shadow-soft overflow-x-auto rounded-3xl">
            <div className="min-w-[1000px]">
              <div className={cn("bg-muted/40 text-muted-foreground grid gap-3 border-b px-3 py-2 text-[11px] font-bold tracking-wide uppercase", GRID)}>
                <div className="pl-14">Nombre</div>
                <div>Categoría</div>
                <div>Estado</div>
                <div>Fechas</div>
                <div>Prioridad</div>
                <div>Avance</div>
                <div>Tiempo</div>
                <div />
              </div>

              {rows.length === 0 ? (
                <p className="text-muted-foreground px-4 py-10 text-center text-sm">
                  {filtering ? "Ninguna meta coincide con los filtros." : "Sin metas."}
                </p>
              ) : (
                rows.map((row) =>
                  row.kind === "goal" ? (
                    <GoalRow
                      key={`g-${row.goal.id}`}
                      goal={row.goal}
                      depth={row.depth}
                      hasChildren={row.hasChildren}
                      expanded={row.expanded}
                      dropTarget={dropTarget}
                      onToggle={() => toggleCollapsed(row.goal.id)}
                      onEdit={() => setGoalForm({ goal: row.goal })}
                      onDelete={() => setDeleteTarget(row.goal)}
                      onAddSub={() => setGoalForm({ parentId: row.goal.id })}
                      onAddProject={() => setProjectForm(row.goal)}
                      onLinkProject={() => setLinkFor(row.goal)}
                    />
                  ) : (
                    <ProjectRow
                      key={`p-${row.project.id}`}
                      project={row.project}
                      depth={row.depth}
                      goalId={row.goalId}
                      dropTarget={dropTarget}
                      onOpen={() => openProject(row.project.id)}
                      onUnlink={() => {
                        setProjectGoal(row.project.id, null);
                        toast.success("Proyecto desvinculado", { description: row.project.title });
                      }}
                    />
                  )
                )
              )}
            </div>
          </div>

          <RootDropZone active={!!activeDrag} over={dropTarget?.id === "root"} />

          {unlinkedProjects.length > 0 && (
            <div className="glass shadow-soft mt-4 overflow-x-auto rounded-3xl">
              <div className="min-w-[1000px]">
                <button
                  onClick={() => setShowUnlinked((v) => !v)}
                  className="hover:bg-muted/40 flex w-full items-center gap-2 border-b px-4 py-2.5 text-left"
                  aria-expanded={showUnlinked}
                >
                  {showUnlinked ? <ChevronDown className="text-muted-foreground size-4" /> : <ChevronRight className="text-muted-foreground size-4" />}
                  <span className="text-sm font-semibold">Proyectos sin meta</span>
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{unlinkedProjects.length}</span>
                  <span className="text-muted-foreground ml-2 text-xs">Arrástralos sobre una meta para vincularlos.</span>
                </button>
                {showUnlinked &&
                  unlinkedProjects.map((p) => (
                    <ProjectRow key={`u-${p.id}`} project={p} depth={0} goalId={null} dropTarget={dropTarget} onOpen={() => openProject(p.id)} onUnlink={() => {}} />
                  ))}
              </div>
            </div>
          )}

          <DragOverlay dropAnimation={null}>
            {draggedGoal ? (
              <div className="glass shadow-2xl flex w-72 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold">
                <span>{draggedGoal.icon}</span>
                <span className="truncate">{draggedGoal.title}</span>
              </div>
            ) : draggedProject ? (
              <div className="glass shadow-2xl flex w-72 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold">
                <FolderKanban className="text-primary size-4" />
                <span className="truncate">{draggedProject.title}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {goalForm && (
        <GoalFormModal
          open={!!goalForm}
          onOpenChange={(v) => !v && setGoalForm(null)}
          goal={goalForm.goal}
          defaultParentId={goalForm.parentId ?? null}
          onSaved={(id) => {
            // Make sure a freshly created sub-goal is visible under its (possibly collapsed) parent.
            const g = useTaskStore.getState().goals.find((x) => x.id === id);
            if (g?.parentId) {
              setCollapsed((prev) => {
                const next = new Set(prev);
                next.delete(g.parentId!);
                return next;
              });
            }
          }}
        />
      )}

      {projectForm && (
        <TaskFormModal
          open={!!projectForm}
          onOpenChange={(v) => !v && setProjectForm(null)}
          mode="new-project"
          defaultGoalId={projectForm.id}
          defaultCategory={projectForm.category}
          onSaved={() => {
            const gid = projectForm.id;
            setCollapsed((prev) => {
              const next = new Set(prev);
              next.delete(gid);
              return next;
            });
          }}
        />
      )}

      <LinkProjectDialog goal={linkFor} onOpenChange={(v) => !v && setLinkFor(null)} />

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="glass shadow-soft rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar la meta «{deleteTarget?.title}»?</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground space-y-2 text-sm">
            {deleteSubCount > 0 && (
              <p>
                También se eliminarán sus <strong className="text-foreground">{deleteSubCount}</strong> submeta(s).
              </p>
            )}
            {deleteProjectCount > 0 && (
              <p>
                Sus <strong className="text-foreground">{deleteProjectCount}</strong> proyecto(s) <strong className="text-foreground">no se borran</strong>: quedan sin meta y siguen disponibles en Proyectos.
              </p>
            )}
            {deleteSubCount === 0 && deleteProjectCount === 0 && <p>Esta acción no se puede deshacer.</p>}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" className="rounded-xl" onClick={confirmDelete}>Eliminar meta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { Plus, FolderKanban, ListOrdered, Layers, ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DraggableTaskCard } from "@/components/draggable-task-card";
import { TaskCard } from "@/components/task-card";
import { TaskFormModal, type TaskFormMode } from "@/components/task-form-modal";
import { useTaskStore } from "@/lib/store";
import { quadrantOf, QUAD_ORDER } from "@/lib/quadrant";
import { DAY_NAMES, type Task } from "@/lib/types";

function sortByPriority(a: Task, b: Task) {
  const qa = QUAD_ORDER[quadrantOf(a.urgent, a.important).key];
  const qb = QUAD_ORDER[quadrantOf(b.urgent, b.important).key];
  if (qa !== qb) return qa - qb;
  if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
  if (a.deadline) return -1;
  if (b.deadline) return 1;
  return 0;
}

interface TaskGroup {
  project: Task | null;
  items: Task[];
}

function groupByProject(dayTasks: Task[], allTasks: Task[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const t of dayTasks) {
    let key = "__none__";
    let project: Task | null = null;
    if (t.type === "project") {
      key = t.id;
      project = t;
    } else if (t.type === "subtask" && t.parentId) {
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

function DayColumn({ id, label, tasks, allTasks, grouped, highlight, scrollable, onEdit, onRemove, onOpenProject }: {
  id: string;
  label: string;
  tasks: Task[];
  allTasks: Task[];
  grouped: boolean;
  highlight?: boolean;
  scrollable?: boolean;
  onEdit: (t: Task) => void;
  /** Un-assigns the task from its day (never deletes it). Omit for columns whose tasks have no day. */
  onRemove?: (id: string) => void;
  /** Opens the Projects board on the given project. */
  onOpenProject?: (projectId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const groups = grouped ? groupByProject(tasks, allTasks) : null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass flex min-h-[140px] flex-col gap-1.5 rounded-2xl p-2 transition-colors",
        isOver && "ring-primary/50 bg-primary/5 ring-2",
        highlight && "border-primary/30"
      )}
    >
      <div className="flex items-center justify-between px-1 pt-0.5 pb-1">
        <span className={cn("text-[10.5px] font-bold tracking-wide uppercase", highlight ? "text-primary" : "text-muted-foreground")}>
          {label}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{tasks.length}</span>
      </div>

      <div className={cn("flex flex-col gap-1.5", scrollable && "max-h-[45vh] overflow-y-auto pr-0.5")}>
        {!groups ? (
          tasks.map((t) => (
            <DraggableTaskCard
              key={t.id}
              task={t}
              compact
              onEdit={() => onEdit(t)}
              onDelete={onRemove ? () => onRemove(t.id) : undefined}
              deleteLabel="Quitar del día"
              onOpenParent={onOpenProject && t.parentId ? () => onOpenProject(t.parentId!) : undefined}
            />
          ))
        ) : (
          <div className="flex flex-col gap-2.5">
            {groups.map((group) => (
              <div key={group.project?.id ?? "__none__"} className="flex flex-col gap-1.5">
                {group.project && (
                  <div className="flex items-center gap-0.5 px-0.5">
                    <p className="text-primary flex min-w-0 flex-1 items-center gap-1 text-[10.5px] font-bold">
                      <FolderKanban className="size-3 shrink-0" />
                      <span className="truncate">{group.project.title}</span>
                    </p>
                    {onOpenProject && (
                      <button
                        type="button"
                        onClick={() => onOpenProject(group.project!.id)}
                        title="Ir al proyecto para ver o agregar tareas"
                        aria-label={`Ir al proyecto ${group.project.title}`}
                        className="text-primary hover:bg-primary/15 shrink-0 rounded-full p-1 transition-colors"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {group.items.map((t) => (
                  <DraggableTaskCard
                    key={t.id}
                    task={t}
                    compact
                    hideParentTag={!!group.project}
                    onEdit={() => onEdit(t)}
                    onDelete={onRemove ? () => onRemove(t.id) : undefined}
                    deleteLabel="Quitar del día"
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function WeekView() {
  const tasks = useTaskStore((s) => s.tasks);
  const setTaskWeekday = useTaskStore((s) => s.setTaskWeekday);
  const selectProject = useTaskStore((s) => s.selectProject);
  const router = useRouter();
  const groupByProjectEnabled = useTaskStore((s) => s.weekGroupByProject);
  const toggleWeekGrouping = useTaskStore((s) => s.toggleWeekGrouping);

  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [formState, setFormState] = React.useState<{ mode: TaskFormMode; task?: Task } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Projects are containers, not actions: only their subtasks and simple tasks are plannable.
  const planned = tasks.filter((t) => !t.inbox && t.status !== "done" && t.type !== "project");
  const todayWd = (new Date().getDay() + 6) % 7;

  function tasksFor(day: number | null) {
    return planned.filter((t) => (day === null ? t.weekday == null : t.weekday === day)).sort(sortByPriority);
  }

  function openProject(projectId: string) {
    selectProject(projectId);
    router.push("/proyectos");
  }

  const unassigned = tasksFor(null);
  const unassignedProjectItems = unassigned.filter((t) => t.type === "subtask");
  const unassignedSimpleItems = unassigned.filter((t) => t.type === "simple");

  function handleDragStart(e: DragStartEvent) {
    const t = tasks.find((x) => x.id === e.active.id);
    setActiveTask(t ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (overId.startsWith("day-none")) {
      setTaskWeekday(String(active.id), null);
      return;
    }
    setTaskWeekday(String(active.id), Number(overId.replace("day-", "")));
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Planificación semanal</h1>
          <p className="text-muted-foreground mt-1 text-sm">Arrastra tareas a cada día. Se ordenan por prioridad Eisenhower.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-muted flex items-center gap-0.5 rounded-2xl p-1">
            <button
              onClick={() => groupByProjectEnabled && toggleWeekGrouping()}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors",
                !groupByProjectEnabled ? "bg-card shadow-soft" : "text-muted-foreground"
              )}
            >
              <ListOrdered className="size-3.5" /> Por prioridad
            </button>
            <button
              onClick={() => !groupByProjectEnabled && toggleWeekGrouping()}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors",
                groupByProjectEnabled ? "bg-card shadow-soft" : "text-muted-foreground"
              )}
            >
              <Layers className="size-3.5" /> Por proyecto
            </button>
          </div>
          <Button className="gradient-brand shrink-0 gap-1.5 rounded-2xl border-0 text-white shadow-soft" onClick={() => setFormState({ mode: "new-simple" })}>
            <Plus className="size-4" /> Nueva tarea simple
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="bg-background/70 sticky top-24 z-10 -mx-1 rounded-[28px] px-1 py-1 backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
            {DAY_NAMES.map((label, i) => (
              <DayColumn
                key={i}
                id={`day-${i}`}
                label={label}
                tasks={tasksFor(i)}
                allTasks={tasks}
                grouped={groupByProjectEnabled}
                highlight={i === todayWd}
                scrollable
                onEdit={(t) => setFormState({ mode: "edit", task: t })}
                onRemove={(id) => setTaskWeekday(id, null)}
                onOpenProject={openProject}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-muted-foreground mb-2 px-1 text-xs font-bold tracking-wide uppercase">Sin día · Tareas de proyectos</h2>
            <DayColumn
              id="day-none-projects"
              label="Tareas de proyectos"
              tasks={unassignedProjectItems}
              allTasks={tasks}
              grouped={groupByProjectEnabled}
              onEdit={(t) => setFormState({ mode: "edit", task: t })}
              onOpenProject={openProject}
            />
          </div>
          <div>
            <h2 className="text-muted-foreground mb-2 px-1 text-xs font-bold tracking-wide uppercase">Sin día · Tareas sin proyecto</h2>
            <DayColumn
              id="day-none-simple"
              label="Tareas sueltas"
              tasks={unassignedSimpleItems}
              allTasks={tasks}
              grouped={false}
              onEdit={(t) => setFormState({ mode: "edit", task: t })}
            />
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCard task={activeTask} noEdit className="w-72 shadow-2xl" /> : null}
        </DragOverlay>
      </DndContext>

      {formState && (
        <TaskFormModal
          open={!!formState}
          onOpenChange={(v) => !v && setFormState(null)}
          mode={formState.mode}
          task={formState.task}
        />
      )}
    </div>
  );
}

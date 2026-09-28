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
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Check,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Flag,
  Layers,
  ListOrdered,
  Pencil,
  Plus,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { DraggableTaskCard } from "@/components/draggable-task-card";
import { TaskCard } from "@/components/task-card";
import { TaskFormModal, type TaskFormMode } from "@/components/task-form-modal";
import { useTaskStore } from "@/lib/store";
import { quadrantOf } from "@/lib/quadrant";
import {
  deadlinesOnDate,
  groupByProject,
  overdueTasks,
  tasksOnDate,
  unscheduledTasks,
  type TaskGroup,
} from "@/lib/planner";
import {
  addDaysISO,
  addMonthsISO,
  dayLongLabel,
  formatDateDisplay,
  isoToLocalDate,
  monthGridISO,
  monthLabel,
  todayISO,
  weekDaysISO,
  weekRangeLabel,
  weekStartISO,
} from "@/lib/date-utils";
import { DAY_NAMES, DAY_SHORT, type PlannerView, type Task } from "@/lib/types";

const QUAD_DOT: Record<string, string> = {
  q1: "bg-rose-500",
  q2: "bg-sky-500",
  q3: "bg-amber-500",
  q4: "bg-zinc-400",
};

const VIEW_LABELS: Record<PlannerView, string> = { month: "Mes", week: "Semana", day: "Día" };

type FormState = { mode: TaskFormMode; task?: Task; plannedDate?: string } | null;

// ------------------------------------------------------------------ month chip

function TaskChip({ task, today, onEdit }: { task: Task; today: string; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, data: { task } });
  const done = task.status === "done";
  const late = !done && !!task.plannedDate && task.plannedDate < today;
  const quad = quadrantOf(task.urgent, task.important);
  return (
    <div
      ref={setNodeRef}
      style={{ touchAction: "none" }}
      onClick={onEdit}
      title={`${task.title}${task.deadline ? ` · vence ${formatDateDisplay(task.deadline)}` : ""}`}
      className={cn(
        "flex cursor-grab items-center gap-1.5 rounded-lg border px-1.5 py-0.5 text-[11px] leading-tight font-medium transition-colors active:cursor-grabbing",
        late ? "border-rose-500/30 bg-rose-500/10" : "bg-card/60 hover:bg-muted/60 border-transparent",
        done && "text-muted-foreground line-through",
        isDragging && "opacity-40"
      )}
      {...attributes}
      {...listeners}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", QUAD_DOT[quad.key], done && "opacity-40")} />
      <span className="truncate">{task.title}</span>
    </div>
  );
}

function DeadlineMarks({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return null;
  return (
    <p
      className="flex items-center gap-1 px-1 text-[10px] font-semibold text-rose-600 dark:text-rose-300"
      title={`Vence(n): ${tasks.map((t) => t.title).join(" · ")}`}
    >
      <Flag className="size-3 shrink-0" />
      {tasks.length === 1 ? "1 vence" : `${tasks.length} vencen`}
    </p>
  );
}

// ------------------------------------------------------------------ month view

function MonthCell({ iso, month, today, tasks, deadlines, onEdit, onAdd, onOpenDay }: {
  iso: string;
  month: number;
  today: string;
  tasks: Task[];
  deadlines: Task[];
  onEdit: (t: Task) => void;
  onAdd: () => void;
  onOpenDay: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `date-${iso}` });
  const d = isoToLocalDate(iso);
  const isToday = iso === today;
  const outside = d.getMonth() !== month;
  const shown = tasks.slice(0, 3);
  const extra = tasks.length - shown.length;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/cell glass flex min-h-[116px] min-w-0 flex-col gap-1 rounded-xl p-1.5 transition-colors",
        outside && "opacity-55",
        isToday && "border-primary/50",
        isOver && "ring-primary/50 bg-primary/5 ring-2"
      )}
    >
      <div className="flex items-center justify-between">
        <button
          onClick={onOpenDay}
          title="Ver este día"
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors",
            isToday ? "gradient-brand text-white" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {d.getDate()}
        </button>
        <button
          onClick={onAdd}
          aria-label={`Nueva tarea el ${formatDateDisplay(iso)}`}
          title="Nueva tarea en este día"
          className="text-muted-foreground hover:bg-muted rounded-full p-1 opacity-0 transition-opacity group-hover/cell:opacity-100 focus-visible:opacity-100"
        >
          <Plus className="size-3" />
        </button>
      </div>
      <div className="flex flex-col gap-0.5">
        {shown.map((t) => (
          <TaskChip key={t.id} task={t} today={today} onEdit={() => onEdit(t)} />
        ))}
        {extra > 0 && (
          <button onClick={onOpenDay} className="text-muted-foreground hover:text-primary px-1 text-left text-[10.5px] font-semibold">
            +{extra} más
          </button>
        )}
      </div>
      <DeadlineMarks tasks={deadlines} />
    </div>
  );
}

// ------------------------------------------------------------------ week / day column

function DayColumn({ id, label, sublabel, highlight, tasks, deadlines, allTasks, grouped, comfy, today, plannedDate, onEdit, onUnplan, onOpenProject, onAdd, emptyHint }: {
  id: string;
  label: string;
  sublabel?: string;
  highlight?: boolean;
  tasks: Task[];
  deadlines?: Task[];
  allTasks: Task[];
  grouped: boolean;
  /** Full-size cards (day view / aside) instead of compact ones. */
  comfy?: boolean;
  today: string;
  plannedDate?: string;
  onEdit: (t: Task) => void;
  /** Removes the task's date (never deletes it). */
  onUnplan?: (id: string) => void;
  onOpenProject?: (projectId: string) => void;
  onAdd?: () => void;
  emptyHint?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const groups: TaskGroup[] | null = grouped ? groupByProject(tasks, allTasks) : null;

  function card(t: Task, hideParentTag: boolean) {
    const late = t.status !== "done" && !!t.plannedDate && t.plannedDate < today;
    return (
      <DraggableTaskCard
        key={t.id}
        task={t}
        compact={!comfy}
        hideParentTag={hideParentTag}
        className={late ? "border-rose-500/40" : undefined}
        onEdit={() => onEdit(t)}
        onDelete={onUnplan && t.plannedDate ? () => onUnplan(t.id) : undefined}
        deleteLabel="Quitar del calendario"
        onOpenParent={!hideParentTag && onOpenProject && t.parentId ? () => onOpenProject(t.parentId!) : undefined}
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass group/col flex min-h-[140px] min-w-0 flex-col gap-1.5 rounded-2xl p-2 transition-colors",
        isOver && "ring-primary/50 bg-primary/5 ring-2",
        highlight && "border-primary/40"
      )}
    >
      <div className="flex items-center justify-between px-1 pt-0.5 pb-1">
        <span className={cn("text-[10.5px] font-bold tracking-wide uppercase", highlight ? "text-primary" : "text-muted-foreground")}>
          {label}
          {sublabel && <span className="ml-1 font-semibold normal-case opacity-80">{sublabel}</span>}
        </span>
        <span className="flex items-center gap-1">
          {onAdd && plannedDate && (
            <button
              onClick={onAdd}
              aria-label={`Nueva tarea el ${formatDateDisplay(plannedDate)}`}
              title="Nueva tarea en este día"
              className="text-muted-foreground hover:bg-muted rounded-full p-0.5 opacity-0 transition-opacity group-hover/col:opacity-100 focus-visible:opacity-100"
            >
              <Plus className="size-3.5" />
            </button>
          )}
          <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{tasks.length}</span>
        </span>
      </div>

      {tasks.length === 0 && emptyHint && <p className="text-muted-foreground px-1 py-3 text-center text-xs">{emptyHint}</p>}

      {!groups ? (
        <div className="flex flex-col gap-1.5">{tasks.map((t) => card(t, false))}</div>
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
              {group.items.map((t) => card(t, !!group.project))}
            </div>
          ))}
        </div>
      )}

      {deadlines && deadlines.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 border-t pt-1.5">
          <p className="flex items-center gap-1 px-1 text-[10px] font-bold tracking-wide text-rose-600 uppercase dark:text-rose-300">
            <Flag className="size-3" /> Vence este día
          </p>
          {deadlines.map((t) => (
            <button
              key={t.id}
              onClick={() => onEdit(t)}
              className="hover:bg-muted/60 flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left text-[11px] font-medium"
              title="Planificada en otro día — clic para editar"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", QUAD_DOT[quadrantOf(t.urgent, t.important).key])} />
              <span className="truncate">{t.title}</span>
              {t.plannedDate && <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">plan. {formatDateDisplay(t.plannedDate)}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ overdue banner

function OverdueBanner({ tasks, allTasks, onEdit, onOpenProject }: {
  tasks: Task[];
  allTasks: Task[];
  onEdit: (t: Task) => void;
  onOpenProject: (id: string) => void;
}) {
  const setTaskPlannedDate = useTaskStore((s) => s.setTaskPlannedDate);
  const toggleSimpleDone = useTaskStore((s) => s.toggleSimpleDone);
  const setTaskStatus = useTaskStore((s) => s.setTaskStatus);
  const [open, setOpen] = React.useState(false);
  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);

  if (tasks.length === 0) return null;

  function markDone(t: Task) {
    if (t.type === "simple") toggleSimpleDone(t.id, true);
    else setTaskStatus(t.id, "done");
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-rose-500/30 bg-rose-500/10">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-300" />
        <p className="flex-1 text-sm font-semibold text-rose-700 dark:text-rose-300">
          {tasks.length === 1 ? "1 tarea vencida por replanificar." : `${tasks.length} tareas vencidas por replanificar.`}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl border-rose-500/30 bg-transparent text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
          onClick={() => tasks.forEach((t) => setTaskPlannedDate(t.id, today))}
        >
          Todas a hoy
        </Button>
        <Button
          size="sm"
          className="gap-1 rounded-xl border-0 bg-rose-600 text-white hover:bg-rose-600/90"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Replanificar <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </Button>
      </div>

      {open && (
        <ul className="bg-card/40 max-h-72 divide-y divide-rose-500/15 overflow-y-auto border-t border-rose-500/20">
          {tasks.map((t) => {
            const project = t.type === "subtask" ? allTasks.find((x) => x.id === t.parentId) : null;
            const quad = quadrantOf(t.urgent, t.important);
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2">
                <span className={cn("size-2 shrink-0 rounded-full", QUAD_DOT[quad.key])} title={quad.label} />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-[11px]">
                    <span>
                      {t.plannedDate ? `Planificada el ${formatDateDisplay(t.plannedDate)}` : `Sin planificar · venció el ${formatDateDisplay(t.deadline)}`}
                    </span>
                    {t.deadline && t.plannedDate && <span>· vence {formatDateDisplay(t.deadline)}</span>}
                    {project && (
                      <button onClick={() => onOpenProject(project.id)} className="text-primary hover:underline flex items-center gap-0.5 font-semibold">
                        <FolderKanban className="size-3" /> {project.title}
                      </button>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="secondary" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={() => setTaskPlannedDate(t.id, today)}>
                    Hoy
                  </Button>
                  <Button variant="secondary" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={() => setTaskPlannedDate(t.id, tomorrow)}>
                    Mañana
                  </Button>
                  <input
                    type="date"
                    aria-label={`Elegir nueva fecha para ${t.title}`}
                    min={today}
                    value=""
                    onChange={(e) => e.target.value && setTaskPlannedDate(t.id, e.target.value)}
                    className="bg-secondary h-7 w-[122px] rounded-lg border px-1.5 text-xs"
                  />
                  <button
                    onClick={() => markDone(t)}
                    className="text-muted-foreground rounded-full p-1.5 hover:bg-emerald-500/15 hover:text-emerald-600"
                    aria-label="Marcar como hecha"
                    title="Marcar como hecha"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    onClick={() => onEdit(t)}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full p-1.5"
                    aria-label="Editar"
                    title="Editar"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ main view

export function PlannerViewPage() {
  const router = useRouter();
  const tasks = useTaskStore((s) => s.tasks);
  const view = useTaskStore((s) => s.plannerView);
  const setPlannerView = useTaskStore((s) => s.setPlannerView);
  const showDone = useTaskStore((s) => s.plannerShowDone);
  const toggleShowDone = useTaskStore((s) => s.togglePlannerShowDone);
  const setTaskPlannedDate = useTaskStore((s) => s.setTaskPlannedDate);
  const selectProject = useTaskStore((s) => s.selectProject);
  const groupByProjectEnabled = useTaskStore((s) => s.weekGroupByProject);
  const toggleWeekGrouping = useTaskStore((s) => s.toggleWeekGrouping);
  const hasHydrated = useTaskStore((s) => s.hasHydrated);

  const [cursor, setCursor] = React.useState(() => todayISO());
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [formState, setFormState] = React.useState<FormState>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // The date isn't known until we're on the client; render nothing date-dependent before hydration.
  const today = todayISO();
  const overdue = React.useMemo(() => overdueTasks(tasks, today), [tasks, today]);
  const unscheduled = React.useMemo(() => unscheduledTasks(tasks, today), [tasks, today]);
  const unscheduledProjectTasks = unscheduled.filter((t) => t.type === "subtask");
  const unscheduledSimpleTasks = unscheduled.filter((t) => t.type === "simple");

  function openProject(projectId: string) {
    selectProject(projectId);
    router.push("/proyectos");
  }

  function shift(dir: -1 | 1) {
    setCursor((c) => (view === "month" ? addMonthsISO(c, dir) : view === "week" ? addDaysISO(c, 7 * dir) : addDaysISO(c, dir)));
  }

  function goToDay(iso: string) {
    setCursor(iso);
    setPlannerView("day");
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === e.active.id) ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    if (overId === "unscheduled") setTaskPlannedDate(String(active.id), null);
    else if (overId.startsWith("date-")) setTaskPlannedDate(String(active.id), overId.slice(5));
  }

  const title = view === "month" ? monthLabel(cursor) : view === "week" ? weekRangeLabel(weekStartISO(cursor)) : dayLongLabel(cursor);
  const editTask = (t: Task) => setFormState({ mode: "edit", task: t });
  const unplan = (id: string) => setTaskPlannedDate(id, null);

  const weekStart = weekStartISO(cursor);
  const monthWeeks = monthGridISO(cursor);
  const cursorMonth = isoToLocalDate(cursor).getMonth();

  if (!hasHydrated) return null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Planificación</h1>
          <p className="text-muted-foreground mt-1 text-sm">Arrastra tareas al día en que las harás. Se ordenan por prioridad Eisenhower.</p>
        </div>
        <Button className="gradient-brand shrink-0 gap-1.5 rounded-2xl border-0 text-white shadow-soft" onClick={() => setFormState({ mode: "new-simple", plannedDate: view === "month" ? undefined : cursor })}>
          <Plus className="size-4" /> Nueva tarea simple
        </Button>
      </div>

      <OverdueBanner tasks={overdue} allTasks={tasks} onEdit={editTask} onOpenProject={openProject} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="bg-muted flex items-center gap-0.5 rounded-2xl p-1">
          {(Object.keys(VIEW_LABELS) as PlannerView[]).map((v) => (
            <button
              key={v}
              onClick={() => setPlannerView(v)}
              aria-pressed={view === v}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                view === v ? "bg-card shadow-soft" : "text-muted-foreground"
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(-1)} aria-label="Anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setCursor(todayISO())}>
            Hoy
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => shift(1)} aria-label="Siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <h2 className="text-lg font-semibold tracking-tight first-letter:uppercase">{title}</h2>

        <button
          onClick={toggleShowDone}
          aria-pressed={showDone}
          title={showDone ? "Ocultar las tareas completadas" : "Mostrar también las tareas completadas"}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-semibold transition-colors",
            showDone ? "border-primary/40 bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {showDone ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {showDone ? "Mostrando completadas" : "Ver completadas"}
        </button>

        {view !== "month" && (
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
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTask(null)}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            {view === "month" && (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                    {DAY_SHORT.map((d) => (
                      <p key={d} className="text-muted-foreground px-1 text-center text-[10.5px] font-bold tracking-wide uppercase">{d}</p>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {monthWeeks.map((week) => (
                      <div key={week[0]} className="grid grid-cols-7 gap-1.5">
                        {week.map((iso) => (
                          <MonthCell
                            key={iso}
                            iso={iso}
                            month={cursorMonth}
                            today={today}
                            tasks={tasksOnDate(tasks, iso, showDone)}
                            deadlines={deadlinesOnDate(tasks, iso)}
                            onEdit={editTask}
                            onAdd={() => setFormState({ mode: "new-simple", plannedDate: iso })}
                            onOpenDay={() => goToDay(iso)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {view === "week" && (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
                {weekDaysISO(weekStart).map((iso, i) => (
                  <DayColumn
                    key={iso}
                    id={`date-${iso}`}
                    label={DAY_NAMES[i]}
                    sublabel={String(isoToLocalDate(iso).getDate())}
                    highlight={iso === today}
                    tasks={tasksOnDate(tasks, iso, showDone)}
                    deadlines={deadlinesOnDate(tasks, iso)}
                    allTasks={tasks}
                    grouped={groupByProjectEnabled}
                    today={today}
                    plannedDate={iso}
                    onEdit={editTask}
                    onUnplan={unplan}
                    onOpenProject={openProject}
                    onAdd={() => setFormState({ mode: "new-simple", plannedDate: iso })}
                  />
                ))}
              </div>
            )}

            {view === "day" && (
              <DayColumn
                id={`date-${cursor}`}
                label={cursor === today ? "Hoy" : DAY_NAMES[(isoToLocalDate(cursor).getDay() + 6) % 7]}
                sublabel={formatDateDisplay(cursor)}
                highlight={cursor === today}
                tasks={tasksOnDate(tasks, cursor, showDone)}
                deadlines={deadlinesOnDate(tasks, cursor)}
                allTasks={tasks}
                grouped={groupByProjectEnabled}
                comfy
                today={today}
                plannedDate={cursor}
                onEdit={editTask}
                onUnplan={unplan}
                onOpenProject={openProject}
                onAdd={() => setFormState({ mode: "new-simple", plannedDate: cursor })}
                emptyHint="Nada planificado para este día. Arrastra tareas desde «Sin fecha» o crea una nueva."
              />
            )}
          </div>

          <UnscheduledAside
            projectTasks={unscheduledProjectTasks}
            simpleTasks={unscheduledSimpleTasks}
            allTasks={tasks}
            grouped={groupByProjectEnabled}
            onEdit={editTask}
            onOpenProject={openProject}
          />
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCard task={activeTask} noEdit className="w-64 shadow-2xl" /> : null}
        </DragOverlay>
      </DndContext>

      {formState && (
        <TaskFormModal
          open={!!formState}
          onOpenChange={(v) => !v && setFormState(null)}
          mode={formState.mode}
          task={formState.task}
          defaultPlannedDate={formState.plannedDate}
        />
      )}
    </div>
  );
}

function UnscheduledAside({ projectTasks, simpleTasks, allTasks, grouped, onEdit, onOpenProject }: {
  projectTasks: Task[];
  simpleTasks: Task[];
  allTasks: Task[];
  grouped: boolean;
  onEdit: (t: Task) => void;
  onOpenProject: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });
  const total = projectTasks.length + simpleTasks.length;
  return (
    <aside
      ref={setNodeRef}
      className={cn(
        "glass shadow-soft w-full shrink-0 rounded-3xl p-3 transition-colors xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:w-72 xl:overflow-y-auto",
        isOver && "ring-primary/50 bg-primary/5 ring-2"
      )}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        <CalendarClock className="text-muted-foreground size-4" />
        <h2 className="text-sm font-semibold">Sin fecha</h2>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{total}</span>
      </div>
      <p className="text-muted-foreground mb-3 px-1 text-[11px]">Arrastra una tarea al calendario para planificarla. Soltar aquí le quita la fecha.</p>

      <div className="flex flex-col gap-3">
        <section>
          <h3 className="text-muted-foreground mb-1.5 px-1 text-[10.5px] font-bold tracking-wide uppercase">Tareas de proyectos</h3>
          <ColumnList tasks={projectTasks} allTasks={allTasks} grouped={grouped} onEdit={onEdit} onOpenProject={onOpenProject} empty="Todas tienen fecha." />
        </section>
        <section>
          <h3 className="text-muted-foreground mb-1.5 px-1 text-[10.5px] font-bold tracking-wide uppercase">Tareas sin proyecto</h3>
          <ColumnList tasks={simpleTasks} allTasks={allTasks} grouped={false} onEdit={onEdit} empty="Todas tienen fecha." />
        </section>
      </div>
    </aside>
  );
}

function ColumnList({ tasks, allTasks, grouped, onEdit, onOpenProject, empty }: {
  tasks: Task[];
  allTasks: Task[];
  grouped: boolean;
  onEdit: (t: Task) => void;
  onOpenProject?: (id: string) => void;
  empty: string;
}) {
  if (tasks.length === 0) return <p className="text-muted-foreground px-1 py-2 text-center text-xs">{empty}</p>;
  const groups = grouped ? groupByProject(tasks, allTasks) : null;
  const card = (t: Task, hideParentTag: boolean) => (
    <DraggableTaskCard
      key={t.id}
      task={t}
      compact
      hideParentTag={hideParentTag}
      onEdit={() => onEdit(t)}
      onOpenParent={!hideParentTag && onOpenProject && t.parentId ? () => onOpenProject(t.parentId!) : undefined}
    />
  );
  if (!groups) return <div className="flex flex-col gap-1.5">{tasks.map((t) => card(t, false))}</div>;
  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((g) => (
        <div key={g.project?.id ?? "__none__"} className="flex flex-col gap-1.5">
          {g.project && (
            <div className="flex items-center gap-0.5 px-0.5">
              <p className="text-primary flex min-w-0 flex-1 items-center gap-1 text-[10.5px] font-bold">
                <FolderKanban className="size-3 shrink-0" />
                <span className="truncate">{g.project.title}</span>
              </p>
              {onOpenProject && (
                <button
                  type="button"
                  onClick={() => onOpenProject(g.project!.id)}
                  title="Ir al proyecto para ver o agregar tareas"
                  aria-label={`Ir al proyecto ${g.project.title}`}
                  className="text-primary hover:bg-primary/15 shrink-0 rounded-full p-1 transition-colors"
                >
                  <ArrowUpRight className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {g.items.map((t) => card(t, !!g.project))}
        </div>
      ))}
    </div>
  );
}

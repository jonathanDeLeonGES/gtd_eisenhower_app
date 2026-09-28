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
import { motion } from "framer-motion";
import { Plus, FolderKanban, Pencil, Trash2, AlertTriangle, Clock, Search, X, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DraggableTaskCard } from "@/components/draggable-task-card";
import { TaskCard } from "@/components/task-card";
import { TaskFormModal, type TaskFormMode } from "@/components/task-form-modal";
import { useTaskStore, subtasksOf, projectProgress, getProjectActionStatus, projectNeedsNextAction, categoryById } from "@/lib/store";
import { quadrantOf, QUAD_ORDER, QUAD_STYLES } from "@/lib/quadrant";
import { goalPath } from "@/lib/goals";
import { KANBAN_COLUMNS, PROJECT_STATE_LABELS, type ProjectState, type Task, type TaskStatus } from "@/lib/types";

const NO_CATEGORY = "__none__";
const STATE_FILTER_OPTIONS: { value: ProjectState | "all"; label: string }[] = [
  { value: "active", label: "Activos" },
  { value: "paused", label: "En pausa" },
  { value: "someday", label: "Algún día" },
  { value: "done", label: "Completados" },
  { value: "all", label: "Todos" },
];

function KanbanColumn({ id, label, tasks, onEdit, onDelete, footer }: {
  id: TaskStatus;
  label: string;
  tasks: Task[];
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  footer?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass flex min-h-[200px] flex-col gap-1.5 rounded-2xl p-2 transition-colors",
        isOver && "ring-primary/50 bg-primary/5 ring-2"
      )}
    >
      <div className="flex items-center justify-between px-1 pt-0.5 pb-1">
        <span className="text-muted-foreground text-[10.5px] font-bold tracking-wide uppercase">{label}</span>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{tasks.length}</span>
      </div>
      {tasks.map((t) => (
        <DraggableTaskCard key={t.id} task={t} compact onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />
      ))}
      {footer}
    </div>
  );
}

function ProjectCard({ project, active, onSelect, onEdit, onDelete }: {
  project: Task;
  active: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tasks = useTaskStore((s) => s.tasks);
  const categories = useTaskStore((s) => s.categories);
  const goals = useTaskStore((s) => s.goals);
  const goal = project.goalId ? goals.find((g) => g.id === project.goalId) : undefined;
  const prog = projectProgress(tasks, project.id);
  const category = categoryById(categories, project.category);
  const quad = quadrantOf(project.urgent, project.important);
  const state = (project.projectState as ProjectState) ?? "active";
  const actionStatus = getProjectActionStatus(tasks, project);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      aria-current={active ? "true" : undefined}
      className={cn("glass shadow-soft group relative overflow-hidden rounded-[20px] p-3 transition-shadow", active && "ring-primary ring-2")}
    >
      {active && (
        <>
          <span aria-hidden className="bg-primary/10 pointer-events-none absolute inset-0" />
          <span aria-hidden className="gradient-brand pointer-events-none absolute inset-y-0 left-0 w-1.5" />
        </>
      )}
      <button onClick={onSelect} className={cn("relative block w-full text-left", active && "pl-1.5")}>
        <p className={cn("flex items-center gap-1.5 pr-16 text-sm font-semibold", active && "text-primary")}>
          <FolderKanban className="text-primary size-4 shrink-0" />
          <span className="truncate">{project.title}</span>
        </p>
        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
          <div className="gradient-brand h-full rounded-full" style={{ width: `${prog.pct}%` }} />
        </div>
        <p className="text-muted-foreground mt-1 text-[11px]">{prog.done}/{prog.total} · {prog.pct}%</p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {category ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: category.color }}>
              {category.name}
            </span>
          ) : (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">Sin categoría</span>
          )}
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", QUAD_STYLES[quad.key])}>{quad.label}</span>
          {state !== "active" && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">{PROJECT_STATE_LABELS[state]}</span>
          )}
          {goal && (
            <span
              title={`Meta: ${goalPath(goals, goal.id)}`}
              className="bg-primary/10 text-primary inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            >
              <Target className="size-3 shrink-0" />
              <span className="truncate">{goal.title}</span>
            </span>
          )}
        </div>
        {actionStatus === "stalled" && (
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10.5px] font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-3 shrink-0" />
            Sin próxima acción
          </div>
        )}
        {actionStatus === "waiting" && (
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-[10.5px] font-semibold text-sky-700 dark:text-sky-300">
            <Clock className="size-3 shrink-0" />
            Esperando a alguien
          </div>
        )}
      </button>
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full p-1.5"
          aria-label="Modificar proyecto"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-full p-1.5"
          aria-label="Eliminar proyecto"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export function BoardView() {
  const tasks = useTaskStore((s) => s.tasks);
  const categories = useTaskStore((s) => s.categories);
  const selectedProjectId = useTaskStore((s) => s.selectedProjectId);
  const selectProject = useTaskStore((s) => s.selectProject);
  const setTaskStatus = useTaskStore((s) => s.setTaskStatus);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const createSubtask = useTaskStore((s) => s.createSubtask);

  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [formState, setFormState] = React.useState<{ mode: TaskFormMode; task?: Task } | null>(null);
  const [quickSubtask, setQuickSubtask] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<Set<string> | null>(null);
  // Arriving from another page with a non-active project selected (e.g. from the weekly planner) must still show it.
  const [stateFilter, setStateFilter] = React.useState<ProjectState | "all">(() => {
    const { tasks: all, selectedProjectId: selId } = useTaskStore.getState();
    const sel = all.find((t) => t.id === selId);
    return sel && (sel.projectState ?? "active") !== "active" ? "all" : "active";
  });
  const [deleteTarget, setDeleteTarget] = React.useState<Task | null>(null);
  const [query, setQuery] = React.useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const allProjectsUnfiltered = tasks.filter((t) => t.type === "project");
  const attentionCount = allProjectsUnfiltered.filter((p) => projectNeedsNextAction(tasks, p)).length;
  const waitingCount = allProjectsUnfiltered.filter((p) => getProjectActionStatus(tasks, p) === "waiting").length;
  const allProjects = allProjectsUnfiltered.filter((p) => stateFilter === "all" || (p.projectState ?? "active") === stateFilter);
  const hasUncategorized = allProjects.some((p) => !p.category);
  const filterChips = [...categories, ...(hasUncategorized ? [{ id: NO_CATEGORY, name: "Sin categoría", color: "#94a3b8" }] : [])];

  // A chip is "selected" only when the user picked it; with no selection ("Todas") nothing is filtered out.
  function isChipSelected(id: string) {
    return categoryFilter !== null && categoryFilter.has(id);
  }
  function toggleChip(id: string) {
    setCategoryFilter((prev) => {
      if (prev === null) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0 || next.size === filterChips.length) return null;
      return next;
    });
  }

  // Accent- and case-insensitive match, so "planeacion" finds "Planeación".
  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const normalizedQuery = normalize(query.trim());

  const projects = allProjects.filter((p) => {
    if (categoryFilter !== null && !categoryFilter.has(p.category ?? NO_CATEGORY)) return false;
    return !normalizedQuery || normalize(p.title).includes(normalizedQuery);
  });

  // The board only shows a project that is also visible in the (filtered) list.
  const selectedProject = selectedProjectId ? tasks.find((t) => t.id === selectedProjectId) ?? null : null;
  const project = selectedProject && projects.some((p) => p.id === selectedProject.id) ? selectedProject : null;
  const subs = project ? subtasksOf(tasks, project.id) : [];
  const projectCategory = project ? categoryById(categories, project.category) : null;
  const projectProg = project ? projectProgress(tasks, project.id) : null;

  function handleProjectSaved(id?: string) {
    if (!id) return;
    setCategoryFilter(null);
    const created = useTaskStore.getState().tasks.find((t) => t.id === id);
    const createdState = (created?.projectState as ProjectState) ?? "active";
    setStateFilter((cur) => (cur === "all" || cur === createdState ? cur : "all"));
  }

  function confirmDeleteProject() {
    if (!deleteTarget) return;
    deleteTask(deleteTarget.id);
    toast.success("Proyecto eliminado", { description: deleteTarget.title });
    setDeleteTarget(null);
  }

  function tasksFor(status: TaskStatus) {
    return subs
      .filter((s) => s.status === status)
      .sort((a, b) => QUAD_ORDER[quadrantOf(a.urgent, a.important).key] - QUAD_ORDER[quadrantOf(b.urgent, b.important).key]);
  }

  function handleDragStart(e: DragStartEvent) {
    const t = tasks.find((x) => x.id === e.active.id);
    setActiveTask(t ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = e;
    if (!over || !project) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.parentId !== project.id) return;
    setTaskStatus(String(active.id), over.id as TaskStatus);
  }

  function handleQuickAdd() {
    const title = quickSubtask.trim();
    if (!title || !project) return;
    createSubtask(project.id, {
      title,
      notes: "",
      category: project.category,
      urgent: false,
      important: false,
      deadline: null,
      plannedDate: null,
    });
    setQuickSubtask("");
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Board de proyectos</h1>
        <p className="text-muted-foreground mt-1 text-sm">Vista kanban por proyecto. Arrastra subtareas entre columnas.</p>
      </div>

      {(attentionCount > 0 || waitingCount > 0) && (
        <div className="mb-4 flex flex-col gap-1.5">
          {attentionCount > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              {attentionCount === 1
                ? "1 proyecto activo no tiene próxima acción definida."
                : `${attentionCount} proyectos activos no tienen próxima acción definida.`}
            </div>
          )}
          {waitingCount > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-700 dark:text-sky-300">
              <Clock className="size-4 shrink-0" />
              {waitingCount === 1
                ? "1 proyecto activo solo está esperando a alguien más."
                : `${waitingCount} proyectos activos solo están esperando a alguien más.`}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 lg:w-72">
          <Button
            className="gradient-brand mb-3 w-full gap-1.5 rounded-2xl border-0 text-white shadow-soft"
            onClick={() => setFormState({ mode: "new-project" })}
          >
            <Plus className="size-4" /> Nuevo proyecto
          </Button>

          <div className="relative mb-3">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar proyecto…"
              aria-label="Buscar proyecto por título"
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

          <div className="mb-3 space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Estado</label>
            <Select value={stateFilter} onValueChange={(v) => setStateFilter((v as ProjectState | "all") ?? "active")}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue>{(v: string) => STATE_FILTER_OPTIONS.find((o) => o.value === v)?.label ?? "Activos"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATE_FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filterChips.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  categoryFilter === null ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                Todas
              </button>
              {filterChips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleChip(c.id)}
                  aria-pressed={isChipSelected(c.id)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    isChipSelected(c.id) ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted/40 text-muted-foreground"
                  )}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {allProjects.length === 0 && (
              <p className="text-muted-foreground px-1 text-sm">Aún no hay proyectos.</p>
            )}
            {allProjects.length > 0 && projects.length === 0 && (
              <p className="text-muted-foreground px-1 text-sm">
                {normalizedQuery ? `Ningún proyecto coincide con “${query.trim()}”.` : "Ningún proyecto coincide con este filtro."}
              </p>
            )}
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                active={project?.id === p.id}
                onSelect={() => selectProject(p.id)}
                onEdit={() => setFormState({ mode: "edit", task: p })}
                onDelete={() => setDeleteTarget(p)}
              />
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {!project ? (
            <div className="glass shadow-soft flex min-h-[300px] items-center justify-center rounded-[20px] border-dashed p-10 text-center">
              <p className="text-muted-foreground text-sm">Selecciona un proyecto para ver su tablero.</p>
            </div>
          ) : (
            <>
            <div className="glass shadow-soft border-primary/40 mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[20px] px-4 py-3">
              <span className="gradient-brand flex size-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-soft">
                <FolderKanban className="size-5" />
              </span>
              <div className="min-w-[10rem] flex-1">
                <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Tareas del proyecto</p>
                <h2 className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight break-words">{project.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {projectCategory ? (
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: projectCategory.color }}>
                    {projectCategory.name}
                  </span>
                ) : (
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-semibold">Sin categoría</span>
                )}
                {projectProg && (
                  <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1 text-[11px] font-semibold">
                    {projectProg.done}/{projectProg.total} · {projectProg.pct}%
                  </span>
                )}
              </div>
            </div>
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                {KANBAN_COLUMNS.map((col) => (
                  <KanbanColumn
                    key={col.key}
                    id={col.key}
                    label={col.label}
                    tasks={tasksFor(col.key)}
                    onEdit={(t) => setFormState({ mode: "edit", task: t })}
                    onDelete={deleteTask}
                    footer={
                      col.key === "todo" ? (
                        <Input
                          value={quickSubtask}
                          onChange={(e) => setQuickSubtask(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                          placeholder="+ Nueva subtarea…"
                          className="rounded-xl"
                        />
                      ) : undefined
                    }
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={null}>
                {activeTask ? <TaskCard task={activeTask} noEdit className="w-72 shadow-2xl" /> : null}
              </DragOverlay>
            </DndContext>
            </>
          )}
        </div>
      </div>

      {formState && (
        <TaskFormModal
          open={!!formState}
          onOpenChange={(v) => !v && setFormState(null)}
          mode={formState.mode}
          task={formState.task}
          onSaved={formState.mode === "new-project" ? handleProjectSaved : undefined}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="glass shadow-soft rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar proyecto</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Se eliminará &ldquo;{deleteTarget?.title}&rdquo;
            {deleteTarget && subtasksOf(tasks, deleteTarget.id).length > 0
              ? ` junto con sus ${subtasksOf(tasks, deleteTarget.id).length} subtareas`
              : ""}
            . Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="rounded-xl" onClick={confirmDeleteProject}>
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

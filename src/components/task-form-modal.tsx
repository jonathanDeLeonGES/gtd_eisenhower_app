"use client";

import * as React from "react";
import { cn } from "cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTaskStore, type TaskFormInput } from "@/lib/store";
import { quadrantOf, QUAD_STYLES } from "@/lib/quadrant";
import { addDaysISO, recurrenceLabel, todayISO } from "@/lib/date-utils";
import { flattenGoals } from "@/lib/goals";
import { PROJECT_STATE_LABELS, PROJECT_STATE_ORDER, type ProjectState, type RecurrenceFreq, type Task } from "@/lib/types";

export type TaskFormMode = "process-simple" | "process-project" | "new-simple" | "new-project" | "new-subtask" | "edit";

export function TaskFormModal({
  open,
  onOpenChange,
  mode,
  task,
  parentId,
  onSaved,
  defaultGoalId,
  defaultCategory,
  defaultPlannedDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: TaskFormMode;
  task?: Task | null;
  parentId?: string;
  /** Called after a successful save; receives the new project's id when one was created. */
  onSaved?: (createdId?: string) => void;
  /** New projects: pre-link to this goal. */
  defaultGoalId?: string | null;
  /** New projects: pre-select this category. */
  defaultCategory?: string | null;
  /** New tasks: pre-plan for this date (ISO). */
  defaultPlannedDate?: string | null;
}) {
  const categories = useTaskStore((s) => s.categories);
  const goals = useTaskStore((s) => s.goals);
  const goalOptions = React.useMemo(() => flattenGoals(goals), [goals]);
  const processTaskAsSimple = useTaskStore((s) => s.processTaskAsSimple);
  const processTaskAsProject = useTaskStore((s) => s.processTaskAsProject);
  const createSimpleTask = useTaskStore((s) => s.createSimpleTask);
  const createProject = useTaskStore((s) => s.createProject);
  const createSubtask = useTaskStore((s) => s.createSubtask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  const isProjectMode = mode.includes("project");
  const isProjectEdit = mode === "edit" && task?.type === "project";
  const showProjectFields = isProjectMode || isProjectEdit;
  const isSubtaskEdit = mode === "edit" && task?.type === "subtask";
  const isSimple = mode.includes("simple") || (mode === "edit" && task?.type === "simple");
  const deadlineRequired = isSimple;
  const categoryRequired = mode === "new-project" || mode === "process-project";
  // Projects are deleted from the board (with their own confirmation); tasks are deleted here.
  const canDelete = mode === "edit" && !!task && (task.type === "simple" || task.type === "subtask");

  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(null);
  const [urgent, setUrgent] = React.useState(false);
  const [important, setImportant] = React.useState(false);
  const [deadline, setDeadline] = React.useState("");
  const [plannedDate, setPlannedDate] = React.useState("");
  const [seedSubtasks, setSeedSubtasks] = React.useState("");
  const [recurFreq, setRecurFreq] = React.useState<string>("none");
  const [recurInterval, setRecurInterval] = React.useState(1);
  const [projectState, setProjectState] = React.useState<ProjectState>("active");
  const [reviewDate, setReviewDate] = React.useState("");
  const [waitingOn, setWaitingOn] = React.useState("");
  const [goalId, setGoalId] = React.useState<string>("none");
  const [error, setError] = React.useState<{ field: "title" | "category" | "deadline"; message: string } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmingDelete(false);
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setCategory(task?.category ?? defaultCategory ?? null);
    setUrgent(task?.urgent ?? false);
    setImportant(task?.important ?? false);
    setDeadline(task?.deadline ?? "");
    setPlannedDate(task?.plannedDate ?? defaultPlannedDate ?? "");
    setSeedSubtasks("");
    setRecurFreq(task?.recurrence?.freq ?? "none");
    setRecurInterval(task?.recurrence?.interval ?? 1);
    setProjectState((task?.projectState as ProjectState) ?? "active");
    setReviewDate(task?.reviewDate ?? "");
    setWaitingOn(task?.waitingOn ?? "");
    setGoalId(task?.goalId ?? defaultGoalId ?? "none");
  }, [open, task, defaultGoalId, defaultCategory, defaultPlannedDate]);

  const quad = quadrantOf(urgent, important);

  const heading =
    mode === "process-simple"
      ? "Procesar: tarea simple"
      : mode === "process-project"
        ? "Procesar: proyecto"
        : mode === "new-simple"
          ? "Nueva tarea simple"
          : mode === "new-project"
            ? "Nuevo proyecto"
            : mode === "new-subtask"
              ? "Nueva subtarea"
              : task?.type === "project"
                ? "Editar proyecto"
                : task?.type === "subtask"
                  ? "Editar subtarea"
                  : "Editar tarea";

  function handleSave() {
    const titleVal = title.trim();
    if (!titleVal) {
      setError({ field: "title", message: "El título es obligatorio." });
      return;
    }
    if (categoryRequired && !category) {
      setError({ field: "category", message: "Selecciona una categoría para el proyecto (Personal, Laboral…)." });
      return;
    }
    const deadlineVal = deadline || null;
    if (deadlineRequired && !deadlineVal) {
      setError({ field: "deadline", message: "Las tareas simples requieren fecha límite." });
      return;
    }
    const recurrence =
      isSimple && recurFreq !== "none"
        ? { freq: recurFreq as RecurrenceFreq, interval: Math.max(1, recurInterval || 1) }
        : null;

    const input: TaskFormInput = {
      title: titleVal,
      notes: notes.trim(),
      category,
      urgent,
      important,
      deadline: deadlineVal,
      plannedDate: !showProjectFields && plannedDate ? plannedDate : null,
      recurrence,
      projectState: showProjectFields ? projectState : undefined,
      reviewDate: showProjectFields ? reviewDate || null : undefined,
      waitingOn: isSubtaskEdit ? waitingOn.trim() || null : undefined,
      goalId: showProjectFields ? (goalId === "none" ? null : goalId) : undefined,
    };

    const seedList = seedSubtasks
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let createdId: string | undefined;
    if (mode === "process-simple" && task) processTaskAsSimple(task.id, input);
    else if (mode === "process-project" && task) processTaskAsProject(task.id, input, seedList);
    else if (mode === "new-simple") createSimpleTask(input);
    else if (mode === "new-project") createdId = createProject(input, seedList);
    else if (mode === "new-subtask" && parentId) createSubtask(parentId, input);
    else if (mode === "edit" && task) updateTask(task.id, input, isSimple);

    onSaved?.(createdId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass shadow-soft max-h-[85vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Título</label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error?.field === "title") setError(null);
              }}
              placeholder="¿Qué hay que hacer?"
              aria-invalid={error?.field === "title"}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Notas (opcional)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles adicionales…" className="rounded-xl" />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">
                Categoría{categoryRequired && <span className="text-destructive"> *</span>}
              </label>
              <Select
                value={category ?? "none"}
                onValueChange={(v) => {
                  setCategory(v === "none" ? null : v);
                  if (error?.field === "category") setError(null);
                }}
              >
                <SelectTrigger
                  aria-invalid={error?.field === "category"}
                  className={cn("w-full rounded-xl", categoryRequired && !category && "text-muted-foreground")}
                >
                  <SelectValue>
                    {(v: string) =>
                      v === "none"
                        ? categoryRequired
                          ? "Selecciona una categoría"
                          : "Sin categoría"
                        : (categories.find((c) => c.id === v)?.name ?? "Sin categoría")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled={categoryRequired}>
                    {categoryRequired ? "Selecciona una categoría" : "Sin categoría"}
                  </SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!showProjectFields && (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Fecha planificada (opcional)</label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  className="w-auto rounded-xl"
                />
                {[
                  ["Hoy", todayISO()],
                  ["Mañana", addDaysISO(todayISO(), 1)],
                ].map(([label, iso]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setPlannedDate(iso)}
                    className="bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  >
                    {label}
                  </button>
                ))}
                {plannedDate && (
                  <button
                    type="button"
                    onClick={() => setPlannedDate("")}
                    className="text-muted-foreground hover:text-foreground rounded-full px-2 py-1 text-[11px] font-semibold"
                  >
                    Quitar
                  </button>
                )}
              </div>
              <p className="text-muted-foreground text-xs">El día en que piensas hacerla; aparece en el calendario de Planificación. No es la fecha límite.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Prioridad Eisenhower</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUrgent((v) => !v)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                  urgent ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                Urgente
              </button>
              <button
                type="button"
                onClick={() => setImportant((v) => !v)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                  important ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                Importante
              </button>
            </div>
            <div className={cn("rounded-xl border px-3 py-2 text-center text-sm font-bold", QUAD_STYLES[quad.key])}>
              {quad.label}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">
              {isSubtaskEdit && task?.status === "delegated" ? "Fecha de seguimiento" : "Fecha límite"}{" "}
              {deadlineRequired ? "(obligatoria)" : "(opcional)"}
            </label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => {
                setDeadline(e.target.value);
                if (error?.field === "deadline") setError(null);
              }}
              aria-invalid={error?.field === "deadline"}
              className="rounded-xl"
            />
          </div>

          {isSubtaskEdit && task?.status === "delegated" && (
            <div className="bg-primary/5 border-primary/20 space-y-1.5 rounded-xl border p-3">
              <label className="text-muted-foreground text-xs font-semibold">¿A quién esperas? (opcional)</label>
              <Input
                value={waitingOn}
                onChange={(e) => setWaitingOn(e.target.value)}
                placeholder="Ej: María — propuesta técnica del proveedor"
                className="rounded-xl"
              />
              <p className="text-muted-foreground text-xs">
                Esta tarea está en Delegado. Registra el responsable y usa la fecha de arriba como fecha de seguimiento — así cuenta como una próxima acción para el proyecto.
              </p>
            </div>
          )}

          {showProjectFields && (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Estado del proyecto</label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={projectState} onValueChange={(v) => setProjectState((v as ProjectState) ?? "active")}>
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue>{(v: string) => PROJECT_STATE_LABELS[v as ProjectState] ?? "Activo"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATE_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>{PROJECT_STATE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(projectState === "paused" || projectState === "someday") && (
                  <Input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="rounded-xl"
                    title="Fecha de revisión"
                  />
                )}
              </div>
              {(projectState === "paused" || projectState === "someday") && (
                <p className="text-muted-foreground text-xs">Fecha de revisión: cuándo quieres volver a mirar este proyecto.</p>
              )}
            </div>
          )}

          {showProjectFields && (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Meta (opcional)</label>
              <Select value={goalId} onValueChange={(v) => setGoalId(v ?? "none")}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue>
                    {(v: string) => (v === "none" ? "Sin meta" : (goals.find((g) => g.id === v)?.title ?? "Sin meta"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin meta</SelectItem>
                  {goalOptions.map(({ goal, depth }) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      <span style={{ paddingLeft: depth * 12 }}>{goal.icon} {goal.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isSimple && (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Repetición (opcional)</label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={recurFreq} onValueChange={(v) => setRecurFreq(v ?? "none")}>
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue>
                      {(v: string) =>
                        v === "none" ? "No se repite" : v === "daily" ? "Diaria" : v === "weekly" ? "Semanal" : "Mensual"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No se repite</SelectItem>
                    <SelectItem value="daily">Diaria</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
                {recurFreq !== "none" && (
                  <Input
                    type="number"
                    min={1}
                    value={recurInterval}
                    onChange={(e) => setRecurInterval(Math.max(1, Number(e.target.value) || 1))}
                    className="rounded-xl"
                  />
                )}
              </div>
              {recurFreq !== "none" && (
                <p className="text-muted-foreground text-xs">
                  Se repite: {recurrenceLabel({ freq: recurFreq as RecurrenceFreq, interval: recurInterval })}. Al marcarla como hecha se creará la siguiente ocurrencia.
                </p>
              )}
            </div>
          )}

          {isProjectMode && (
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Subtareas iniciales (una por línea, opcional)</label>
              <Textarea
                value={seedSubtasks}
                onChange={(e) => setSeedSubtasks(e.target.value)}
                placeholder={"Ej: Investigar proveedores\nRedactar propuesta"}
                className="rounded-xl"
              />
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="text-destructive bg-destructive/10 rounded-xl px-3 py-2 text-sm font-medium">
            {error.message}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          {canDelete ? (
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                if (task) deleteTask(task.id);
                onOpenChange(false);
              }}
            >
              {confirmingDelete ? "¿Seguro? Eliminar" : "Eliminar"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} className="gradient-brand rounded-xl border-0 text-white shadow-soft hover:opacity-90">Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

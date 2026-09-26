"use client";

import * as React from "react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskStore } from "@/lib/store";
import { dateToISO, isoToLocalDate, todayISO } from "@/lib/date-utils";
import { descendantGoalIds, flattenGoals } from "@/lib/goals";
import {
  GOAL_ICONS,
  GOAL_PRIORITY_LABELS,
  GOAL_PRIORITY_ORDER,
  GOAL_STATUS_LABELS,
  GOAL_STATUS_ORDER,
  type Goal,
  type GoalPriority,
  type GoalStatus,
} from "@/lib/types";

/** Quick end-date suggestions, relative to the start date (or today). */
function endSuggestions(startISO: string): { label: string; iso: string }[] {
  const base = startISO ? isoToLocalDate(startISO) : isoToLocalDate(todayISO());
  const plusMonths = (n: number) => {
    const d = new Date(base);
    d.setMonth(d.getMonth() + n);
    return dateToISO(d);
  };
  const quarterEnd = new Date(base.getFullYear(), Math.floor(base.getMonth() / 3) * 3 + 3, 0);
  const yearEnd = new Date(base.getFullYear(), 11, 31);
  return [
    { label: "+1 mes", iso: plusMonths(1) },
    { label: "+3 meses", iso: plusMonths(3) },
    { label: "+6 meses", iso: plusMonths(6) },
    { label: "Fin de trimestre", iso: dateToISO(quarterEnd) },
    { label: "Fin de año", iso: dateToISO(yearEnd) },
  ];
}

export function GoalFormModal({
  open,
  onOpenChange,
  goal,
  defaultParentId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Editing when set, creating otherwise. */
  goal?: Goal | null;
  defaultParentId?: string | null;
  onSaved?: (id: string) => void;
}) {
  const categories = useTaskStore((s) => s.categories);
  const goals = useTaskStore((s) => s.goals);
  const addGoal = useTaskStore((s) => s.addGoal);
  const updateGoal = useTaskStore((s) => s.updateGoal);
  const moveGoal = useTaskStore((s) => s.moveGoal);

  const [title, setTitle] = React.useState("");
  const [icon, setIcon] = React.useState(GOAL_ICONS[0]);
  const [notes, setNotes] = React.useState("");
  const [outcome, setOutcome] = React.useState("");
  const [category, setCategory] = React.useState<string>("none");
  const [status, setStatus] = React.useState<GoalStatus>("backlog");
  const [priority, setPriority] = React.useState<string>("none");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [reviewDate, setReviewDate] = React.useState("");
  const [parentId, setParentId] = React.useState<string>("none");
  const [error, setError] = React.useState<{ field: "title" | "category" | "dates"; message: string } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    const parent = goal ? null : goals.find((g) => g.id === defaultParentId);
    setTitle(goal?.title ?? "");
    setIcon(goal?.icon ?? GOAL_ICONS[0]);
    setNotes(goal?.notes ?? "");
    setOutcome(goal?.outcome ?? "");
    // A new sub-goal inherits its parent's category.
    setCategory(goal?.category ?? parent?.category ?? "none");
    setStatus(goal?.status ?? "backlog");
    setPriority(goal?.priority ?? "none");
    setStartDate(goal?.startDate ?? "");
    setEndDate(goal?.endDate ?? "");
    setReviewDate(goal?.reviewDate ?? "");
    setParentId(goal ? (goal.parentId ?? "none") : (defaultParentId ?? "none"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal, defaultParentId]);

  // A goal can't be its own ancestor: exclude itself and its descendants from the parent picker.
  const parentOptions = React.useMemo(() => {
    const blocked = goal ? descendantGoalIds(goals, goal.id) : new Set<string>();
    if (goal) blocked.add(goal.id);
    return flattenGoals(goals).filter(({ goal: g }) => !blocked.has(g.id));
  }, [goals, goal]);

  const suggestions = React.useMemo(() => endSuggestions(startDate), [startDate]);

  function handleSave() {
    const titleVal = title.trim();
    if (!titleVal) {
      setError({ field: "title", message: "El nombre de la meta es obligatorio." });
      return;
    }
    if (category === "none") {
      setError({ field: "category", message: "Selecciona una categoría para la meta (Personal, Laboral…)." });
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError({ field: "dates", message: "La fecha fin no puede ser anterior a la fecha de inicio." });
      return;
    }
    const data = {
      title: titleVal,
      icon,
      notes: notes.trim(),
      outcome: outcome.trim(),
      category,
      status,
      priority: priority === "none" ? null : (priority as GoalPriority),
      startDate: startDate || null,
      endDate: endDate || null,
      reviewDate: reviewDate || null,
      parentId: parentId === "none" ? null : parentId,
    };
    if (goal) {
      const { parentId: newParent, ...rest } = data;
      updateGoal(goal.id, rest);
      if (newParent !== goal.parentId) moveGoal(goal.id, newParent, null);
      onSaved?.(goal.id);
    } else {
      onSaved?.(addGoal(data));
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass shadow-soft max-h-[88vh] overflow-y-auto rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : defaultParentId ? "Nueva submeta" : "Nueva meta"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Nombre</label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error?.field === "title") setError(null);
              }}
              placeholder="Ej: Certificarme en gestión de proyectos"
              aria-invalid={error?.field === "title"}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Ícono</label>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl border text-lg transition-colors",
                    icon === ic ? "border-primary/50 bg-primary/15" : "border-border bg-muted/40 hover:bg-muted"
                  )}
                  aria-label={`Ícono ${ic}`}
                  aria-pressed={icon === ic}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Resultado esperado (opcional)</label>
            <Textarea
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="¿Cómo sabrás que se logró esta meta?"
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">
                Categoría<span className="text-destructive"> *</span>
              </label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v ?? "none");
                  if (error?.field === "category") setError(null);
                }}
              >
                <SelectTrigger
                  aria-invalid={error?.field === "category"}
                  className={cn("w-full rounded-xl", category === "none" && "text-muted-foreground")}
                >
                  <SelectValue>
                    {(v: string) => (v === "none" ? "Selecciona una categoría" : (categories.find((c) => c.id === v)?.name ?? "—"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Selecciona una categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Estado</label>
              <Select value={status} onValueChange={(v) => setStatus((v as GoalStatus) ?? "backlog")}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue>{(v: string) => GOAL_STATUS_LABELS[v as GoalStatus] ?? "Backlog"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GOAL_STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{GOAL_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Prioridad</label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? "none")}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue>
                    {(v: string) => (v === "none" ? "Sin prioridad" : (GOAL_PRIORITY_LABELS[v as GoalPriority] ?? "Sin prioridad"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin prioridad</SelectItem>
                  {GOAL_PRIORITY_ORDER.map((p) => (
                    <SelectItem key={p} value={p}>{GOAL_PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Meta padre</label>
              <Select value={parentId} onValueChange={(v) => setParentId(v ?? "none")}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue>
                    {(v: string) => (v === "none" ? "Ninguna (nivel raíz)" : (goals.find((g) => g.id === v)?.title ?? "Ninguna"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ninguna (nivel raíz)</SelectItem>
                  {parentOptions.map(({ goal: g, depth }) => (
                    <SelectItem key={g.id} value={g.id}>
                      <span style={{ paddingLeft: depth * 12 }}>{g.icon} {g.title}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-semibold">Fecha de inicio</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (error?.field === "dates") setError(null);
                  }}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted-foreground text-xs font-semibold">Fecha fin</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (error?.field === "dates") setError(null);
                  }}
                  aria-invalid={error?.field === "dates"}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setEndDate(s.iso);
                    if (error?.field === "dates") setError(null);
                  }}
                  className="bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Próxima revisión (opcional)</label>
            <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Notas (opcional)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto, motivación, ideas…" className="rounded-xl" />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-destructive bg-destructive/10 rounded-xl px-3 py-2 text-sm font-medium">
            {error.message}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} className="gradient-brand rounded-xl border-0 text-white shadow-soft hover:opacity-90">Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { Pencil, X, Clock, Repeat, FolderKanban, ArrowUpRight, CalendarDays, Link2 } from "lucide-react";
import { cn } from "cn";
import { useTaskStore, categoryById, projectProgress } from "@/lib/store";
import { dependencyOf, isTaskBlocked } from "@/lib/planner";
import { quadrantOf, QUAD_STYLES } from "@/lib/quadrant";
import { deadlineStatus, deadlineLabel, formatDateDisplay, formatDuration, recurrenceLabel, todayISO } from "@/lib/date-utils";
import { SUBTASK_STATUS_LABELS, type Task } from "@/lib/types";

const DEADLINE_STYLES: Record<string, string> = {
  overdue: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  today: "bg-orange-500/10 text-orange-700 border-orange-500/25 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
  soon: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  normal: "bg-muted text-muted-foreground border-transparent",
};
const PLANNED_STYLES = "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30";
const BLOCKED_STYLES = "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30";

function Tag({
  className,
  style,
  compact,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className
      )}
    >
      {children}
    </span>
  );
}

export interface TaskCardProps {
  task: Task;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  style?: React.CSSProperties;
  dragging?: boolean;
  noEdit?: boolean;
  /** Denser padding/typography — used in the weekly planner and kanban columns where cards are narrow. */
  compact?: boolean;
  /** Hide the "📁 parent project" tag — used when the card already sits under a project group header. */
  hideParentTag?: boolean;
  /** Tooltip/aria label for the "x" button (defaults to "Eliminar"). */
  deleteLabel?: string;
  /** When set, the "📁 parent project" tag becomes a shortcut to that project's board. */
  onOpenParent?: () => void;
}

export const TaskCard = React.forwardRef<HTMLDivElement, TaskCardProps & React.HTMLAttributes<HTMLDivElement>>(
  ({ task, onEdit, onDelete, className, style, dragging, noEdit, compact, hideParentTag, deleteLabel, onOpenParent, ...rest }, ref) => {
    const categories = useTaskStore((s) => s.categories);
    const tasks = useTaskStore((s) => s.tasks);
    const toggleSimpleDone = useTaskStore((s) => s.toggleSimpleDone);
    const cycleSubtaskStatus = useTaskStore((s) => s.cycleSubtaskStatus);

    const isProject = task.type === "project";
    const isDone = task.status === "done";
    const category = categoryById(categories, task.category);
    const quad = quadrantOf(task.urgent, task.important);
    const dStatus = deadlineStatus(task.deadline, isDone);
    const parent = task.type === "subtask" ? tasks.find((t) => t.id === task.parentId) : null;
    const progress = isProject ? projectProgress(tasks, task.id) : null;
    const plannedLate = !!task.plannedDate && !isDone && task.plannedDate < todayISO();
    const dependency = dependencyOf(tasks, task);
    const blocked = isTaskBlocked(tasks, task);

    return (
      // Entry animation is a CSS slide only — no opacity keyframe — so a card can never end up invisible if the
      // animation stalls (e.g. background tab). The original card is never transformed while dragging;
      // the DragOverlay is what follows the pointer.
      <div
        ref={ref}
        style={style}
        className={cn(
          "glass group relative rounded-[20px] shadow-soft transition-[box-shadow,opacity] hover:shadow-lg",
          "animate-in slide-in-from-bottom-1 duration-200",
          compact ? "p-2.5" : "p-3",
          dragging && "opacity-40",
          className
        )}
        {...rest}
      >
        {!noEdit && (onEdit || onDelete) && (
          <div className="bg-card/90 absolute top-2 right-2 flex items-center gap-0.5 rounded-full opacity-0 shadow-soft backdrop-blur transition-opacity group-hover:opacity-100">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-full p-1.5"
                aria-label="Editar"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full p-1.5"
                aria-label={deleteLabel ?? "Eliminar"}
                title={deleteLabel ?? "Eliminar"}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex items-start gap-2">
          {task.type === "simple" && (
            <input
              type="checkbox"
              checked={isDone}
              onChange={(e) => {
                e.stopPropagation();
                toggleSimpleDone(task.id, e.target.checked);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn("accent-primary mt-0.5 shrink-0 cursor-pointer", compact ? "size-3.5" : "size-4")}
            />
          )}
          {task.type === "subtask" && (
            <input
              type="checkbox"
              checked={isDone}
              title="Clic para cambiar estado: Por hacer → Delegado → En progreso → Hecho"
              onChange={(e) => {
                e.stopPropagation();
                cycleSubtaskStatus(task.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn("accent-primary mt-0.5 shrink-0 cursor-pointer", compact ? "size-3.5" : "size-4")}
            />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "line-clamp-2 leading-snug font-semibold break-words",
                compact ? "text-[13px]" : "text-sm",
                isDone && "text-muted-foreground line-through"
              )}
            >
              {isProject && <FolderKanban className="mr-1 inline size-3.5 -translate-y-px text-primary" />}
              {task.title}
            </p>
            {task.notes && !compact && <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{task.notes}</p>}
          </div>
        </div>

        {isProject && progress && (
          <div className="mt-2.5">
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="gradient-brand h-full rounded-full transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-[11px]">
              {progress.done}/{progress.total} subtareas · {progress.pct}%
            </p>
          </div>
        )}

        <div className={cn("flex flex-wrap items-center gap-1", compact ? "mt-1.5" : "mt-2.5 gap-1.5")}>
          {category ? (
            <Tag compact={compact} className="border-transparent text-white" style={{ backgroundColor: category.color } as React.CSSProperties}>
              {category.name}
            </Tag>
          ) : (
            <Tag compact={compact} className="bg-muted text-muted-foreground border-transparent">Sin categoría</Tag>
          )}
          <Tag compact={compact} className={QUAD_STYLES[quad.key]}>{quad.label}</Tag>
          {task.type === "subtask" && !isDone && (
            <Tag compact={compact} className="bg-muted text-muted-foreground border-transparent">{SUBTASK_STATUS_LABELS[task.status]}</Tag>
          )}
          {task.plannedDate && (
            <Tag compact={compact} className={plannedLate ? DEADLINE_STYLES.overdue : PLANNED_STYLES}>
              <CalendarDays className="size-3" /> {plannedLate ? "Replanificar" : "Planificada"} · {formatDateDisplay(task.plannedDate)}
            </Tag>
          )}
          {task.deadline && (
            <Tag compact={compact} className={DEADLINE_STYLES[dStatus ?? "normal"]}>{deadlineLabel(task.deadline, dStatus)}</Tag>
          )}
          {dependency && blocked && (
            <Tag compact={compact} className={cn(BLOCKED_STYLES, "max-w-[160px]")}>
              <Link2 className="size-3 shrink-0" />
              <span className="truncate">Depende de: {dependency.title}</span>
            </Tag>
          )}
          {parent && !hideParentTag && (
            onOpenParent ? (
              <button
                type="button"
                title="Ir al proyecto para ver o agregar tareas"
                aria-label={`Ir al proyecto ${parent.title}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenParent();
                }}
                className="max-w-[160px] cursor-pointer rounded-full transition-opacity hover:opacity-75"
              >
                <Tag compact={compact} className="bg-primary/10 text-primary border-transparent">
                  <FolderKanban className="size-3 shrink-0" />
                  <span className="truncate">{parent.title}</span>
                  <ArrowUpRight className="size-3 shrink-0" />
                </Tag>
              </button>
            ) : (
              <Tag compact={compact} className="bg-primary/10 text-primary border-transparent max-w-[140px]">
                <FolderKanban className="size-3 shrink-0" /> <span className="truncate">{parent.title}</span>
              </Tag>
            )
          )}
          {task.timeSpent > 0 && (
            <Tag compact={compact} className="bg-muted text-muted-foreground border-transparent">
              <Clock className="size-3" /> {formatDuration(task.timeSpent)}
            </Tag>
          )}
          {task.recurrence?.freq && !compact && (
            <Tag compact={compact} className="bg-muted text-muted-foreground border-transparent">
              <Repeat className="size-3" /> {recurrenceLabel(task.recurrence)}
            </Tag>
          )}
        </div>
      </div>
    );
  }
);
TaskCard.displayName = "TaskCard";

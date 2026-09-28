"use client";

import { useDraggable } from "@dnd-kit/core";
import { cn } from "cn";
import { TaskCard, type TaskCardProps } from "@/components/task-card";

/**
 * The original card stays in place (dimmed) while dragging; a <DragOverlay> in the parent renders the moving copy.
 * Never apply dnd-kit's `transform` here, or the re-mounted card in the destination column inherits a stale offset.
 */
export function DraggableTaskCard(props: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: props.task.id,
    data: { task: props.task },
  });

  return (
    <TaskCard
      {...props}
      ref={setNodeRef}
      dragging={isDragging}
      style={{ touchAction: "none" }}
      className={cn("cursor-grab active:cursor-grabbing", props.className)}
      {...attributes}
      {...listeners}
    />
  );
}

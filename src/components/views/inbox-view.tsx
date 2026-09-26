"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Inbox as InboxIcon, ListChecks, FolderKanban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskFormModal, type TaskFormMode } from "@/components/task-form-modal";
import { useTaskStore } from "@/lib/store";
import type { Task } from "@/lib/types";

export function InboxView() {
  const tasks = useTaskStore((s) => s.tasks);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const items = tasks.filter((t) => t.inbox).sort((a, b) => a.createdAt - b.createdAt);

  const [choiceFor, setChoiceFor] = React.useState<Task | null>(null);
  const [formState, setFormState] = React.useState<{ mode: TaskFormMode; task: Task } | null>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Inbox</h1>
        <p className="text-muted-foreground mt-1 text-sm">Lo que capturas sin procesar todavía. El objetivo: vaciarlo.</p>
      </div>

      {items.length === 0 ? (
        <div className="glass shadow-soft flex flex-col items-center gap-2 rounded-3xl border-dashed p-14 text-center">
          <InboxIcon className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">Inbox vacío. Usa la captura rápida de arriba para añadir algo.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {items.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="glass shadow-soft flex items-center gap-3 rounded-[20px] p-3.5"
              >
                <p className="flex-1 truncate text-sm font-semibold">{t.title}</p>
                <span className="text-muted-foreground shrink-0 text-[11px]">
                  {new Date(t.createdAt).toLocaleDateString("es-ES")}
                </span>
                <Button size="sm" className="gradient-brand shrink-0 rounded-xl border-0 text-white" onClick={() => setChoiceFor(t)}>
                  Procesar
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive shrink-0 rounded-full" onClick={() => deleteTask(t.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={!!choiceFor} onOpenChange={(v) => !v && setChoiceFor(null)}>
        <DialogContent className="glass shadow-soft rounded-3xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Procesar: &ldquo;{choiceFor?.title}&rdquo;</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground -mt-2 text-sm">¿Qué tipo de elemento es?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-auto flex-col gap-1.5 rounded-2xl py-4"
              onClick={() => {
                if (!choiceFor) return;
                setFormState({ mode: "process-simple", task: choiceFor });
                setChoiceFor(null);
              }}
            >
              <ListChecks className="size-5" />
              Tarea simple
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-1.5 rounded-2xl py-4"
              onClick={() => {
                if (!choiceFor) return;
                setFormState({ mode: "process-project", task: choiceFor });
                setChoiceFor(null);
              }}
            >
              <FolderKanban className="size-5" />
              Proyecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

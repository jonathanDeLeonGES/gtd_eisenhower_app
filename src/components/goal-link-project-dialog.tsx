"use client";

import * as React from "react";
import { FolderKanban, Search, Target } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTaskStore, categoryById } from "@/lib/store";
import { goalPath } from "@/lib/goals";
import type { Goal } from "@/lib/types";

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pick an existing project to link under a goal. Projects already under another goal are shown with a hint. */
export function LinkProjectDialog({
  goal,
  onOpenChange,
}: {
  goal: Goal | null;
  onOpenChange: (v: boolean) => void;
}) {
  const tasks = useTaskStore((s) => s.tasks);
  const goals = useTaskStore((s) => s.goals);
  const categories = useTaskStore((s) => s.categories);
  const setProjectGoal = useTaskStore((s) => s.setProjectGoal);
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (goal) setQuery("");
  }, [goal]);

  const q = normalize(query.trim());
  const candidates = tasks
    .filter((t) => t.type === "project" && t.goalId !== goal?.id)
    .filter((t) => !q || normalize(t.title).includes(q))
    .sort((a, b) => Number(!!a.goalId) - Number(!!b.goalId) || a.title.localeCompare(b.title));

  return (
    <Dialog open={!!goal} onOpenChange={onOpenChange}>
      <DialogContent className="glass shadow-soft max-h-[80vh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular proyecto a «{goal?.title}»</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar proyecto…" className="rounded-xl pl-9" />
        </div>
        {candidates.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No hay proyectos disponibles para vincular.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {candidates.map((p) => {
              const cat = categoryById(categories, p.category);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!goal) return;
                      setProjectGoal(p.id, goal.id);
                      toast.success("Proyecto vinculado", { description: `${p.title} → ${goal.title}` });
                      onOpenChange(false);
                    }}
                    className="hover:bg-muted/60 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors"
                  >
                    <FolderKanban className="text-primary size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.title}</span>
                      {p.goalId && (
                        <span className="text-muted-foreground flex items-center gap-1 truncate text-[11px]">
                          <Target className="size-3 shrink-0" /> Actualmente en: {goalPath(goals, p.goalId)}
                        </span>
                      )}
                    </span>
                    {cat && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: cat.color }}>
                        {cat.name}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

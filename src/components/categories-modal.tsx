"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/lib/store";

export function CategoriesModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const categories = useTaskStore((s) => s.categories);
  const addCategory = useTaskStore((s) => s.addCategory);
  const updateCategory = useTaskStore((s) => s.updateCategory);
  const deleteCategory = useTaskStore((s) => s.deleteCategory);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#8b5cf6");

  function handleAdd() {
    if (!newName.trim()) return;
    addCategory(newName, newColor);
    setNewName("");
    setNewColor("#8b5cf6");
  }

  function handleDelete(id: string) {
    const ok = deleteCategory(id);
    if (!ok) toast.error("No puedes eliminar una categoría en uso. Reasigna esas tareas primero.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass shadow-soft rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Categorías</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/40 p-2">
              <input
                type="color"
                value={c.color}
                onChange={(e) => updateCategory(c.id, { color: e.target.value })}
                className="size-8 shrink-0 cursor-pointer rounded-full border border-border/60 bg-transparent p-0"
              />
              <Input
                value={c.name}
                onChange={(e) => updateCategory(c.id, { name: e.target.value })}
                className="h-9 flex-1 rounded-xl border-transparent bg-transparent focus-visible:border-border"
              />
              <Button variant="ghost" size="icon" className="text-destructive shrink-0 rounded-full" onClick={() => handleDelete(c.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="size-8 shrink-0 cursor-pointer rounded-full border border-border/60 bg-transparent p-0"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nueva categoría…"
            className="h-9 flex-1 rounded-xl"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} size="icon" className="gradient-brand shrink-0 rounded-xl border-0 text-white">
            <Plus className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

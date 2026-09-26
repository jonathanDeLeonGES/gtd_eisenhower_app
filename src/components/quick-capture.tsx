"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/lib/store";

export function QuickCapture() {
  const [value, setValue] = useState("");
  const addInboxCapture = useTaskStore((s) => s.addInboxCapture);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = value.trim();
    if (!title) return;
    addInboxCapture(title);
    setValue("");
    toast.success("Capturado en el inbox", { description: title });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Captura rápida: escribe cualquier tarea y pulsa Enter…"
        className="h-10 flex-1 rounded-2xl border-border/60 bg-background/40 focus-visible:ring-primary/40"
      />
      <Button type="submit" className="gradient-brand h-10 shrink-0 gap-1.5 rounded-2xl border-0 text-white shadow-soft hover:opacity-90">
        <Plus className="size-4" />
        Capturar
      </Button>
    </form>
  );
}

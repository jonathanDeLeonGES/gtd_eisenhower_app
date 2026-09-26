"use client";

import { useRef } from "react";
import { Download, Upload, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaskStore } from "@/lib/store";
import { todayISO } from "@/lib/date-utils";

export function DataMenu() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importState = useTaskStore((s) => s.importState);

  function handleExport() {
    const state = useTaskStore.getState();
    const data = {
      categories: state.categories,
      tasks: state.tasks,
      timeLog: state.timeLog,
      pomodoroSettings: state.pomodoroSettings,
      activeTimer: state.activeTimer,
      selectedProjectId: state.selectedProjectId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gtd-eisenhower-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Datos exportados");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!confirm("Esto reemplazará todos los datos actuales con el archivo importado. ¿Continuar?")) return;
        const ok = importState(parsed);
        if (ok) toast.success("Datos importados correctamente");
        else toast.error("El archivo no tiene un formato válido");
      } catch {
        toast.error("No se pudo leer el archivo JSON");
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Datos">
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="rounded-2xl">
          <DropdownMenuItem onClick={handleExport} className="gap-2">
            <Download className="size-4" /> Exportar datos (JSON)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick} className="gap-2">
            <Upload className="size-4" /> Importar datos (JSON)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
    </>
  );
}

"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Play, Pause, Square, SkipForward, Timer as TimerIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTaskStore, categoryById } from "@/lib/store";
import { formatDuration, formatHMS, mondayOf, todayISO, dateToISO } from "@/lib/date-utils";
import type { PomodoroSettings } from "@/lib/types";

function useLiveTick(active: boolean) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [active]);
}

export function TimersView() {
  const tasks = useTaskStore((s) => s.tasks);
  const categories = useTaskStore((s) => s.categories);
  const timeLog = useTaskStore((s) => s.timeLog);
  const activeTimer = useTaskStore((s) => s.activeTimer);
  const pomodoroSettings = useTaskStore((s) => s.pomodoroSettings);
  const savePomodoroSettings = useTaskStore((s) => s.savePomodoroSettings);

  const startStopwatch = useTaskStore((s) => s.startStopwatch);
  const pauseStopwatch = useTaskStore((s) => s.pauseStopwatch);
  const resumeStopwatch = useTaskStore((s) => s.resumeStopwatch);
  const stopStopwatch = useTaskStore((s) => s.stopStopwatch);
  const startPomodoro = useTaskStore((s) => s.startPomodoro);
  const pausePomodoro = useTaskStore((s) => s.pausePomodoro);
  const resumePomodoro = useTaskStore((s) => s.resumePomodoro);
  const stopActiveTimer = useTaskStore((s) => s.stopActiveTimer);
  const skipPomoPhase = useTaskStore((s) => s.skipPomoPhase);

  useLiveTick(!!activeTimer?.running);

  const options = tasks.filter((t) => !t.inbox && t.status !== "done");
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [preferredKind, setPreferredKind] = React.useState<"stopwatch" | "pomodoro">("stopwatch");

  React.useEffect(() => {
    if (!selectedId && options.length > 0) setSelectedId(options[0].id);
  }, [options, selectedId]);

  React.useEffect(() => {
    if (activeTimer) setSelectedId(activeTimer.taskId);
  }, [activeTimer?.taskId]);

  const selectedTask = tasks.find((t) => t.id === selectedId) ?? null;
  const selectedCategory = selectedTask ? categoryById(categories, selectedTask.category) : null;
  const isThisActive = !!activeTimer && activeTimer.taskId === selectedId;
  const kind = isThisActive ? activeTimer!.kind : preferredKind;

  let displayMs = 0;
  let phaseLabel = "";
  if (isThisActive && activeTimer!.kind === "stopwatch") {
    const at = activeTimer!;
    displayMs = at.elapsedMs + (at.running ? Date.now() - at.startTimestamp : 0);
  } else if (isThisActive && activeTimer!.kind === "pomodoro") {
    const at = activeTimer!;
    displayMs = at.running ? Math.max(0, at.remainingMs - (Date.now() - at.startTimestamp)) : at.remainingMs;
    phaseLabel = at.phase === "work" ? "Enfoque" : at.phase === "short" ? "Descanso corto" : "Descanso largo";
  } else if (kind === "pomodoro") {
    displayMs = pomodoroSettings.work * 60 * 1000;
    phaseLabel = "Enfoque";
  }

  const projectGroups = options
    .filter((o) => o.type === "project")
    .map((p) => ({ project: p, subtasks: options.filter((o) => o.type === "subtask" && o.parentId === p.id) }));
  const groupedProjectIds = new Set(projectGroups.map((g) => g.project.id));
  const simpleTasks = options.filter((o) => o.type === "simple");
  const orphanSubtasks = options.filter((o) => o.type === "subtask" && !groupedProjectIds.has(o.parentId ?? ""));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Timers</h1>
        <p className="text-muted-foreground mt-1 text-sm">Cronómetro por tarea y modo Pomodoro.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass shadow-soft rounded-[20px] p-5">
          <h3 className="mb-4 text-sm font-semibold">Timer de tarea</h3>

          {activeTimer && !isThisActive && (
            <div className="bg-primary/10 border-primary/20 text-primary mb-4 flex items-center justify-between rounded-2xl border px-3 py-2 text-xs">
              <span>
                Timer activo en <strong>{tasks.find((t) => t.id === activeTimer.taskId)?.title ?? "—"}</strong> (
                {activeTimer.kind === "pomodoro" ? "Pomodoro" : "Cronómetro"})
              </span>
              <Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => setSelectedId(activeTimer.taskId)}>
                Ir
              </Button>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs font-semibold">Tarea</label>
            <Select value={selectedId} onValueChange={(v) => setSelectedId(v ?? "")} disabled={options.length === 0}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="No hay tareas disponibles">
                  {(v: string) => {
                    const o = options.find((o) => o.id === v);
                    if (!o) return "No hay tareas disponibles";
                    return `${o.type === "project" ? "📁 " : o.type === "subtask" ? "↳ " : ""}${o.title}`;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projectGroups.map((g) => (
                  <SelectGroup key={g.project.id}>
                    <SelectLabel>📁 {g.project.title}</SelectLabel>
                    <SelectItem value={g.project.id}>{g.project.title}</SelectItem>
                    {g.subtasks.map((s) => (
                      <SelectItem key={s.id} value={s.id}>↳ {s.title}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
                {simpleTasks.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Tareas simples</SelectLabel>
                    {simpleTasks.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {orphanSubtasks.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Otras subtareas</SelectLabel>
                    {orphanSubtasks.map((s) => (
                      <SelectItem key={s.id} value={s.id}>↳ {s.title}</SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {selectedTask && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-muted-foreground text-[11px]">Categoría:</span>
                {selectedCategory ? (
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white" style={{ backgroundColor: selectedCategory.color }}>
                    {selectedCategory.name}
                  </span>
                ) : (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10.5px] font-semibold">Sin categoría</span>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              disabled={isThisActive}
              onClick={() => setPreferredKind("stopwatch")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
                kind === "stopwatch" ? "gradient-brand border-0 text-white" : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              Cronómetro
            </button>
            <button
              disabled={isThisActive}
              onClick={() => setPreferredKind("pomodoro")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
                kind === "pomodoro" ? "gradient-brand border-0 text-white" : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              Pomodoro
            </button>
          </div>

          {phaseLabel && (
            <p className="text-muted-foreground mt-4 text-center text-xs font-bold tracking-widest uppercase">{phaseLabel}</p>
          )}
          <motion.p
            key={isThisActive && activeTimer!.kind === "pomodoro" ? activeTimer!.phase : "sw"}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-gradient-brand py-3 text-center text-5xl font-bold tabular-nums"
          >
            {formatHMS(displayMs)}
          </motion.p>
          {isThisActive && activeTimer!.kind === "pomodoro" && (
            <p className="text-muted-foreground mb-2 text-center text-xs">
              🍅 {selectedTask?.pomodorosCompleted ?? 0} pomodoros completados
            </p>
          )}

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {kind === "stopwatch" ? (
              isThisActive ? (
                <>
                  {activeTimer!.running ? (
                    <Button variant="outline" className="gap-1.5 rounded-xl" onClick={pauseStopwatch}><Pause className="size-4" /> Pausar</Button>
                  ) : (
                    <Button className="gradient-brand gap-1.5 rounded-xl border-0 text-white" onClick={resumeStopwatch}><Play className="size-4" /> Reanudar</Button>
                  )}
                  <Button variant="outline" className="text-destructive gap-1.5 rounded-xl" onClick={stopStopwatch}><Square className="size-4" /> Detener</Button>
                </>
              ) : (
                <Button disabled={!selectedId} className="gradient-brand gap-1.5 rounded-xl border-0 text-white shadow-soft" onClick={() => startStopwatch(selectedId)}>
                  <Play className="size-4" /> Iniciar cronómetro
                </Button>
              )
            ) : isThisActive ? (
              <>
                {activeTimer!.running ? (
                  <Button variant="outline" className="gap-1.5 rounded-xl" onClick={pausePomodoro}><Pause className="size-4" /> Pausar</Button>
                ) : (
                  <Button className="gradient-brand gap-1.5 rounded-xl border-0 text-white" onClick={resumePomodoro}><Play className="size-4" /> Reanudar</Button>
                )}
                <Button variant="outline" className="gap-1.5 rounded-xl" onClick={skipPomoPhase}><SkipForward className="size-4" /> Saltar fase</Button>
                <Button variant="outline" className="text-destructive gap-1.5 rounded-xl" onClick={stopActiveTimer}><Square className="size-4" /> Detener</Button>
              </>
            ) : (
              <Button disabled={!selectedId} className="gradient-brand gap-1.5 rounded-xl border-0 text-white shadow-soft" onClick={() => startPomodoro(selectedId)}>
                <TimerIcon className="size-4" /> Iniciar pomodoro
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <PomodoroSettingsPanel settings={pomodoroSettings} onSave={savePomodoroSettings} />
          <SummaryPanel timeLog={timeLog} categories={categories} />
        </div>
      </div>
    </div>
  );
}

function PomodoroSettingsPanel({ settings, onSave }: { settings: PomodoroSettings; onSave: (s: PomodoroSettings) => void }) {
  const [work, setWork] = React.useState(settings.work);
  const [shortBreak, setShortBreak] = React.useState(settings.shortBreak);
  const [longBreak, setLongBreak] = React.useState(settings.longBreak);
  const [cycles, setCycles] = React.useState(settings.cycles);

  return (
    <div className="glass shadow-soft rounded-[20px] p-5">
      <h3 className="mb-4 text-sm font-semibold">Ajustes de Pomodoro</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Trabajo (min)" value={work} onChange={setWork} />
        <Field label="Descanso corto (min)" value={shortBreak} onChange={setShortBreak} />
        <Field label="Descanso largo (min)" value={longBreak} onChange={setLongBreak} />
        <Field label="Pomodoros p/ descanso largo" value={cycles} onChange={setCycles} />
      </div>
      <Button
        size="sm"
        className="gradient-brand mt-3 rounded-xl border-0 text-white"
        onClick={() =>
          onSave({
            work: Math.max(1, work || 25),
            shortBreak: Math.max(1, shortBreak || 5),
            longBreak: Math.max(1, longBreak || 15),
            cycles: Math.max(1, cycles || 4),
          })
        }
      >
        Guardar ajustes
      </Button>
      <p className="text-muted-foreground mt-2 text-xs">Los cambios se aplican al próximo pomodoro que inicies.</p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-muted-foreground text-xs font-semibold">{label}</label>
      <Input type="number" min={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="rounded-xl" />
    </div>
  );
}

function SummaryPanel({ timeLog, categories }: { timeLog: { category: string | null; seconds: number; dateISO: string }[]; categories: { id: string; name: string; color: string }[] }) {
  const today = todayISO();
  const monday = dateToISO(mondayOf(new Date()));
  const sunday = (() => {
    const d = mondayOf(new Date());
    d.setDate(d.getDate() + 6);
    return dateToISO(d);
  })();

  const totals: Record<string, { today: number; week: number }> = { _none: { today: 0, week: 0 } };
  categories.forEach((c) => (totals[c.id] = { today: 0, week: 0 }));
  timeLog.forEach((e) => {
    const key = e.category && totals[e.category] ? e.category : "_none";
    if (e.dateISO === today) totals[key].today += e.seconds;
    if (e.dateISO >= monday && e.dateISO <= sunday) totals[key].week += e.seconds;
  });

  let grandToday = 0;
  let grandWeek = 0;
  categories.forEach((c) => {
    grandToday += totals[c.id].today;
    grandWeek += totals[c.id].week;
  });
  grandToday += totals._none.today;
  grandWeek += totals._none.week;

  return (
    <div className="glass shadow-soft rounded-[20px] p-5">
      <h3 className="mb-3 text-sm font-semibold">Resumen de tiempo</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-[11px] tracking-wide uppercase">
            <th className="pb-2 text-left font-semibold">Categoría</th>
            <th className="pb-2 text-left font-semibold">Hoy</th>
            <th className="pb-2 text-left font-semibold">Esta semana</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-border/60 border-t">
              <td className="py-2">
                <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </td>
              <td className="py-2">{formatDuration(totals[c.id].today)}</td>
              <td className="py-2">{formatDuration(totals[c.id].week)}</td>
            </tr>
          ))}
          {(totals._none.today > 0 || totals._none.week > 0) && (
            <tr className="border-border/60 border-t">
              <td className="py-2">
                <span className="bg-muted-foreground mr-2 inline-block size-2.5 rounded-full" />
                Sin categoría
              </td>
              <td className="py-2">{formatDuration(totals._none.today)}</td>
              <td className="py-2">{formatDuration(totals._none.week)}</td>
            </tr>
          )}
          <tr className="border-border/60 border-t font-bold">
            <td className="py-2">Total</td>
            <td className="py-2">{formatDuration(grandToday)}</td>
            <td className="py-2">{formatDuration(grandWeek)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

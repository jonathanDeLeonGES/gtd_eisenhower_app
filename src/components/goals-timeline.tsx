"use client";

import * as React from "react";
import { CalendarRange } from "lucide-react";
import { useTaskStore, categoryById } from "@/lib/store";
import { goalProgress } from "@/lib/goals";
import { dateToISO, formatDateDisplay, isoToLocalDate, todayISO } from "@/lib/date-utils";
import { GOAL_STATUS_LABELS, type Goal } from "@/lib/types";

const DAY_MS = 86400000;
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Gantt-lite: one bar per goal, positioned by its start/end dates. Rows arrive already in tree order. */
export function GoalsTimeline({ rows }: { rows: { goal: Goal; depth: number }[] }) {
  const goals = useTaskStore((s) => s.goals);
  const tasks = useTaskStore((s) => s.tasks);
  const categories = useTaskStore((s) => s.categories);

  const today = isoToLocalDate(todayISO());

  const { min, totalDays, months } = React.useMemo(() => {
    const dates: Date[] = [today];
    for (const { goal } of rows) {
      if (goal.startDate) dates.push(isoToLocalDate(goal.startDate));
      if (goal.endDate) dates.push(isoToLocalDate(goal.endDate));
    }
    const lo = new Date(Math.min(...dates.map((d) => d.getTime())));
    const hi = new Date(Math.max(...dates.map((d) => d.getTime())));
    const start = new Date(lo.getFullYear(), lo.getMonth(), 1);
    let end = new Date(hi.getFullYear(), hi.getMonth() + 1, 0);
    // Always show at least ~4 months so a single short goal doesn't fill the whole width.
    const minEnd = new Date(start.getFullYear(), start.getMonth() + 4, 0);
    if (end < minEnd) end = minEnd;
    const total = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
    const ms: { label: string; left: number; width: number; year: number }[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const mStart = new Date(cur);
      const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const left = ((mStart.getTime() - start.getTime()) / DAY_MS / total) * 100;
      const days = Math.round((mEnd.getTime() - mStart.getTime()) / DAY_MS) + 1;
      ms.push({ label: MONTHS[cur.getMonth()], year: cur.getFullYear(), left, width: (days / total) * 100 });
      cur.setMonth(cur.getMonth() + 1);
    }
    return { min: start, totalDays: total, months: ms };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const pos = (d: Date) => ((d.getTime() - min.getTime()) / DAY_MS / totalDays) * 100;
  const todayPct = pos(today);

  if (rows.length === 0) {
    return (
      <div className="glass shadow-soft flex flex-col items-center gap-2 rounded-3xl p-14 text-center">
        <CalendarRange className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm">No hay metas para mostrar en la línea de tiempo.</p>
      </div>
    );
  }

  return (
    <div className="glass shadow-soft overflow-x-auto rounded-3xl">
      <div className="min-w-[900px]">
        <div className="bg-muted/40 flex border-b">
          <div className="text-muted-foreground w-[260px] shrink-0 px-4 py-2 text-[11px] font-bold tracking-wide uppercase">Meta</div>
          <div className="relative h-9 flex-1">
            {months.map((m, i) => (
              <div
                key={`${m.year}-${m.label}-${i}`}
                className="text-muted-foreground absolute inset-y-0 flex flex-col justify-center border-l px-1.5 text-[10.5px] leading-tight font-semibold"
                style={{ left: `${m.left}%`, width: `${m.width}%` }}
              >
                {m.label}
                {(m.label === "Ene" || i === 0) && <span className="text-[9px] font-medium opacity-70">{m.year}</span>}
              </div>
            ))}
          </div>
        </div>

        {rows.map(({ goal, depth }) => {
          const cat = categoryById(categories, goal.category);
          const color = cat?.color ?? "#6366f1";
          const startD = goal.startDate ?? goal.endDate;
          const endD = goal.endDate ?? goal.startDate;
          const pct = goalProgress(goals, tasks, goal.id);
          const muted = goal.status === "dropped";
          let bar: React.ReactNode = <span className="text-muted-foreground pl-3 text-[11px] italic">Sin fechas</span>;
          if (startD && endD) {
            const left = pos(isoToLocalDate(startD));
            // End date is inclusive, so the bar covers a whole final day.
            const width = Math.max(((isoToLocalDate(endD).getTime() - isoToLocalDate(startD).getTime()) / DAY_MS + 1) / totalDays * 100, 0.6);
            bar = (
              <div
                className="absolute top-1/2 h-5 -translate-y-1/2 overflow-hidden rounded-full"
                style={{ left: `${left}%`, width: `${width}%`, backgroundColor: `${color}33`, border: `1px solid ${color}88`, opacity: muted ? 0.45 : 1 }}
                title={`${goal.title} · ${formatDateDisplay(startD)} → ${formatDateDisplay(endD)} · ${pct}% · ${GOAL_STATUS_LABELS[goal.status]}`}
              >
                <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
            );
          }
          return (
            <div key={goal.id} className="flex border-b last:border-b-0">
              <div className="flex w-[260px] shrink-0 items-center gap-1.5 px-4 py-2" style={{ paddingLeft: 16 + depth * 16 }}>
                <span className="shrink-0 text-sm">{goal.icon}</span>
                <span className={muted ? "text-muted-foreground truncate text-sm line-through" : "truncate text-sm font-medium"} title={goal.title}>
                  {goal.title}
                </span>
              </div>
              <div className="relative h-10 flex-1">
                {months.map((m, i) => (
                  <span key={i} aria-hidden className="absolute inset-y-0 border-l opacity-60" style={{ left: `${m.left}%` }} />
                ))}
                <span aria-hidden className="bg-primary/60 absolute inset-y-0 w-px" style={{ left: `${todayPct}%` }} title={`Hoy · ${dateToISO(today)}`} />
                {bar}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

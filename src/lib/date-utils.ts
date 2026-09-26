import type { Recurrence, RecurrenceFreq } from "./types";

export function todayISO(): string {
  return dateToISO(new Date());
}

export function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateDisplay(iso: string | null): string {
  if (!iso) return "";
  const d = isoToLocalDate(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7; // 0=Lunes .. 6=Domingo
}

export function mondayOf(d: Date): Date {
  const wd = isoWeekday(d);
  const m = new Date(d);
  m.setDate(d.getDate() - wd);
  m.setHours(0, 0, 0, 0);
  return m;
}

export type DeadlineStatus = "overdue" | "today" | "soon" | "normal" | null;

export function deadlineStatus(iso: string | null, isDone: boolean): DeadlineStatus {
  if (!iso || isDone) return null;
  const today = isoToLocalDate(todayISO());
  const dl = isoToLocalDate(iso);
  const diffDays = Math.round((dl.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays === 0) return "today";
  if (diffDays <= 3) return "soon";
  return "normal";
}

export function deadlineLabel(iso: string, status: DeadlineStatus): string {
  if (status === "overdue") return "Vencida · " + formatDateDisplay(iso);
  if (status === "today") return "Vence hoy";
  if (status === "soon") return "Vence pronto · " + formatDateDisplay(iso);
  return formatDateDisplay(iso);
}

const RECUR_UNIT: Record<RecurrenceFreq, [string, string]> = {
  daily: ["día", "días"],
  weekly: ["semana", "semanas"],
  monthly: ["mes", "meses"],
};

export function recurrenceLabel(rec: Recurrence | null | undefined): string {
  if (!rec || !rec.freq) return "";
  const interval = Math.max(1, rec.interval || 1);
  if (interval === 1) {
    return rec.freq === "daily" ? "Diaria" : rec.freq === "weekly" ? "Semanal" : "Mensual";
  }
  const [, plural] = RECUR_UNIT[rec.freq] || ["", ""];
  return `Cada ${interval} ${plural}`;
}

export function computeNextDeadline(deadlineISO: string | null, freq: RecurrenceFreq, interval: number): string {
  const clampedInterval = Math.max(1, interval || 1);
  const d = isoToLocalDate(deadlineISO || todayISO());
  let guard = 0;
  do {
    if (freq === "daily") d.setDate(d.getDate() + clampedInterval);
    else if (freq === "weekly") d.setDate(d.getDate() + 7 * clampedInterval);
    else if (freq === "monthly") d.setMonth(d.getMonth() + clampedInterval);
    else d.setDate(d.getDate() + 1);
    guard++;
  } while (dateToISO(d) < todayISO() && guard < 1000);
  return dateToISO(d);
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

export function formatHMS(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

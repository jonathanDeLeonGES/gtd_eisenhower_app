export interface QuadrantInfo {
  key: "q1" | "q2" | "q3" | "q4";
  label: string;
  actionHint: string;
}

export function quadrantOf(urgent: boolean, important: boolean): QuadrantInfo {
  if (urgent && important) return { key: "q1", label: "Hazlo ya", actionHint: "Urgente + importante" };
  if (!urgent && important) return { key: "q2", label: "Agéndalo", actionHint: "Importante" };
  if (urgent && !important) return { key: "q3", label: "Delega / minimiza", actionHint: "Urgente" };
  return { key: "q4", label: "Cuestiónalo", actionHint: "Ninguno" };
}

export const QUAD_ORDER: Record<string, number> = { q1: 0, q2: 1, q3: 2, q4: 3 };

// Tailwind class groups per quadrant — used by badges across the app. Each includes a
// light-mode-legible variant plus a dark: override, since badge colors must work in both themes.
export const QUAD_STYLES: Record<QuadrantInfo["key"], string> = {
  q1: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  q2: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  q3: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  q4: "bg-zinc-500/10 text-zinc-600 border-zinc-500/25 dark:bg-zinc-500/15 dark:text-zinc-300 dark:border-zinc-500/30",
};

"use client";

import { useEffect } from "react";
import { useTaskStore } from "@/lib/store";

/** Advances the active pomodoro timer app-wide, independent of which page is mounted. */
export function useTimerTick() {
  useEffect(() => {
    const interval = setInterval(() => {
      useTaskStore.getState().tick();
    }, 500);
    return () => clearInterval(interval);
  }, []);
}

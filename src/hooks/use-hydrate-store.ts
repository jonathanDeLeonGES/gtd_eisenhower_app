"use client";

import { useEffect } from "react";
import { useTaskStore } from "@/lib/store";

/** Manually rehydrates the persisted zustand store on the client, avoiding SSR/client markup mismatches. */
export function useHydrateStore() {
  useEffect(() => {
    (async () => {
      await useTaskStore.persist.rehydrate();
      useTaskStore.getState().setHasHydrated(true);
    })();
  }, []);
}

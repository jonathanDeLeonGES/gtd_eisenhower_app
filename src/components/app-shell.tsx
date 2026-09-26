"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/sidebar-nav";
import { QuickCapture } from "@/components/quick-capture";
import { ThemeToggle } from "@/components/theme-toggle";
import { DataMenu } from "@/components/data-menu";
import { CategoriesModal } from "@/components/categories-modal";
import { useHydrateStore } from "@/hooks/use-hydrate-store";
import { useTimerTick } from "@/hooks/use-timer-tick";

export function AppShell({ children }: { children: React.ReactNode }) {
  useHydrateStore();
  useTimerTick();
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[1920px] gap-4 p-4">
      <SidebarNav onOpenCategories={() => setCategoriesOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="glass shadow-soft sticky top-4 z-20 flex items-center gap-3 rounded-3xl p-3">
          <QuickCapture />
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <DataMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1 pb-8">{children}</main>
      </div>
      <CategoriesModal open={categoriesOpen} onOpenChange={setCategoriesOpen} />
    </div>
  );
}

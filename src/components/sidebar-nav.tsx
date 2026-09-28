"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Inbox, CalendarDays, KanbanSquare, Timer, Target, Sparkles, Tags, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTaskStore } from "@/lib/store";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/planificacion", label: "Planificación", icon: CalendarDays },
  { href: "/metas", label: "Metas", icon: Target },
  { href: "/proyectos", label: "Proyectos", icon: KanbanSquare },
  { href: "/timers", label: "Timers", icon: Timer },
];

export function SidebarNav({ onOpenCategories }: { onOpenCategories: () => void }) {
  const pathname = usePathname();
  const inboxCount = useTaskStore((s) => s.tasks.filter((t) => t.inbox).length);
  const collapsed = useTaskStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useTaskStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "glass shadow-soft sticky top-4 flex h-[calc(100vh-2rem)] shrink-0 flex-col rounded-3xl p-3 transition-[width] duration-200",
        collapsed ? "w-[68px] items-center" : "w-64 p-4"
      )}
    >
      <div className={cn("mb-6 flex items-center gap-2 pt-1", collapsed ? "justify-center" : "px-2")}>
        <div className="gradient-brand flex size-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-soft">
          <Sparkles className="size-4.5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold tracking-tight">GTD × Eisenhower</p>
            <p className="text-muted-foreground truncate text-[11px] leading-tight">tu día, priorizado</p>
          </div>
        )}
      </div>

      <nav className={cn("flex flex-1 flex-col gap-1", collapsed && "w-full items-center")}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const link = (
            <Link key={item.href} href={item.href} className={cn("relative block", collapsed && "w-11")}>
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="gradient-brand absolute inset-0 rounded-2xl shadow-soft"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span
                className={cn(
                  "relative flex items-center gap-2.5 rounded-2xl text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                  active ? "text-white" : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && item.label}
                {item.href === "/inbox" && inboxCount > 0 && (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                      collapsed ? "absolute -top-1 -right-1" : "ml-auto",
                      active ? "bg-white/25 text-white" : "bg-primary text-primary-foreground"
                    )}
                  >
                    {inboxCount}
                  </span>
                )}
              </span>
            </Link>
          );
          if (!collapsed) return link;
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {collapsed ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" onClick={onOpenCategories} className="rounded-2xl text-foreground/70 hover:bg-muted/60 hover:text-foreground" aria-label="Categorías">
                <Tags className="size-4" />
              </Button>
            }
          />
          <TooltipContent side="right">Categorías</TooltipContent>
        </Tooltip>
      ) : (
        <Button variant="ghost" onClick={onOpenCategories} className="justify-start gap-2.5 rounded-2xl px-3 text-foreground/70 hover:bg-muted/60 hover:text-foreground">
          <Tags className="size-4" />
          Categorías
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className={cn("text-muted-foreground hover:text-foreground mt-1 rounded-2xl", collapsed ? "" : "self-end")}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
      </Button>
    </aside>
  );
}

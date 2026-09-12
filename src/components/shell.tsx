import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  FlaskConical,
  History,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Shield,
} from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUser, useCurrentUserState } from "@/lib/auth/use-current-user";
import { readMeter } from "@/lib/engines/meter";
import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode } from "react";

const NAV = [
  { to: "/", label: "Command", icon: LayoutDashboard },
  { to: "/labs", label: "Labs", icon: FlaskConical },
  { to: "/attest", label: "Attest", icon: Shield },
  { to: "/history", label: "History", icon: History },
  { to: "/console", label: "Console", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isPending } = useCurrentUserState();
  const user = useCurrentUser();
  const [meter, setMeter] = useState({ armed: 0, totalRuns: 0, xai: 0 });
  useEffect(() => {
    setMeter(readMeter());
    const t = setInterval(() => setMeter(readMeter()), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-fg flex flex-col md:flex-row">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <AnvilMark />
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Voltcore</p>
              <p className="font-medium leading-tight">ANVIL</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted font-mono tabular">
            ARMED {meter.armed}/25 · RUNS {meter.totalRuns} · AI {meter.xai}/8
          </p>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = path === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 min-h-11 px-3 rounded-sm text-sm",
                  active
                    ? "bg-raised text-primary"
                    : "text-muted hover:text-fg hover:bg-raised/60",
                )}
              >
                <Icon className="size-4" strokeWidth={1.75} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          {isPending ? (
            <div className="h-8 w-full animate-pulse rounded-sm bg-raised" />
          ) : (
            <div className="text-xs">
              <UserButton />
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface md:hidden">
          <div className="flex items-center gap-2">
            <AnvilMark />
            <span className="font-medium">ANVIL</span>
          </div>
          <Activity className="size-4 text-primary" />
        </header>
        <main className="flex-1 min-h-0 pb-20 md:pb-0">{children}</main>
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-surface/95 backdrop-blur-sm">
          <div className="grid grid-cols-6">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = path === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center justify-center min-h-16 gap-1 text-[10px] uppercase tracking-wider",
                    active ? "text-primary" : "text-muted",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      <span className="sr-only">{user?.displayName ?? "signed in"}</span>
    </div>
  );
}

export function AnvilMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 text-primary", className)}
      aria-hidden="true"
    >
      <rect x="4" y="18" width="24" height="5" rx="1" fill="currentColor" />
      <path d="M8 18 V12 h16 v6" fill="currentColor" opacity="0.85" />
      <rect x="14" y="6" width="4" height="7" fill="currentColor" />
      <path d="M6 24 h20 v2 H6z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

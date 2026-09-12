import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AppShell, AnvilMark } from "./shell";
import type { ReactNode } from "react";

export function Splash() {
  return (
    <main className="min-h-dvh bg-bg text-fg grid place-items-center p-6">
      <div className="flex flex-col items-center gap-3">
        <AnvilMark className="size-10" />
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Voltcore</p>
        <h1 className="text-xl font-medium">ANVIL</h1>
        <p className="text-sm text-muted">Synchronizing session…</p>
      </div>
    </main>
  );
}

export function Authed({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Splash />;
  if (!user) return <RedirectToSignIn />;
  return <AppShell>{children}</AppShell>;
}

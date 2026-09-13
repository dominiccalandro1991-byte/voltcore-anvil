import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { AnvilMark } from "./shell";

/** Full-page sign-in surface. Shown by `/login` and by Authed while unsigned. */
export function LoginCard() {
  return (
    <main className="min-h-dvh bg-bg text-fg grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-xl bg-surface border border-border p-6 space-y-5">
        <div className="flex items-center gap-3">
          <AnvilMark />
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Voltcore</p>
            <h1 className="text-xl font-medium">ANVIL</h1>
          </div>
        </div>
        <p className="text-sm text-muted">
          Sign in to run USSE, VSTE, and bounded live probes. Runs are scoped to your account.
        </p>
        {authEnabled ? (
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                className="w-full min-h-11 rounded-sm border border-border bg-raised px-4 text-sm hover:border-primary"
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Sign-in is disabled.</p>
        )}
        <p className="text-[11px] text-muted">
          Google and X via Grok broker. Live probes cap at 50 VU / 120 s / 1000 req. No heal. No
          trunk write.
        </p>
      </div>
    </main>
  );
}

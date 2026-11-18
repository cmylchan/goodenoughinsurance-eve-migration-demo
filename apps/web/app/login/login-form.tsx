"use client";

import { KeyRoundIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { signIn } from "./actions";

// The two synthetic test users. Their passwords are published in the repository README on
// purpose (see "Named exceptions" there): the data is synthetic and a reviewer needs them.
const DEMO_LOGINS = [
  { username: "ana", password: "quartz-north-amber-90", role: "Claims adjuster", can: "Sees policies 1042 and 1043. Can't approve." },
  { username: "sam", password: "slate-harbor-quartz-55", role: "Claims supervisor", can: "Sees every policy. Can approve." },
] as const;

export function LoginForm() {
  const [error, action, pending] = useActionState(signIn, undefined);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="flex w-full flex-col gap-6">
      <form action={action} className="flex w-full flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold text-foreground">Username</span>
          <Input
            autoCapitalize="none"
            autoComplete="username"
            autoFocus
            className="h-11"
            name="username"
            onChange={(event) => setUsername(event.currentTarget.value)}
            required
            value={username}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold text-foreground">Password</span>
          <Input
            autoComplete="current-password"
            className="h-11"
            name="password"
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <button className="cta mt-3 h-12 w-full text-sm disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* A helper, not part of the sign-in itself: set apart with a dashed outline and its own label. */}
      <section aria-labelledby="demo-logins" className="rounded-xl border border-brand/30 border-dashed bg-brand-soft/60 p-4">
        <h2 className="flex items-center gap-1.5 font-bold text-brand text-xs uppercase tracking-[0.12em]" id="demo-logins">
          <KeyRoundIcon className="size-3.5" /> Demo logins
        </h2>
        <p className="mt-1 text-muted-foreground text-xs">
          This is a demo with synthetic data, so the two test users are listed here. Pick one to fill in the form.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {DEMO_LOGINS.map((login) => (
            <li className="flex items-center gap-3 rounded-lg border bg-background p-3" key={login.username}>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-bold">{login.role}</span>
                  <span className="text-muted-foreground"> · {login.can}</span>
                </p>
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                  <dt className="text-muted-foreground">User</dt>
                  <dd className="select-all font-mono">{login.username}</dd>
                  <dt className="text-muted-foreground">Password</dt>
                  <dd className="select-all break-all font-mono">{login.password}</dd>
                </dl>
              </div>
              <button
                aria-label={`Fill in the form as ${login.username}`}
                className="shrink-0 rounded-[5px] border border-brand/40 bg-background px-3 py-1.5 font-bold text-brand text-xs transition-colors hover:bg-brand hover:text-brand-foreground"
                onClick={() => {
                  setUsername(login.username);
                  setPassword(login.password);
                }}
                type="button"
              >
                Use
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

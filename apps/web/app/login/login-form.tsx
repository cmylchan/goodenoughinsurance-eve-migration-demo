"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { signIn } from "./actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold text-foreground">Username</span>
        <Input className="h-11" autoCapitalize="none" autoComplete="username" autoFocus name="username" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-bold text-foreground">Password</span>
        <Input className="h-11" autoComplete="current-password" name="password" required type="password" />
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
  );
}

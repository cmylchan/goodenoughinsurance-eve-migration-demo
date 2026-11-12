"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "./actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Username</span>
        <Input autoCapitalize="none" autoComplete="username" autoFocus name="username" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Password</span>
        <Input autoComplete="current-password" name="password" required type="password" />
      </label>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="mt-2" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

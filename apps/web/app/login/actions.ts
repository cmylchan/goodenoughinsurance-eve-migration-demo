"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, issueSession, SESSION_COOKIE } from "@lib/identity";

export async function signIn(_previous: string | undefined, form: FormData): Promise<string | undefined> {
  const user = checkPassword(String(form.get("username") ?? "").trim().toLowerCase(), String(form.get("password") ?? ""));
  if (!user) return "Unknown user or wrong password.";

  const { token, maxAge } = issueSession(user);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  redirect("/");
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

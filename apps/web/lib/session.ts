import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SESSION_COOKIE, verifySession, type DirectoryUser } from "@lib/identity";

/** What the browser may know about the signed-in user. */
export interface Viewer {
  readonly id: string;
  readonly displayName: string;
  readonly title: string;
  readonly canApprove: boolean;
}

/** Read once per request, however many streamed pieces of the page ask. */
export const currentUser = cache(async (): Promise<DirectoryUser | undefined> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  // The expiry check reads the clock; this keeps it at request time, never in a prerender.
  await connection();
  return verifySession(token);
});

/** For pages: the signed-in viewer, or a redirect to the login page. */
export async function requireViewer(): Promise<Viewer> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return { id: user.id, displayName: user.displayName, title: user.title, canApprove: user.canApprove };
}

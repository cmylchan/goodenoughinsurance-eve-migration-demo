import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type DirectoryUser } from "@lib/identity";

/** What the browser may know about the signed-in user. */
export interface Viewer {
  readonly id: string;
  readonly displayName: string;
  readonly title: string;
  readonly canApprove: boolean;
}

export async function currentUser(): Promise<DirectoryUser | undefined> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** For pages: the signed-in viewer, or a redirect to the login page. */
export async function requireViewer(): Promise<Viewer> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return { id: user.id, displayName: user.displayName, title: user.title, canApprove: user.canApprove };
}

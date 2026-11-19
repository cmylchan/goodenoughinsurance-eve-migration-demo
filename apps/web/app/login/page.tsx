import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/app/_components/logo";
import { NeighborhoodScene } from "@/app/_components/neighborhood-scene";
import { currentUser } from "@/lib/session";
import { AnnounceSignedOut } from "@/app/_components/session-guard";
import { LoginForm } from "./login-form";

// Fully prerendered: the form ships as static HTML. Only the "already signed in?" check reads the
// cookie, in its own Suspense boundary, and it renders nothing.
export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-background px-4 pt-[8vh] pb-[240px] text-foreground md:pb-[320px]">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      <AnnounceSignedOut />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        <Logo />
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-3xl leading-tight md:text-[40px]">Claims operations portal</h1>
          <p className="text-muted-foreground">Sign in to the Claims Assistant</p>
        </div>
        <div className="card-float w-full p-6 sm:p-8">
          <LoginForm />
        </div>
        <p className="text-center text-muted-foreground text-xs">
          Demo environment with synthetic data. This login stands in for the corporate identity provider. To see both
          roles at once, keep them in separate cookie stores: one normal window and one private window, or two
          browsers. Private windows share one sign-in with each other.
        </p>
      </div>
      {/* Pinned to the viewport, not the page, so the scene stays in view however tall the form runs. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 h-[220px] md:h-[300px]">
        <NeighborhoodScene />
      </div>
    </main>
  );
}

async function RedirectIfSignedIn() {
  if (await currentUser()) redirect("/");
  return null;
}

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-medium text-2xl tracking-tight">GoodEnough Insurance</h1>
          <p className="text-muted-foreground text-sm">Claims Assistant · sign in</p>
        </div>
        <LoginForm />
        <p className="text-muted-foreground text-xs">
          Demo environment with synthetic data. This login stands in for the corporate identity provider; test
          users are listed in the repository README.
        </p>
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { PasswordForm } from "@/components/PasswordForm";

export const metadata = {
  title: "Sign in · Audiobook Player",
};

type SearchParams = Promise<{ redirectTo?: string; error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { redirectTo, error } = await searchParams;
  if (await isAuthenticated()) {
    redirect(redirectTo || "/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/80 p-8 shadow-xl backdrop-blur">
        <h1 className="text-2xl font-semibold text-foreground">
          Audiobook Player
        </h1>
        <p className="mt-2 text-sm text-muted">
          Enter the password to continue.
        </p>

        {error ? (
          <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {decodeURIComponent(error)}
          </div>
        ) : null}

        <div className="mt-8">
          <PasswordForm redirectTo={redirectTo} />
        </div>
      </div>
    </div>
  );
}

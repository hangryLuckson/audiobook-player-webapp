import { signIn } from "@/app/auth-actions";

export function PasswordForm({ redirectTo }: { redirectTo?: string }) {
  return (
    <form action={signIn} className="space-y-3">
      <input
        type="hidden"
        name="redirectTo"
        value={redirectTo || "/"}
      />
      <label
        htmlFor="password"
        className="block text-sm font-medium text-foreground"
      >
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        autoFocus
        className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40"
      />
      <button
        type="submit"
        className="flex w-full items-center justify-center rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-400"
      >
        Sign in
      </button>
    </form>
  );
}

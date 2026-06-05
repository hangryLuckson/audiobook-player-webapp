import { signOut } from "@/app/auth-actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition hover:bg-surface-elevated"
      >
        Sign out
      </button>
    </form>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { listLibrary } from "@/lib/audiobooks-server";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function originFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function LibraryPage() {
  if (!(await isAuthenticated())) {
    redirect("/login?redirectTo=/library");
  }
  const entries = await listLibrary();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-sm font-semibold tracking-tight text-muted">
          Audiobook Player
        </span>
        <SignOutButton />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Library</h1>
            <p className="mt-1 text-sm text-muted">
              {entries.length === 0
                ? "Your library is empty."
                : `${entries.length} ${entries.length === 1 ? "audiobook" : "audiobooks"}`}
            </p>
          </div>
          <Link
            href="/add"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
          >
            + Add audiobook
          </Link>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center">
            <p className="text-sm text-muted">
              No audiobooks yet. Add one to get started.
            </p>
            <Link
              href="/add"
              className="mt-4 inline-block rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-400"
            >
              + Add an audiobook
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const totalChapters = entry.playlist.chapters.length;
              const progressPercent =
                entry.chapterIndex >= totalChapters
                  ? 100
                  : Math.min(
                      100,
                      Math.round(
                        ((entry.chapterIndex + (entry.timestamp > 0 ? 1 : 0)) /
                          totalChapters) *
                          100,
                      ),
                    );
              return (
                <li key={entry.playlist.sourceUrl}>
                  <Link
                    href={`/player?url=${encodeURIComponent(entry.playlist.sourceUrl)}`}
                    className="flex items-center gap-4 rounded-xl border border-border bg-surface/60 p-4 transition hover:bg-surface-elevated"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 text-white shadow">
                      <PlayIcon />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold text-foreground">
                        {entry.playlist.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {originFor(entry.playlist.sourceUrl)} ·{" "}
                        {totalChapters} {totalChapters === 1 ? "chapter" : "chapters"}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
                          <div
                            className="absolute inset-y-0 left-0 bg-brand-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted">
                          {entry.chapterIndex + 1}/{totalChapters} · {formatTime(entry.timestamp)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {entry.completed
                          ? "Finished"
                          : entry.progressUpdatedAt
                            ? `Last played ${formatRelative(entry.progressUpdatedAt)}`
                            : "Not started"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

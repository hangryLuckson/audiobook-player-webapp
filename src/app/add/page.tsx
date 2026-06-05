"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { upsertAudiobookAction } from "@/app/library-actions";

export default function AddPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/extract-mp3", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = (await res.json()) as
        | { playlist: import("@/types").AudiobookPlaylist }
        | { error: string };
      if (!res.ok || "error" in data) {
        const message = "error" in data ? data.error : "Could not load audio.";
        throw new Error(message);
      }
      try {
        await upsertAudiobookAction(data.playlist);
      } catch (saveErr) {
        console.error("Failed to save to library", saveErr);
      }
      router.push(`/player?url=${encodeURIComponent(data.playlist.sourceUrl)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link
          href="/library"
          className="flex items-center gap-2 text-sm text-muted transition hover:text-foreground"
        >
          <span aria-hidden>←</span> Library
        </Link>
        <SignOutButton />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="rounded-2xl border border-border bg-surface/70 p-8 shadow-2xl backdrop-blur">
            <h1 className="text-3xl font-semibold tracking-tight">
              Add an audiobook
            </h1>
            <p className="mt-2 text-sm text-muted">
              Paste the URL of an audiobook page or M3U playlist. We&apos;ll
              fetch the chapters and save it to your library.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-3">
              <label
                htmlFor="audiobook-url"
                className="block text-sm font-medium text-foreground"
              >
                Audiobook URL
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="audiobook-url"
                  name="url"
                  type="url"
                  required
                  inputMode="url"
                  autoComplete="off"
                  autoFocus
                  placeholder="https://example.com/audiobooks/the-book"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  className="flex-1 rounded-md border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40"
                />
                <button
                  type="submit"
                  disabled={loading || !url.trim()}
                  className="inline-flex items-center justify-center rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Loading..." : "Add"}
                </button>
              </div>
              {error ? (
                <p className="text-sm text-red-300">{error}</p>
              ) : (
                <p className="text-xs text-muted">
                  Supports HTML pages with linked MP3/M4A/M4B files and
                  M3U/M3U8 playlists.
                </p>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";
import { loadProgress } from "@/lib/progress-server";
import { loadAudiobook } from "@/lib/audiobooks-server";
import { AudioPlayer } from "@/components/AudioPlayer";
import { SignOutButton } from "@/components/SignOutButton";
import type { AudiobookPlaylist } from "@/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ data?: string; url?: string }>;

export default async function PlayerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const playlist = await resolvePlaylist(params);

  if (!playlist) {
    redirect("/library");
  }

  if (!(await isAuthenticated())) {
    const target = params.url
      ? `/player?url=${encodeURIComponent(params.url)}`
      : "/library";
    redirect(`/login?redirectTo=${encodeURIComponent(target)}`);
  }

  const progress = await loadProgress(playlist.sourceUrl);

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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <AudioPlayer playlist={playlist} initialProgress={progress} />
      </main>
    </div>
  );
}

async function resolvePlaylist(
  params: { data?: string; url?: string },
): Promise<AudiobookPlaylist | null> {
  if (params.url) {
    const fromDb = await loadAudiobook(params.url);
    if (fromDb) return fromDb;
  }
  if (params.data) {
    return decodePlaylist(params.data);
  }
  return null;
}

function decodePlaylist(raw: string | undefined): AudiobookPlaylist | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AudiobookPlaylist;
    if (
      !parsed ||
      typeof parsed.sourceUrl !== "string" ||
      !Array.isArray(parsed.chapters) ||
      parsed.chapters.length === 0
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

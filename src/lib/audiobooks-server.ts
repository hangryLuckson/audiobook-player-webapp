import "server-only";
import { createAdminClient, APP_USER_ID } from "@/lib/supabase-admin";
import type { AudiobookPlaylist, M3ULink } from "@/types";

export interface LibraryEntry {
  playlist: AudiobookPlaylist;
  chapterIndex: number;
  timestamp: number;
  speed: number;
  progressUpdatedAt: string | null;
  audioUpdatedAt: string;
  completed: boolean;
}

export async function loadAudiobook(
  sourceUrl: string,
): Promise<AudiobookPlaylist | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audiobooks")
    .select("source_url, title, chapters")
    .eq("source_url", sourceUrl)
    .maybeSingle();
  if (error || !data) return null;
  const chapters = Array.isArray(data.chapters)
    ? (data.chapters as M3ULink[])
    : [];
  if (chapters.length === 0) return null;
  return {
    sourceUrl: data.source_url,
    title: data.title,
    chapters,
  };
}

export async function upsertAudiobook(playlist: AudiobookPlaylist): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audiobooks").upsert(
    {
      source_url: playlist.sourceUrl,
      title: playlist.title,
      chapters: playlist.chapters,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "source_url" },
  );
  if (error) {
    console.error("Failed to save audiobook", error);
  }
}

export async function deleteAudiobook(
  sourceUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error: audioError } = await supabase
    .from("audiobooks")
    .delete()
    .eq("source_url", sourceUrl);
  if (audioError) {
    console.error("Failed to delete audiobook", audioError);
    return { ok: false, error: audioError.message };
  }
  const { error: progressError } = await supabase
    .from("progress")
    .delete()
    .eq("url", sourceUrl);
  if (progressError) {
    console.error("Failed to delete progress", progressError);
    return { ok: false, error: progressError.message };
  }
  return { ok: true };
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const supabase = createAdminClient();

  const [audioRes, progressRes] = await Promise.all([
    supabase
      .from("audiobooks")
      .select("source_url, title, chapters, updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("progress")
      .select("url, chapter_index, timestamp, speed, updated_at")
      .eq("user_id", APP_USER_ID),
  ]);

  if (audioRes.error) {
    console.error("listLibrary: audiobooks query failed", audioRes.error);
  }
  if (progressRes.error) {
    console.error("listLibrary: progress query failed", progressRes.error);
  }
  if (audioRes.error || !audioRes.data) return [];

  const progressByUrl = new Map<string, NonNullable<typeof progressRes.data>[number]>();
  for (const row of progressRes.data ?? []) {
    progressByUrl.set(row.url, row);
  }

  return audioRes.data
    .map((row): LibraryEntry | null => {
      const chapters = Array.isArray(row.chapters)
        ? (row.chapters as M3ULink[])
        : [];
      if (chapters.length === 0) return null;
      const progress = progressByUrl.get(row.source_url);
      const chapterIndex = progress?.chapter_index ?? 0;
      const timestamp = progress?.timestamp ?? 0;
      const speed = progress?.speed ?? 1;
      const playlist: AudiobookPlaylist = {
        sourceUrl: row.source_url,
        title: row.title,
        chapters,
      };
      return {
        playlist,
        chapterIndex,
        timestamp,
        speed,
        progressUpdatedAt: progress?.updated_at ?? null,
        audioUpdatedAt: row.updated_at,
        completed: false,
      };
    })
    .filter((entry): entry is LibraryEntry => entry !== null);
}

export { APP_USER_ID };

import "server-only";
import { createAdminClient, APP_USER_ID } from "@/lib/supabase-admin";
import type { UserProgress } from "@/types";

export async function loadProgress(
  sourceUrl: string,
): Promise<UserProgress | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("progress")
    .select("chapter_index, timestamp, speed, updated_at")
    .eq("user_id", APP_USER_ID)
    .eq("url", sourceUrl)
    .maybeSingle();

  if (error || !data) return null;

  return {
    userId: APP_USER_ID,
    url: sourceUrl,
    chapterIndex: data.chapter_index,
    timestamp: data.timestamp,
    speed: data.speed,
    updatedAt: data.updated_at,
  };
}

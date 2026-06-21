import { NextResponse } from "next/server";
import { createAdminClient, APP_USER_ID } from "@/lib/supabase-admin";
import type { M3ULink } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProgressPayload {
  url?: unknown;
  chapterIndex?: unknown;
  timestamp?: unknown;
  speed?: unknown;
  title?: unknown;
  chapters?: unknown;
  coverImageUrl?: unknown;
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function POST(request: Request) {
  let body: ProgressPayload;
  try {
    body = (await request.json()) as ProgressPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const url = asString(body.url);
  const chapterIndex = asNumber(body.chapterIndex);
  const timestamp = asNumber(body.timestamp);
  const speed = asNumber(body.speed);
  if (!url || chapterIndex === null || timestamp === null || speed === null) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const title = asString(body.title);
  const chapters = Array.isArray(body.chapters)
    ? (body.chapters as M3ULink[])
    : null;
  const coverImageUrl = asString(body.coverImageUrl);
  const now = new Date().toISOString();

  const supabase = createAdminClient();

  if (title && chapters && chapters.length > 0) {
    const { error: audioError } = await supabase.from("audiobooks").upsert(
      {
        source_url: url,
        title,
        chapters,
        cover_image_url: coverImageUrl ?? undefined,
        updated_at: now,
      },
      { onConflict: "source_url" },
    );
    if (audioError) {
      console.error("Failed to upsert audiobook", audioError);
    }
  }

  const { error } = await supabase.from("progress").upsert(
    {
      user_id: APP_USER_ID,
      url,
      chapter_index: Math.max(0, Math.floor(chapterIndex)),
      timestamp: Math.max(0, timestamp),
      speed,
      updated_at: now,
    },
    { onConflict: "user_id,url" },
  );
  if (error) {
    console.error("Failed to save progress", error);
    return NextResponse.json({ error: "Save failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

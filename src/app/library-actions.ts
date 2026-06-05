"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/auth-server";
import { upsertAudiobook, deleteAudiobook } from "@/lib/audiobooks-server";
import type { AudiobookPlaylist } from "@/types";

export async function upsertAudiobookAction(
  playlist: AudiobookPlaylist,
): Promise<void> {
  await upsertAudiobook(playlist);
  revalidatePath("/library");
}

export async function deleteAudiobookAction(
  sourceUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAuthenticated())) {
    return { ok: false, error: "Not signed in." };
  }
  const result = await deleteAudiobook(sourceUrl);
  if (!result.ok) {
    return result;
  }
  revalidatePath("/library");
  return { ok: true };
}

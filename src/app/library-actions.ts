"use server";

import { revalidatePath } from "next/cache";
import { upsertAudiobook } from "@/lib/audiobooks-server";
import type { AudiobookPlaylist } from "@/types";

export async function upsertAudiobookAction(
  playlist: AudiobookPlaylist,
): Promise<void> {
  await upsertAudiobook(playlist);
  revalidatePath("/library");
}

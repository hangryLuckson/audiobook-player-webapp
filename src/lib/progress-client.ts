"use client";

import type { SaveProgressInput } from "@/lib/progress-types";
import type { M3ULink } from "@/types";

const PROGRESS_ENDPOINT = "/api/progress";

export interface FullProgressInput extends SaveProgressInput {
  title?: string;
  chapters?: M3ULink[];
}

export async function saveProgress(input: FullProgressInput): Promise<boolean> {
  try {
    const res = await fetch(PROGRESS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Progress save failed", res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Progress save threw", err);
    return false;
  }
}

export function beaconSaveProgress(input: FullProgressInput): boolean {
  try {
    const blob = new Blob([JSON.stringify(input)], {
      type: "application/json",
    });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(PROGRESS_ENDPOINT, blob);
      return ok;
    }
    void fetch(PROGRESS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    });
    return true;
  } catch (err) {
    console.error("Progress beacon threw", err);
    return false;
  }
}

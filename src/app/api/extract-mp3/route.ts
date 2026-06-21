import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { promises as dns } from "node:dns";
import net from "node:net";
import type { AudiobookPlaylist, M3ULink } from "@/types";

type CheerioDoc = ReturnType<typeof cheerio.load>;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".m4b", ".aac", ".ogg", ".wav"];
const PLAYLIST_EXTENSIONS = [".m3u", ".m3u8"];

const FETCH_TIMEOUT_MS = 20000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function isPrivateOrLoopbackAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const octets = ip.split(".").map(Number);
    if (octets[0] === 10) return true;
    if (octets[0] === 127) return true;
    if (octets[0] === 0) return true;
    if (octets[0] === 169 && octets[1] === 254) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
    if (octets[0] >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("fe8") || lower.startsWith("fe9") ||
        lower.startsWith("fea") || lower.startsWith("feb")) {
      return true;
    }
    if (lower.startsWith("ff")) return true;
    return false;
  }
  return true;
}

async function assertSafeUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  const hostname = url.hostname;
  if (!hostname) throw new Error("URL is missing a hostname.");
  if (net.isIP(hostname)) {
    if (isPrivateOrLoopbackAddress(hostname)) {
      throw new Error("URL points to a private/loopback address.");
    }
    return url;
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Could not resolve hostname.");
  }
  if (addresses.length === 0) {
    throw new Error("Hostname did not resolve.");
  }
  for (const { address } of addresses) {
    if (isPrivateOrLoopbackAddress(address)) {
      throw new Error("URL resolves to a private/loopback address.");
    }
  }
  return url;
}

async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: "", truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let received = 0;
  let body = "";
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      const allowed = value.byteLength - (received - maxBytes);
      body += decoder.decode(value.slice(0, Math.max(0, allowed)), {
        stream: true,
      });
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return { body, truncated };
}

async function safeFetch(
  startUrl: string,
): Promise<{ body: string; finalUrl: string }> {
  let current = await assertSafeUrl(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        headers: FETCH_HEADERS,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s. The host may be slow or unreachable.`
          : "Could not fetch the URL.";
      throw new Error(reason);
    }
    clearTimeout(timeout);
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        throw new Error("Redirect missing Location header.");
      }
      if (hop === MAX_REDIRECTS) {
        throw new Error("Too many redirects.");
      }
      const next = new URL(location, current);
      await assertSafeUrl(next.toString());
      current = next;
      continue;
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch URL (${res.status}).`);
    }
    const { body, truncated } = await readBoundedText(res, MAX_BODY_BYTES);
    if (truncated) {
      throw new Error("Response too large to process.");
    }
    return { body, finalUrl: current.toString() };
  }
  throw new Error("Too many redirects.");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function inferExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.[a-z0-9]{2,5}(?:$|\?)/);
    return match ? match[0].split("?")[0] : "";
  } catch {
    return "";
  }
}

function isAudioUrl(url: string): boolean {
  const ext = inferExtension(url);
  if (!ext) return false;
  return AUDIO_EXTENSIONS.includes(ext) || PLAYLIST_EXTENSIONS.includes(ext);
}

function isPlaylistUrl(url: string): boolean {
  const ext = inferExtension(url);
  return PLAYLIST_EXTENSIONS.includes(ext);
}

function isLikelyChapterTitle(value: string): boolean {
  if (!value) return false;
  if (value.length > 200) return false;
  if (/^\s*$/.test(value)) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (isAudioUrl(value)) return false;
  return true;
}

function dedupeAndOrder(items: M3ULink[]): M3ULink[] {
  const seen = new Set<string>();
  const out: M3ULink[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

function numericTitleSort(a: M3ULink, b: M3ULink): number {
  const an = parseInt((a.title ?? "").replace(/\D+/g, ""), 10);
  const bn = parseInt((b.title ?? "").replace(/\D+/g, ""), 10);
  if (!Number.isNaN(an) && !Number.isNaN(bn) && an !== bn) {
    return an - bn;
  }
  return (a.title ?? a.url).localeCompare(b.title ?? b.url);
}

function parseM3U(text: string, base: URL): M3ULink[] {
  const lines = text.split(/\r?\n/);
  const items: M3ULink[] = [];
  let pendingTitle: string | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const match = line.match(/#EXTINF:[^,]*,(.*)$/);
      if (match) {
        pendingTitle = decodeEntities(match[1]).trim();
      }
      continue;
    }
    if (line.startsWith("#")) continue;
    let absolute: URL | null = null;
    try {
      absolute = new URL(line, base);
    } catch {
      pendingTitle = undefined;
      continue;
    }
    items.push({ url: absolute.toString(), title: pendingTitle });
    pendingTitle = undefined;
  }
  return dedupeAndOrder(items);
}

function extractFromHtml($: CheerioDoc, base: URL): M3ULink[] {
  const items: M3ULink[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      return;
    }
    const url = absolute.toString();
    if (!isAudioUrl(url)) return;
    const rawTitle =
      $(el).attr("title")?.trim() ||
      $(el).text()?.trim() ||
      $(el).attr("aria-label")?.trim();
    const title =
      rawTitle && isLikelyChapterTitle(rawTitle)
        ? decodeEntities(rawTitle)
        : undefined;
    items.push({ url, title });
  });
  return dedupeAndOrder(items);
}

function deriveTitle($: CheerioDoc, fallback: string): string {
  return (
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $('meta[name="twitter:title"]').attr("content")?.trim() ||
    $("title").first().text()?.trim() ||
    fallback
  );
}

function deriveCoverImageUrl($: CheerioDoc): string | null {
  const raw =
    $('meta[property="og:image"]').attr("content")?.trim() ||
    $('meta[name="twitter:image"]').attr("content")?.trim() ||
    null;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function extractFromSource(
  sourceUrl: string,
): Promise<AudiobookPlaylist> {
  const { body, finalUrl } = await safeFetch(sourceUrl);
  const base = new URL(finalUrl);
  const $: CheerioDoc = cheerio.load(body);

  const chapters =
    isPlaylistUrl(finalUrl) || /^#EXTM3U/i.test(body.trim())
      ? parseM3U(body, base)
      : extractFromHtml($, base);

  if (chapters.length === 0) {
    throw new Error("No audio files found at the provided URL.");
  }

  chapters.sort(numericTitleSort);
  return {
    sourceUrl: finalUrl,
    title: deriveTitle($, base.hostname),
    chapters,
    coverImageUrl: deriveCoverImageUrl($),
  };
}

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }
    const playlist = await extractFromSource(url);
    return NextResponse.json({ playlist });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

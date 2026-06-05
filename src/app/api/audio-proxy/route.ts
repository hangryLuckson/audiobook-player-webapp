import { NextResponse, type NextRequest } from "next/server";
import { promises as dns } from "node:dns";
import net from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROXY_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 5;
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

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
    if (
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    ) {
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
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  for (const { address } of addresses) {
    if (isPrivateOrLoopbackAddress(address)) {
      throw new Error("URL resolves to a private/loopback address.");
    }
  }
  return url;
}

async function safeFetch(
  startUrl: string,
  rangeHeader: string | null,
): Promise<{ response: Response; finalUrl: string }> {
  let current = await assertSafeUrl(startUrl);
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.5",
  };
  if (rangeHeader) headers["Range"] = rangeHeader;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current, {
        headers,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const reason =
        err instanceof Error && err.name === "AbortError"
          ? `Upstream timed out after ${PROXY_TIMEOUT_MS}ms.`
          : "Could not reach the audio host.";
      throw new Error(reason);
    }
    clearTimeout(timeout);
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirect missing Location header.");
      if (hop === MAX_REDIRECTS) throw new Error("Too many redirects.");
      const next = new URL(location, current);
      await assertSafeUrl(next.toString());
      current = next;
      continue;
    }
    if (!res.ok && res.status !== 206) {
      throw new Error(`Upstream returned ${res.status}.`);
    }
    return { response: res, finalUrl: current.toString() };
  }
  throw new Error("Too many redirects.");
}

function passthroughHeader(
  name: string,
  value: string,
  out: Headers,
): void {
  const lower = name.toLowerCase();
  if (
    lower === "content-encoding" ||
    lower === "content-length" ||
    lower === "transfer-encoding" ||
    lower === "connection" ||
    lower === "access-control-allow-origin"
  ) {
    return;
  }
  out.set(name, value);
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing ?url parameter" }, { status: 400 });
  }

  const rangeHeader = request.headers.get("range");

  let upstream: Awaited<ReturnType<typeof safeFetch>>;
  try {
    upstream = await safeFetch(url, rangeHeader);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { response, finalUrl } = upstream;
  const outHeaders = new Headers();
  response.headers.forEach((value, name) => {
    passthroughHeader(name, value, outHeaders);
  });
  if (!outHeaders.get("content-type")) {
    outHeaders.set("Content-Type", "application/octet-stream");
  }
  outHeaders.set("Access-Control-Allow-Origin", "*");
  outHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  outHeaders.set("Access-Control-Allow-Headers", "Range");
  outHeaders.set("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges, Content-Length");
  outHeaders.set("Cache-Control", "public, max-age=3600");
  outHeaders.set("X-Content-Type-Options", "nosniff");
  if (!outHeaders.get("accept-ranges")) {
    outHeaders.set("Accept-Ranges", "bytes");
  }
  void finalUrl;

  if (!response.body) {
    return new NextResponse(null, { status: 502, headers: outHeaders });
  }

  let received = 0;
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > MAX_AUDIO_BYTES) {
        controller.error(new Error("Audio too large."));
        return;
      }
      controller.enqueue(chunk);
    },
  });

  return new NextResponse(response.body.pipeThrough(transform), {
    status: response.status,
    headers: outHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Max-Age": "86400",
    },
  });
}

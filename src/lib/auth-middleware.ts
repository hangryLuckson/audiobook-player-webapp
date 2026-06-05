import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/env";

export const runtime = "nodejs";

function sign(value: string): string {
  return createHmac("sha256", process.env.APP_PASSWORD ?? "")
    .update(value)
    .digest("hex")
    .slice(0, 32);
}

function expectedToken(): string {
  return `v1.${sign("ok")}`;
}

function isAuthed(request: NextRequest): boolean {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  return cookie === expectedToken();
}

export function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname === "/login";
  const isProtected =
    pathname.startsWith("/player") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/add") ||
    pathname === "/" ||
    pathname.startsWith("/api/extract-mp3") ||
    pathname.startsWith("/api/audio-proxy") ||
    pathname.startsWith("/api/progress");

  if (!isAuthed(request) && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthed(request) && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.delete("redirectTo");
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

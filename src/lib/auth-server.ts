import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AUTH_COOKIE, ENV } from "@/lib/env";

const ONE_WEEK = 60 * 60 * 24 * 7;

function sign(value: string): string {
  return createHmac("sha256", ENV.appPassword)
    .update(value)
    .digest("hex")
    .slice(0, 32);
}

function token(): string {
  return `v1.${sign("ok")}`;
}

function verify(tokenValue: string | undefined): boolean {
  if (!tokenValue || !tokenValue.startsWith("v1.")) return false;
  const expected = sign("ok");
  const provided = tokenValue.slice(3);
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex"),
    );
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verify(store.get(AUTH_COOKIE)?.value);
}

export async function setAuthCookie(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function verifyPassword(input: string): Promise<boolean> {
  const expected = ENV.appPassword;
  if (input.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
  } catch {
    return false;
  }
}

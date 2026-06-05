"use server";

import { redirect } from "next/navigation";
import { setAuthCookie, clearAuthCookie, verifyPassword } from "@/lib/auth-server";

export async function signIn(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");
  if (await verifyPassword(password)) {
    await setAuthCookie();
    redirect(redirectTo);
  }
  redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}&error=Incorrect%20password`);
}

export async function signOut(): Promise<void> {
  await clearAuthCookie();
  redirect("/login");
}

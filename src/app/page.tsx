import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  if (!(await isAuthenticated())) {
    redirect("/login?redirectTo=/library");
  }
  redirect("/library");
}

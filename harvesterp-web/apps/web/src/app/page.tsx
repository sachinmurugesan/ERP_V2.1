import { redirect } from "next/navigation";
import { getSessionToken } from "@/lib/session";

/**
 * Root page — redirects to /dashboard if authenticated, /login if not.
 * Never renders visible UI; it's purely a routing gateway.
 */
export default async function RootPage() {
  const token = await getSessionToken();
  if (token) {
    redirect("/dashboard");
  }
  redirect("/login");
}

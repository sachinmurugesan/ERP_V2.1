import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import { hasRouteAccess } from "@/lib/auth-guards";
import { resolveDisplayName } from "@/lib/display-name";
import { NavigationSidebar } from "@/components/shells/navigation-sidebar";
import { AppTopbar } from "@/components/shells/app-topbar";
import type { SidebarUser } from "@/components/shells/sidebar";

/**
 * Authenticated app layout — RSC.
 *
 * Responsibilities:
 *   1. Verify session cookie; redirect to /login if absent.
 *   2. Fetch the current user from FastAPI (best-effort — falls back to
 *      generic "User" if the backend is not running).
 *   3. Render Sidebar (via NavigationSidebar client wrapper) + Topbar
 *      (via AppTopbar client wrapper) + <main> content slot.
 *
 * Why two client wrappers?
 *   - This layout is a server component and cannot pass functions as props
 *     to child components. NavigationSidebar handles router.push, AppTopbar
 *     handles theme toggle — both "use client" components.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }

  // Read current pathname injected by middleware for route protection
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/";

  // Fetch user info — gracefully degrade when backend is offline
  let user: SidebarUser = { name: "User", roleLabel: "Member" };
  let userEmail: string | undefined;
  let userRole: string | undefined;
  let displayName = "there";
  try {
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");
    if (result.data) {
      const u = result.data as {
        email?: string;
        role?: string;
        full_name?: string | null;
      };
      userRole = u.role;
      userEmail = u.email;
      displayName = resolveDisplayName(u);
      user = {
        name: displayName,
        roleLabel: u.role ?? "Member",
      };
    }
  } catch {
    // Backend offline — use default user placeholder
  }

  // Server-side route protection: redirect to /dashboard if role is insufficient
  if (!hasRouteAccess(pathname, userRole)) {
    redirect("/dashboard");
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <NavigationSidebar user={user} {...(userRole !== undefined ? { userRole } : {})} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <AppTopbar
          title="HarvestERP"
          userName={displayName}
          {...(userEmail !== undefined ? { userEmail } : {})}
        />
        <main
          style={{
            flex: 1,
            overflow: "auto",
            padding: "24px",
            background: "var(--bg)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

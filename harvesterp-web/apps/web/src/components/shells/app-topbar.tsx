"use client";

/**
 * AppTopbar — Next.js-aware Topbar wrapper.
 *
 * Adds two pieces of page-awareness on top of the shell Topbar:
 *   - Theme toggle bound to ThemeProvider.
 *   - Pathname-driven title/subtitle: on the dashboard landing page the
 *     subtitle becomes a localised "Good morning, <name> · Thu, 23 Apr"
 *     greeting computed from the user's local time, which matches the v1
 *     design reference. Other routes fall back to whatever title/subtitle
 *     the caller provided.
 *
 * Rendered from the (app) Server Component layout via this thin client
 * bridge so pathname + local time access is legal.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { Topbar, type TopbarProps } from "@/components/shells/topbar";
import { UserDropdown } from "@/components/composed/user-dropdown";
import { useTheme } from "@/providers/theme-provider";

type AppTopbarProps = Pick<TopbarProps, "title" | "subtitle" | "breadcrumbs"> & {
  /** Email shown in the avatar dropdown. Not shown anywhere else. */
  userEmail?: string;
  /** Friendly display name used in the greeting. */
  userName?: string;
};

function timeGreeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatGreetingDate(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function useNowEveryMinute(): Date {
  const [now, setNow] = React.useState<Date>(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      window.clearInterval(id);
    };
  }, []);
  return now;
}

export function AppTopbar({
  userEmail,
  userName,
  title,
  subtitle,
  breadcrumbs,
}: AppTopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const now = useNowEveryMinute();

  const right = userEmail ? <UserDropdown email={userEmail} /> : undefined;

  const onDashboard = pathname === "/dashboard" || pathname === "/";
  const resolvedTitle = onDashboard ? "Dashboard" : title;
  const resolvedSubtitle =
    onDashboard && userName
      ? `${timeGreeting(now)}, ${userName} \u00b7 ${formatGreetingDate(now)}`
      : subtitle;

  return (
    <Topbar
      {...(resolvedTitle !== undefined ? { title: resolvedTitle } : {})}
      {...(resolvedSubtitle !== undefined ? { subtitle: resolvedSubtitle } : {})}
      {...(breadcrumbs !== undefined ? { breadcrumbs } : {})}
      {...(right !== undefined ? { right } : {})}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

"use client";

/**
 * AppTopbar — Next.js-aware Topbar wrapper.
 *
 * Connects Topbar's onToggleTheme callback to ThemeProvider.
 * Renders UserDropdown in the right slot when userEmail is provided.
 * Rendered from the (app) Server Component layout via this thin client bridge.
 */

import { Topbar, type TopbarProps } from "@/components/shells/topbar";
import { UserDropdown } from "@/components/composed/user-dropdown";
import { useTheme } from "@/providers/theme-provider";

type AppTopbarProps = Pick<TopbarProps, "title" | "subtitle" | "breadcrumbs"> & {
  /** Email/name of the current user — shown in the avatar dropdown. */
  userEmail?: string;
};

export function AppTopbar({ userEmail, ...props }: AppTopbarProps) {
  const { theme, toggleTheme } = useTheme();

  const right = userEmail ? <UserDropdown email={userEmail} /> : undefined;

  return (
    <Topbar
      {...props}
      right={right}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}

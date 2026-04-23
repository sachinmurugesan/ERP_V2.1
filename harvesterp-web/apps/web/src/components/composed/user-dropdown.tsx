"use client";

/**
 * UserDropdown — Avatar button with Profile / Settings / Logout menu.
 *
 * Placed in the Topbar right slot by AppTopbar when user info is available.
 * Calls POST /api/auth/logout then redirects to /login on sign-out.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu";

export interface UserDropdownProps {
  /** Email (or display name) shown in the menu header and used for initials. */
  email: string;
}

/**
 * Derive a 1–2 character display string from an email or display name.
 * "admin@harvesterp.com" → "A"   (first char of local part)
 * "John Doe"             → "JD"  (first char of each word)
 */
function getInitials(email: string): string {
  if (!email.trim()) return "U";
  // Email address — use first char of the local part only
  if (email.includes("@")) {
    const localPart = email.split("@")[0] ?? "";
    return (localPart[0] ?? "U").toUpperCase();
  }
  // Display name — use first char of each space-delimited word
  const parts = email.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0]?.[0] ?? "U").toUpperCase();
}

export function UserDropdown({ email }: UserDropdownProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const initials = getInitials(email);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort — clear session even if network fails
    }
    router.push("/login");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`User menu for ${email}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--brand-800, #1e40af)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            letterSpacing: 0.5,
          }}
        >
          {initials}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" style={{ minWidth: 200 }}>
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium leading-none">{email}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem>
          <User />
          <span>Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem>
          <Settings />
          <span>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isLoggingOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleLogout();
          }}
          className="text-destructive focus:text-destructive"
        >
          <LogOut />
          <span>{isLoggingOut ? "Signing out…" : "Logout"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

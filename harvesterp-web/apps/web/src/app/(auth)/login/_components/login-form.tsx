"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/primitives/button";
import { Input } from "@/components/primitives/input";
import { Label } from "@/components/primitives/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/primitives/card";
import { HarvestERPLogo } from "@/components/design-system/logo";

interface LoginFormProps {
  returnTo?: string | undefined;
}

/**
 * LoginForm — client component for the /login page.
 *
 * Submits credentials to POST /api/auth/login (Next.js route handler).
 * The route handler calls FastAPI, sets the httpOnly cookie, and returns
 * the user. The form never sees the raw JWT.
 */
export function LoginForm({ returnTo }: LoginFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const username = data.get("username") as string;
    const password = data.get("password") as string;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Sign in failed — please check your credentials");
        return;
      }

      router.push(returnTo ?? "/dashboard");
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-3">
          <HarvestERPLogo size={40} />
        </div>
        <CardTitle className="text-xl">Sign in to HarvestERP</CardTitle>
        <CardDescription>
          Enter your work email and password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Email address</Label>
            <Input
              id="username"
              name="username"
              type="email"
              autoComplete="email"
              required
              placeholder="you@harvesterp.com"
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={pending}
          >
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

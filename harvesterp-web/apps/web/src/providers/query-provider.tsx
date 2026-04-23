"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * QueryProvider — wraps the React tree in TanStack Query v5.
 *
 * Creates a new QueryClient per component mount so server renders don't
 * share state between users (per TanStack Query SSR recommendations).
 *
 * Default options:
 *   - staleTime: 60 s — data is considered fresh for one minute
 *   - retry: 1       — one retry on failure before showing error state
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

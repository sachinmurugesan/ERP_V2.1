"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { RecentActivityEvent } from "./types";
import { timeAgo } from "./formatters";
import { FeedRowsSkeleton } from "./skeletons";
import { EmptyState } from "./empty-state";
import { ErrorCard } from "./error-card";

const REFETCH_INTERVAL_MS = 30_000;

interface RecentActivityResponse {
  events: RecentActivityEvent[];
}

async function fetchRecentActivity(): Promise<RecentActivityEvent[]> {
  const res = await fetch("/api/dashboard/recent-activity", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Recent activity failed: ${res.status}`);
  }
  const body = (await res.json()) as RecentActivityResponse;
  return Array.isArray(body.events) ? body.events : [];
}

export function RecentActivitySection(): React.ReactElement {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<
    RecentActivityEvent[],
    Error
  >({
    queryKey: ["dashboard", "recent-activity"],
    queryFn: fetchRecentActivity,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const events = data ?? [];
  const count = events.length;

  return (
    <section aria-label="Recent activity" className="card">
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--fg)" }}>
          Recent Activity
        </h2>
        <p
          style={{
            fontSize: 12,
            color: "var(--fg-subtle)",
            margin: "4px 0 0",
          }}
        >
          Latest updates from the team
        </p>
      </header>

      {isLoading && <FeedRowsSkeleton rows={5} />}

      {isError && !isLoading && (
        <ErrorCard
          message="Couldn't load recent activity."
          onRetry={() => void refetch()}
          retryLabel={isFetching ? "Retrying\u2026" : "Retry"}
        />
      )}

      {!isLoading && !isError && count === 0 && (
        <EmptyState
          message="No recent activity."
          ctaLabel="View all orders"
          ctaHref="/orders"
        />
      )}

      {!isLoading && !isError && count > 0 && (
        <div
          style={{
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxHeight: 480,
            overflowY: "auto",
          }}
        >
          {events.map((event) => (
            <article
              key={event.id}
              style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--brand-500)",
                  marginTop: 8,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--fg-subtle)",
                    margin: 0,
                  }}
                >
                  {timeAgo(event.updated_at)}
                </p>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--fg)",
                    margin: "2px 0 0",
                  }}
                >
                  {event.action}
                </p>
                {event.details && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--fg-muted)",
                      margin: "2px 0 0",
                    }}
                  >
                    {event.details}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {!isError && (
        <footer
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          <Link
            href="/orders"
            className="btn btn-sm btn-ghost"
            style={{ color: "var(--brand-700)" }}
          >
            View All Orders
          </Link>
        </footer>
      )}
    </section>
  );
}

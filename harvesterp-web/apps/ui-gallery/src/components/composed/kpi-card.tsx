"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";
import { SparkLine } from "@/components/design-system/spark-line";

// ── Types ────────────────────────────────────────────────────────────────────

export type KpiTone = "neutral" | "ok" | "warn" | "err" | "info";

export interface KpiCardProps {
  /** Short label above the value */
  label: string;
  /** Main metric value — formatted string (e.g. "₹4.2 Cr", "1,284") */
  value: string;
  /** Delta text (e.g. "+12.4%", "−3 units") */
  delta?: string;
  /** Whether the delta is positive, negative, or neutral */
  deltaDirection?: "up" | "down" | "neutral";
  /** Secondary line beneath delta (e.g. "vs last month") */
  subtext?: string;
  /** Optional sparkline data points */
  spark?: number[];
  /** Semantic tone for the delta colour */
  tone?: KpiTone;
  /** Icon name shown in the top-right badge */
  icon?: string;
  /** Override card class for custom backgrounds */
  className?: string;
  style?: React.CSSProperties;
}

const TONE_DELTA_COLOR: Record<KpiTone, string> = {
  neutral: "var(--fg-muted)",
  ok:      "var(--ok)",
  warn:    "var(--warn)",
  err:     "var(--err)",
  info:    "var(--info)",
};

const TONE_ICON_BG: Record<KpiTone, string> = {
  neutral: "var(--bg-sunken)",
  ok:      "color-mix(in oklch, var(--ok) 12%, transparent)",
  warn:    "color-mix(in oklch, var(--warn) 14%, transparent)",
  err:     "color-mix(in oklch, var(--err) 12%, transparent)",
  info:    "color-mix(in oklch, var(--info) 12%, transparent)",
};

const TONE_ICON_COLOR: Record<KpiTone, string> = {
  neutral: "var(--fg-muted)",
  ok:      "var(--ok)",
  warn:    "var(--warn)",
  err:     "var(--err)",
  info:    "var(--info)",
};

const TONE_SPARK_COLOR: Record<KpiTone, string> = {
  neutral: "var(--fg-subtle)",
  ok:      "var(--ok)",
  warn:    "var(--warn)",
  err:     "var(--err)",
  info:    "var(--info)",
};

/**
 * KpiCard — A compact metric card used across ERP dashboards.
 *
 * Composes SparkLine and Icon from the design-system layer.
 * CSS classes (.kpi-label, .kpi-value, .kpi-sub, .kpi-delta-up/down) come from globals.css.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaDirection = "neutral",
  subtext,
  spark,
  tone = "neutral",
  icon,
  className = "",
  style,
}: KpiCardProps): React.ReactElement {
  const effectiveTone: KpiTone =
    tone !== "neutral"
      ? tone
      : deltaDirection === "up"
      ? "ok"
      : deltaDirection === "down"
      ? "err"
      : "neutral";

  const deltaClass =
    deltaDirection === "up"
      ? "kpi-delta-up"
      : deltaDirection === "down"
      ? "kpi-delta-down"
      : "";

  return (
    <div
      className={`card card-pad ${className}`}
      style={style}
      role="region"
      aria-label={label}
    >
      {/* Label row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span className="kpi-label">{label}</span>

        {icon && (
          <span
            aria-hidden="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: "var(--r-sm)",
              background: TONE_ICON_BG[effectiveTone],
              color: TONE_ICON_COLOR[effectiveTone],
              flexShrink: 0,
            }}
          >
            <Icon
              name={icon as import("@/components/design-system/icon").IconName}
              size={15}
            />
          </span>
        )}
      </div>

      {/* Main value */}
      <div className="kpi-value">{value}</div>

      {/* Delta / subtext row */}
      {(delta || subtext) && (
        <div className="kpi-sub" style={{ gap: 6 }}>
          {delta && (
            <span
              className={deltaClass}
              style={{
                color: TONE_DELTA_COLOR[effectiveTone],
                fontWeight: 600,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              {deltaDirection === "up" && (
                <Icon name="arrowUp" size={12} color={TONE_DELTA_COLOR[effectiveTone]} />
              )}
              {deltaDirection === "down" && (
                <Icon name="arrowDown" size={12} color={TONE_DELTA_COLOR[effectiveTone]} />
              )}
              {delta}
            </span>
          )}
          {subtext && (
            <span style={{ fontSize: 11, color: "var(--fg-subtle)", fontWeight: 400 }}>
              {subtext}
            </span>
          )}
        </div>
      )}

      {/* Sparkline */}
      {spark && spark.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <SparkLine
            data={spark}
            color={TONE_SPARK_COLOR[effectiveTone]}
            width={120}
            height={30}
          />
        </div>
      )}
    </div>
  );
}

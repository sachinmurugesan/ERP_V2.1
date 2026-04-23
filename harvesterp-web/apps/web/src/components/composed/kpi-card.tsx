"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/design-system/icon";
import { SparkLine } from "@/components/design-system/spark-line";

export type KpiTone = "neutral" | "ok" | "warn" | "err" | "info";

export interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  subtext?: string;
  spark?: number[];
  tone?: KpiTone;
  icon?: IconName;
  className?: string;
  style?: React.CSSProperties;
}

const TONE_DELTA_COLOR: Record<KpiTone, string> = {
  neutral: "var(--fg-muted)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  err: "var(--err)",
  info: "var(--info)",
};

const TONE_ICON_BG: Record<KpiTone, string> = {
  neutral: "var(--bg-sunken)",
  ok: "color-mix(in oklch, var(--ok) 12%, transparent)",
  warn: "color-mix(in oklch, var(--warn) 14%, transparent)",
  err: "color-mix(in oklch, var(--err) 12%, transparent)",
  info: "color-mix(in oklch, var(--info) 12%, transparent)",
};

const TONE_ICON_COLOR: Record<KpiTone, string> = {
  neutral: "var(--fg-muted)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  err: "var(--err)",
  info: "var(--info)",
};

const TONE_SPARK_COLOR: Record<KpiTone, string> = {
  neutral: "var(--fg-subtle)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  err: "var(--err)",
  info: "var(--info)",
};

const TONE_ACCENT_COLOR: Record<KpiTone, string> = {
  neutral: "var(--border)",
  ok: "var(--ok)",
  warn: "var(--warn)",
  err: "var(--err)",
  info: "var(--info)",
};

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

  const accentStyle: React.CSSProperties = {
    borderLeft: `3px solid ${TONE_ACCENT_COLOR[effectiveTone]}`,
    ...(style ?? {}),
  };

  return (
    <div
      className={`card card-pad ${className}`}
      style={accentStyle}
      role="region"
      aria-label={label}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
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
            <Icon name={icon} size={15} />
          </span>
        )}
      </div>

      <div className="kpi-value num">{value}</div>

      {(delta || subtext) && (
        <div
          className="kpi-sub"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 4,
          }}
        >
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
                <Icon
                  name="arrowUp"
                  size={12}
                  color={TONE_DELTA_COLOR[effectiveTone]}
                />
              )}
              {deltaDirection === "down" && (
                <Icon
                  name="arrowDown"
                  size={12}
                  color={TONE_DELTA_COLOR[effectiveTone]}
                />
              )}
              {delta}
            </span>
          )}
          {subtext && (
            <span
              style={{
                fontSize: 11,
                color: "var(--fg-subtle)",
                fontWeight: 400,
              }}
            >
              {subtext}
            </span>
          )}
        </div>
      )}

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

"use client";

import * as React from "react";
import {
  STAGE_GROUPS,
  type StageGroup,
  type StageGroupId,
  type StageGroupTone,
} from "./stage-groups";
import type { StageGroupCounts } from "./types";

export interface FilterTabsProps {
  activeId: StageGroupId;
  counts: StageGroupCounts;
  loading?: boolean;
  onSelect: (id: StageGroupId) => void;
}

const TONE_ACTIVE: Record<StageGroupTone, React.CSSProperties> = {
  default: {
    background: "var(--brand-800)",
    color: "#fff",
    borderColor: "var(--brand-800)",
  },
  info: {
    background: "var(--info)",
    color: "#fff",
    borderColor: "var(--info)",
  },
  warn: {
    background: "#B45309",
    color: "#fff",
    borderColor: "#B45309",
  },
  accent: {
    background: "var(--brand-700)",
    color: "#fff",
    borderColor: "var(--brand-700)",
  },
  ok: {
    background: "var(--ok)",
    color: "#fff",
    borderColor: "var(--ok)",
  },
  muted: {
    background: "var(--fg-muted)",
    color: "var(--bg-elev)",
    borderColor: "var(--fg-muted)",
  },
};

/**
 * 9 stage-group pill tabs with live count badges. Horizontally scrollable on
 * narrow viewports; the active tab picks up the group's tone as a solid fill.
 */
export function FilterTabs({
  activeId,
  counts,
  loading = false,
  onSelect,
}: FilterTabsProps): React.ReactElement {
  return (
    <div
      role="tablist"
      aria-label="Filter orders by stage"
      style={{
        display: "flex",
        gap: 8,
        padding: "12px 18px",
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
      }}
    >
      {STAGE_GROUPS.map((group) => (
        <TabButton
          key={group.id}
          group={group}
          count={counts[group.id]}
          loading={loading}
          active={group.id === activeId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function TabButton({
  group,
  count,
  loading,
  active,
  onSelect,
}: {
  group: StageGroup;
  count: number;
  loading: boolean;
  active: boolean;
  onSelect: (id: StageGroupId) => void;
}): React.ReactElement {
  const activeStyle = active ? TONE_ACTIVE[group.tone] : {};
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls="orders-table"
      onClick={() => onSelect(group.id)}
      className="chip"
      style={{
        cursor: "pointer",
        whiteSpace: "nowrap",
        height: 28,
        padding: "0 12px",
        flexShrink: 0,
        ...activeStyle,
      }}
    >
      {group.label}
      <span
        className="num"
        aria-hidden="true"
        style={{
          fontSize: 11,
          marginLeft: 6,
          opacity: loading ? 0.4 : 0.85,
          fontWeight: 700,
        }}
      >
        {loading ? "\u2026" : count.toLocaleString("en-IN")}
      </span>
    </button>
  );
}

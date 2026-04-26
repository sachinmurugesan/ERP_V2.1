/**
 * provider-role-badge.test.tsx — Unit tests for the local
 * ProviderRoleBadge + ProviderRolesCell components.
 *
 * Verifies:
 *   - Each of the four roles renders with the correct DS chip tone class
 *     (chip-info / chip-ok / chip-warn / chip-purple).
 *   - Unknown role values render with the raw text and no tone class
 *     (mirrors Vue fallback behaviour).
 *   - Multi-role wrap: every role renders a separate pill in the
 *     ≥lg + <md layout.
 *   - Tablet count badge ("3 roles") renders in the md→lg layout.
 *   - Empty-roles fallback renders the "No roles" italic message.
 *   - Single-role pluralisation is correct ("1 role", not "1 roles").
 */
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import {
  ProviderRoleBadge,
  ProviderRolesCell,
} from "../../src/app/(app)/transport/_components/provider-role-badge";
import type { ServiceProviderRole } from "../../src/app/(app)/transport/_components/types";

// ── Single-badge rendering ────────────────────────────────────────────────────

describe("ProviderRoleBadge — known roles", () => {
  it("FREIGHT_FORWARDER → chip-info + 'Freight Forwarder' label", () => {
    render(<ProviderRoleBadge role="FREIGHT_FORWARDER" />);
    const el = screen.getByTestId("provider-role-freight_forwarder");
    expect(el).toHaveTextContent("Freight Forwarder");
    expect(el.className).toMatch(/\bchip\b/);
    expect(el.className).toMatch(/\bchip-info\b/);
  });

  it("CHA → chip-ok + 'CHA' label", () => {
    render(<ProviderRoleBadge role="CHA" />);
    const el = screen.getByTestId("provider-role-cha");
    expect(el).toHaveTextContent("CHA");
    expect(el.className).toMatch(/\bchip-ok\b/);
  });

  it("CFS → chip-warn + 'CFS' label", () => {
    render(<ProviderRoleBadge role="CFS" />);
    const el = screen.getByTestId("provider-role-cfs");
    expect(el).toHaveTextContent("CFS");
    expect(el.className).toMatch(/\bchip-warn\b/);
  });

  it("TRANSPORT → chip-purple + 'Transport' label", () => {
    render(<ProviderRoleBadge role="TRANSPORT" />);
    const el = screen.getByTestId("provider-role-transport");
    expect(el).toHaveTextContent("Transport");
    expect(el.className).toMatch(/\bchip-purple\b/);
  });

  it("applies extra className when passed", () => {
    render(<ProviderRoleBadge role="CHA" className="my-extra" />);
    const el = screen.getByTestId("provider-role-cha");
    expect(el.className).toMatch(/\bmy-extra\b/);
    expect(el.className).toMatch(/\bchip-ok\b/);
  });
});

describe("ProviderRoleBadge — unknown role fallback", () => {
  it("renders raw enum text with no tone class for an unknown role", () => {
    // Cast through unknown to keep TS quiet about the unknown enum value.
    const unknown = "ROAD" as unknown as ServiceProviderRole;
    render(<ProviderRoleBadge role={unknown} />);
    const el = screen.getByTestId("provider-role-road");
    expect(el).toHaveTextContent("ROAD");
    expect(el.className).toMatch(/\bchip\b/);
    // Should NOT contain any of the known tone variants.
    expect(el.className).not.toMatch(/chip-info|chip-ok|chip-warn|chip-purple/);
  });
});

// ── Multi-role wrap (desktop + mobile layout) ────────────────────────────────

describe("ProviderRolesCell — pill wrap (desktop + mobile)", () => {
  it("renders one pill per role in the pills layout", () => {
    render(
      <ProviderRolesCell roles={["FREIGHT_FORWARDER", "CHA", "TRANSPORT"]} />,
    );
    const wrap = screen.getByTestId("provider-roles-pills");
    expect(wrap).toBeInTheDocument();
    // All three known role test-ids present inside the wrap.
    expect(within(wrap).getByTestId("provider-role-freight_forwarder")).toBeInTheDocument();
    expect(within(wrap).getByTestId("provider-role-cha")).toBeInTheDocument();
    expect(within(wrap).getByTestId("provider-role-transport")).toBeInTheDocument();
  });

  it("renders a single pill for a single-role provider", () => {
    render(<ProviderRolesCell roles={["CFS"]} />);
    const wrap = screen.getByTestId("provider-roles-pills");
    expect(within(wrap).getAllByText(/^(Freight Forwarder|CHA|CFS|Transport)$/)).toHaveLength(1);
    expect(within(wrap).getByTestId("provider-role-cfs")).toBeInTheDocument();
  });

  it("aria-label on the pills group lists every role label", () => {
    render(<ProviderRolesCell roles={["FREIGHT_FORWARDER", "CHA"]} />);
    const wrap = screen.getByTestId("provider-roles-pills");
    expect(wrap.getAttribute("aria-label")).toMatch(/Freight Forwarder/);
    expect(wrap.getAttribute("aria-label")).toMatch(/CHA/);
  });
});

// ── Tablet count badge ───────────────────────────────────────────────────────

describe("ProviderRolesCell — tablet count badge (md → lg)", () => {
  it("renders a count badge ('3 roles')", () => {
    render(
      <ProviderRolesCell roles={["FREIGHT_FORWARDER", "CHA", "TRANSPORT"]} />,
    );
    const count = screen.getByTestId("provider-roles-count");
    expect(count).toHaveTextContent("3 roles");
    expect(count.className).toMatch(/\bchip-accent\b/);
  });

  it("singular pluralisation: 1 role (not '1 roles')", () => {
    render(<ProviderRolesCell roles={["CHA"]} />);
    const count = screen.getByTestId("provider-roles-count");
    expect(count).toHaveTextContent("1 role");
    expect(count).not.toHaveTextContent("1 roles");
  });

  it("plural pluralisation for two roles: 2 roles", () => {
    render(<ProviderRolesCell roles={["FREIGHT_FORWARDER", "CHA"]} />);
    expect(screen.getByTestId("provider-roles-count")).toHaveTextContent("2 roles");
  });

  it("count badge aria-label exposes the full role list to screen readers", () => {
    render(
      <ProviderRolesCell roles={["FREIGHT_FORWARDER", "CHA", "TRANSPORT"]} />,
    );
    const count = screen.getByTestId("provider-roles-count");
    expect(count.getAttribute("aria-label")).toMatch(/Freight Forwarder/);
    expect(count.getAttribute("aria-label")).toMatch(/CHA/);
    expect(count.getAttribute("aria-label")).toMatch(/Transport/);
  });
});

// ── Empty-roles fallback ─────────────────────────────────────────────────────

describe("ProviderRolesCell — empty fallback", () => {
  it("renders 'No roles' italic when roles is empty", () => {
    render(<ProviderRolesCell roles={[]} />);
    const empty = screen.getByTestId("provider-roles-empty");
    expect(empty).toHaveTextContent(/no roles/i);
    expect(empty.className).toMatch(/\bitalic\b/);
    // Neither pills wrap nor count badge should render in the empty case.
    expect(screen.queryByTestId("provider-roles-pills")).toBeNull();
    expect(screen.queryByTestId("provider-roles-count")).toBeNull();
  });
});

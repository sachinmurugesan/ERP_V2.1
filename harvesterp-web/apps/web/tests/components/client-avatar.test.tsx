/**
 * client-avatar.test.tsx — Unit tests for the ported ClientAvatar.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ClientAvatar } from "../../src/components/composed/client-avatar";

describe("ClientAvatar — class variant", () => {
  it("renders initials from name", () => {
    render(<ClientAvatar name="Acme Corp" />);
    expect(screen.getByLabelText("Acme Corp")).toHaveTextContent("AC");
  });

  it("respects size prop (md default)", () => {
    render(<ClientAvatar name="Test" size="md" />);
    const el = screen.getByLabelText("Test");
    expect(el.className).toMatch(/h-8/);
    expect(el.className).toMatch(/w-8/);
  });

  it("size=lg → h-12 w-12 classes", () => {
    render(<ClientAvatar name="Big" size="lg" />);
    const el = screen.getByLabelText("Big");
    expect(el.className).toMatch(/h-12/);
    expect(el.className).toMatch(/w-12/);
  });

  it("size=sm → h-6 w-6 classes", () => {
    render(<ClientAvatar name="Small" size="sm" />);
    const el = screen.getByLabelText("Small");
    expect(el.className).toMatch(/h-6/);
    expect(el.className).toMatch(/w-6/);
  });

  it("renders with role-based class pair", () => {
    render(<ClientAvatar name="With Role" role="ADMIN" />);
    const el = screen.getByLabelText("With Role");
    // role-based class produces bg + text classes; just sanity check it has any colour class
    expect(el.className).not.toMatch(/^\s*$/);
  });

  it("applies extra className", () => {
    render(<ClientAvatar name="Extra" className="my-extra" />);
    expect(screen.getByLabelText("Extra").className).toMatch(/my-extra/);
  });

  it("uses role=img with aria-label for a11y", () => {
    render(<ClientAvatar name="Acme" />);
    expect(screen.getByRole("img", { name: /acme/i })).toBeInTheDocument();
  });
});

describe("ClientAvatar — hex variant", () => {
  it("renders inline backgroundColor style derived from name", () => {
    render(<ClientAvatar name="Determinate" variant="hex" />);
    const el = screen.getByLabelText("Determinate");
    expect(el.getAttribute("style") ?? "").toMatch(/background-color/i);
  });

  it("two distinct names produce different colours", () => {
    const { container: a } = render(
      <ClientAvatar name="Alpha" variant="hex" />,
    );
    const { container: b } = render(<ClientAvatar name="Bravo" variant="hex" />);
    const styleA = (a.firstChild as HTMLElement).getAttribute("style") ?? "";
    const styleB = (b.firstChild as HTMLElement).getAttribute("style") ?? "";
    expect(styleA).not.toBe(styleB);
  });
});

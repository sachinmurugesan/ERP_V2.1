import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserRole } from "@harvesterp/lib";
import { ClientAvatar } from "@/components/composed/client-avatar";

describe("ClientAvatar", () => {
  it("renders without crash", () => {
    render(<ClientAvatar name="Alice Johnson" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it('shows correct initials for a two-word name', () => {
    render(<ClientAvatar name="Alice Johnson" variant="hex" />);
    expect(screen.getByRole("img")).toHaveTextContent("AJ");
  });

  it('shows "?" for empty name', () => {
    render(<ClientAvatar name="" variant="hex" />);
    expect(screen.getByRole("img")).toHaveTextContent("?");
  });

  it("has aria-label set to name", () => {
    render(<ClientAvatar name="Bob Smith" />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Bob Smith");
  });

  it('variant="hex" uses inline style with background color', () => {
    render(<ClientAvatar name="Alice" variant="hex" />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("style")).toMatch(/background-color/);
  });

  it('variant="class" does not use inline style background', () => {
    render(<ClientAvatar name="Alice" variant="class" role={UserRole.ADMIN} />);
    const el = screen.getByRole("img");
    const style = el.getAttribute("style") ?? "";
    expect(style).not.toMatch(/background-color/);
  });

  it("applies size-lg class for size=lg", () => {
    render(<ClientAvatar name="Alice" variant="hex" size="lg" />);
    const el = screen.getByRole("img");
    expect(el.className).toMatch(/h-12/);
  });

  it("applies size-sm class for size=sm", () => {
    render(<ClientAvatar name="Alice" variant="hex" size="sm" />);
    const el = screen.getByRole("img");
    expect(el.className).toMatch(/h-6/);
  });

  it("handles email address as name", () => {
    render(<ClientAvatar name="alice@example.com" variant="hex" />);
    // alice@example.com → ["alice","example","com"] → A + C = "AC"
    expect(screen.getByRole("img")).toHaveTextContent("AC");
  });
});

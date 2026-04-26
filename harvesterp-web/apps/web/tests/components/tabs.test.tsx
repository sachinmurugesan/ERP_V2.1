/**
 * tabs.test.tsx — Unit tests for the Tabs primitive (Radix wrapper).
 *
 * Verifies: list rendering, click switches content, keyboard nav,
 * active-state styling class, default-selected wiring, controlled mode.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../src/components/primitives/tabs";

function renderThree(defaultValue = "a") {
  return render(
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="a">Alpha</TabsTrigger>
        <TabsTrigger value="b">Bravo</TabsTrigger>
        <TabsTrigger value="c">Charlie</TabsTrigger>
      </TabsList>
      <TabsContent value="a">Alpha content</TabsContent>
      <TabsContent value="b">Bravo content</TabsContent>
      <TabsContent value="c">Charlie content</TabsContent>
    </Tabs>,
  );
}

describe("Tabs — rendering", () => {
  it("renders all three tab triggers in order", () => {
    renderThree();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent("Alpha");
    expect(tabs[1]).toHaveTextContent("Bravo");
    expect(tabs[2]).toHaveTextContent("Charlie");
  });

  it("renders the default tab content (and only that one)", () => {
    renderThree("a");
    expect(screen.getByText("Alpha content")).toBeInTheDocument();
    // Other contents are unmounted (Radix removes inactive panels by default)
    expect(screen.queryByText("Bravo content")).toBeNull();
    expect(screen.queryByText("Charlie content")).toBeNull();
  });

  it("respects a different defaultValue", () => {
    renderThree("c");
    expect(screen.getByText("Charlie content")).toBeInTheDocument();
    expect(screen.queryByText("Alpha content")).toBeNull();
  });
});

describe("Tabs — interactions", () => {
  it("clicking a tab switches the displayed content", async () => {
    // Radix Tabs uses pointer-events guards that fireEvent.click can't satisfy
    // in jsdom; userEvent.setup({ pointerEventsCheck: 0 }) bypasses the check.
    const user = userEvent.setup({
      pointerEventsCheck: 0,
    });
    renderThree("a");
    await user.click(screen.getByRole("tab", { name: "Bravo" }));
    expect(screen.getByText("Bravo content")).toBeInTheDocument();
    expect(screen.queryByText("Alpha content")).toBeNull();
  });

  it("active tab gets data-state='active' attribute", () => {
    renderThree("b");
    const bravo = screen.getByRole("tab", { name: "Bravo" });
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    expect(bravo.getAttribute("data-state")).toBe("active");
    expect(alpha.getAttribute("data-state")).toBe("inactive");
  });

  it("active trigger className includes the white-bg + emerald-text active-state classes", () => {
    renderThree("a");
    const alpha = screen.getByRole("tab", { name: "Alpha" });
    // The active state is encoded as data-[state=active]:* utility classes on the element.
    expect(alpha.className).toMatch(/data-\[state=active\]:bg-white/);
    expect(alpha.className).toMatch(/data-\[state=active\]:text-emerald-700/);
  });
});

describe("Tabs — keyboard navigation", () => {
  // Radix arrow-key handling listens on the tab list with `tabindex` semantics;
  // jsdom's fireEvent.keyDown on a single tab element doesn't replicate the
  // browser's focus model. userEvent.keyboard simulates a real key press
  // against the currently-focused element and Radix responds correctly.

  it("ArrowRight moves focus to the next tab", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderThree("a");
    await user.tab(); // focuses the active tab (Alpha)
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Bravo" })).toHaveFocus();
  });

  it("ArrowLeft moves focus to the previous tab", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderThree("b");
    await user.tab(); // focuses Bravo (active)
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
  });

  it("Home moves focus to the first tab", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderThree("c");
    await user.tab(); // focuses Charlie (active)
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
  });

  it("End moves focus to the last tab", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderThree("a");
    await user.tab(); // focuses Alpha (active)
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Charlie" })).toHaveFocus();
  });
});

describe("Tabs — controlled mode", () => {
  it("respects an external value + onValueChange callback", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Tabs value="a" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="a">Alpha</TabsTrigger>
          <TabsTrigger value="b">Bravo</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A</TabsContent>
        <TabsContent value="b">B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Bravo" }));
    expect(onValueChange).toHaveBeenCalledWith("b");
    // Parent must apply the new value for content to switch
    rerender(
      <Tabs value="b" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="a">Alpha</TabsTrigger>
          <TabsTrigger value="b">Bravo</TabsTrigger>
        </TabsList>
        <TabsContent value="a">A</TabsContent>
        <TabsContent value="b">B</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});

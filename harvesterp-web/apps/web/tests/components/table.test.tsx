/**
 * table.test.tsx — Unit tests for table + skeleton primitives.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../../src/components/primitives/table";
import { Skeleton } from "../../src/components/primitives/skeleton";

describe("Table primitives", () => {
  it("renders a full table tree without errors", () => {
    render(
      <Table>
        <TableCaption>Ledger</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Debit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>2026-04-24</TableCell>
            <TableCell>100</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Totals</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Ledger")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Totals")).toBeInTheDocument();
  });

  it("forwards className on Table", () => {
    const { container } = render(
      <Table className="custom-table">
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(container.querySelector("table")).toHaveClass("custom-table");
  });

  it("wraps the table in an overflow-auto scroll container", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>a</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("overflow-auto");
  });

  it("TableHead has uppercase styling for ledger column headers", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const th = screen.getByText("Reference");
    expect(th.className).toMatch(/uppercase/);
  });

  it("TableRow applies hover transition classes", () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="row">
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const row = screen.getByTestId("row");
    expect(row.className).toMatch(/hover:bg-slate-50/);
  });

  it("supports colSpan on TableCell", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} data-testid="spanned">
              spanned
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByTestId("spanned")).toHaveAttribute("colspan", "5");
  });
});

describe("Skeleton primitive", () => {
  it("renders a shimmer div", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/animate-pulse/);
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("w-20");
  });

  it("forwards extra props", () => {
    render(<Skeleton aria-label="loading" data-testid="sk" />);
    const el = screen.getByTestId("sk");
    expect(el.getAttribute("aria-label")).toBe("loading");
  });
});

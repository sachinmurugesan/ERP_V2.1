/**
 * pagination.test.tsx — Unit tests for the shared Pagination component.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  Pagination,
  computeTotalPages,
} from "../../src/components/composed/pagination";

describe("Pagination — computeTotalPages", () => {
  it("rounds up", () => {
    expect(computeTotalPages(101, 50)).toBe(3);
    expect(computeTotalPages(50, 50)).toBe(1);
  });
  it("clamps to at least 1 for non-empty totals", () => {
    expect(computeTotalPages(1, 50)).toBe(1);
  });
  it("returns 0 when perPage is 0", () => {
    expect(computeTotalPages(100, 0)).toBe(0);
  });
});

describe("Pagination — rendering", () => {
  it("renders nothing when total === 0", () => {
    const { container } = render(
      <Pagination
        page={1}
        perPage={50}
        total={0}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders page X of Y + Showing range + total", () => {
    render(
      <Pagination
        page={2}
        perPage={50}
        total={123}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByText(/Showing/)).toBeInTheDocument();
    // 51..100 of 123
    expect(screen.getByText("51")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  it("hides per-page selector when onPerPageChange not provided", () => {
    render(
      <Pagination
        page={1}
        perPage={50}
        total={100}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/rows per page/i)).toBeNull();
  });

  it("renders per-page selector with options when onPerPageChange provided", () => {
    render(
      <Pagination
        page={1}
        perPage={50}
        total={100}
        onPrev={() => {}}
        onNext={() => {}}
        onPerPageChange={() => {}}
      />,
    );
    const select = screen.getByLabelText(/rows per page/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("50");
  });
});

describe("Pagination — interactions", () => {
  it("disables Prev on page 1", () => {
    render(
      <Pagination
        page={1}
        perPage={50}
        total={100}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).not.toBeDisabled();
  });

  it("disables Next on last page", () => {
    render(
      <Pagination
        page={2}
        perPage={50}
        total={100}
        onPrev={() => {}}
        onNext={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /previous page/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });

  it("calls onPrev / onNext when buttons clicked", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <Pagination
        page={2}
        perPage={50}
        total={200}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /previous page/i }));
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("calls onPerPageChange with the selected number", () => {
    const onPerPageChange = vi.fn();
    render(
      <Pagination
        page={1}
        perPage={50}
        total={300}
        onPrev={() => {}}
        onNext={() => {}}
        onPerPageChange={onPerPageChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/rows per page/i), {
      target: { value: "100" },
    });
    expect(onPerPageChange).toHaveBeenCalledWith(100);
  });
});

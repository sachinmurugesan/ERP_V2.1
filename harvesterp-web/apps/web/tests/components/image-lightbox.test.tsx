/**
 * image-lightbox.test.tsx — Unit tests for components/composed/image-lightbox.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  ImageLightbox,
} from "../../src/components/composed/image-lightbox";
import type { ProductImage } from "../../src/components/composed/image-gallery";

const three: ProductImage[] = [
  { id: "a", image_url: "/a.jpg", width: 800, height: 600, file_size: 51200 },
  { id: "b", image_url: "/b.jpg", width: 1024, height: 768 },
  { id: "c", image_url: "/c.jpg", width: 600, height: 400 },
];

describe("ImageLightbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ImageLightbox
        images={three}
        initialIndex={0}
        open={false}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when images empty", () => {
    const { container } = render(
      <ImageLightbox
        images={[]}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the image at initialIndex", () => {
    render(
      <ImageLightbox
        images={three}
        initialIndex={1}
        open={true}
        onClose={() => {}}
      />,
    );
    const img = screen.getByAltText(/product image 2 of 3/i) as HTMLImageElement;
    expect(img.src).toContain("/b.jpg");
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox
        images={three}
        initialIndex={0}
        open={true}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close viewer/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows prev/next navigation when multiple images", () => {
    render(
      <ImageLightbox
        images={three}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /previous image/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /next image/i }),
    ).toBeInTheDocument();
  });

  it("hides navigation when only one image", () => {
    render(
      <ImageLightbox
        images={[three[0]]}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /previous image/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /next image/i })).toBeNull();
  });

  it("navigates next/prev by button", () => {
    render(
      <ImageLightbox
        images={three}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /next image/i }));
    expect(screen.getByAltText(/product image 2 of 3/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /previous image/i }));
    expect(screen.getByAltText(/product image 1 of 3/i)).toBeInTheDocument();
  });

  it("wraps around at boundaries", () => {
    render(
      <ImageLightbox
        images={three}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /previous image/i }));
    expect(screen.getByAltText(/product image 3 of 3/i)).toBeInTheDocument();
  });

  it("supports keyboard navigation (arrows + escape)", () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox
        images={three}
        initialIndex={0}
        open={true}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByAltText(/product image 2 of 3/i)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows image metadata (width, height, size, source)", () => {
    render(
      <ImageLightbox
        images={three}
        initialIndex={0}
        open={true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/800x600/)).toBeInTheDocument();
    expect(screen.getByText(/50KB/)).toBeInTheDocument();
  });
});

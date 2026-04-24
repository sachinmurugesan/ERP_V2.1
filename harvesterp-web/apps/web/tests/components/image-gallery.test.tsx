/**
 * image-gallery.test.tsx — Unit tests for components/composed/image-gallery.tsx.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  ImageGallery,
  type ProductImage,
} from "../../src/components/composed/image-gallery";

const sample: ProductImage[] = [
  {
    id: "img1",
    image_url: "/uploads/a.jpg",
    thumbnail_url: "/uploads/a-thumb.jpg",
    width: 800,
    height: 600,
    file_size: 102400,
    source_type: "factory_excel",
  },
  {
    id: "img2",
    image_url: "/uploads/b.jpg",
    thumbnail_url: null,
    width: 1024,
    height: 768,
    file_size: 204800,
    source_type: "manual",
  },
];

describe("ImageGallery", () => {
  it("renders thumbnails for each image", () => {
    render(<ImageGallery images={sample} />);
    expect(screen.getByAltText(/product image 1/i)).toBeInTheDocument();
    expect(screen.getByAltText(/product image 2/i)).toBeInTheDocument();
  });

  it("shows empty state when no images", () => {
    render(<ImageGallery images={[]} />);
    expect(screen.getByText(/no images for this product/i)).toBeInTheDocument();
    expect(
      screen.getByText(/images are extracted from factory excel uploads/i),
    ).toBeInTheDocument();
  });

  it("renders the image count label", () => {
    render(<ImageGallery images={sample} />);
    expect(screen.getByText(/2 images/i)).toBeInTheDocument();
  });

  it("calls onOpen with index when thumbnail clicked", () => {
    const onOpen = vi.fn();
    render(<ImageGallery images={sample} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /view image 2/i }));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("calls onDelete when trash icon clicked (stops propagation)", () => {
    const onDelete = vi.fn();
    const onOpen = vi.fn();
    render(
      <ImageGallery images={sample} onDelete={onDelete} onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /delete image 1/i }));
    expect(onDelete).toHaveBeenCalledWith("img1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("hides upload button when onUpload not provided", () => {
    render(<ImageGallery images={sample} />);
    expect(screen.queryByRole("button", { name: /^upload$/i })).toBeNull();
  });

  it("hides delete buttons when readonly", () => {
    const onDelete = vi.fn();
    render(
      <ImageGallery images={sample} onDelete={onDelete} readonly={true} />,
    );
    expect(screen.queryByRole("button", { name: /delete image/i })).toBeNull();
  });

  it("calls onUpload with selected files", () => {
    const onUpload = vi.fn();
    render(<ImageGallery images={sample} onUpload={onUpload} />);
    const input = screen.getByLabelText(
      /upload product image/i,
    ) as HTMLInputElement;
    const file = new File(["abc"], "test.jpg", { type: "image/jpeg" });
    Object.defineProperty(input, "files", { value: [file] });
    fireEvent.change(input);
    expect(onUpload).toHaveBeenCalledWith([file]);
  });

  it("shows loading state", () => {
    render(<ImageGallery images={[]} loading={true} />);
    expect(screen.getByText(/loading images/i)).toBeInTheDocument();
  });

  it("triggers onOpen on Enter key for a11y", () => {
    const onOpen = vi.fn();
    render(<ImageGallery images={sample} onOpen={onOpen} />);
    const btn = screen.getByRole("button", { name: /view image 1/i });
    fireEvent.keyDown(btn, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledWith(0);
  });

  it("shows width/height and file size metadata", () => {
    render(<ImageGallery images={sample} />);
    expect(screen.getByText(/800x600/)).toBeInTheDocument();
    expect(screen.getByText(/100KB/)).toBeInTheDocument();
  });
});
